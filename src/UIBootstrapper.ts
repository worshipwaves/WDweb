// src/UIBootstrapper.ts

import { ApplicationController } from './ApplicationController';
import { SceneManager } from './SceneManager';
import { UIEngine } from './UIEngine';
import { CompositionStateDTO, ApplicationState } from './types/schemas';
import { UploadInterface } from './UploadInterface';
import { ProcessingOverlay } from './ProcessingOverlay';
import { TourModal } from './components/TourModal';
import { DemoPlayer } from './demo/DemoPlayer';

export class UIBootstrapper {
    private uiEngine: UIEngine;
    private controller: ApplicationController;
    private sceneManager: SceneManager;

    constructor(uiEngine: UIEngine, controller: ApplicationController, sceneManager: SceneManager) {
        this.uiEngine = uiEngine;
        this.controller = controller;
        this.sceneManager = sceneManager;
    }

    public async initialize(): Promise<void> {
        const initialState = this.controller.getState();
        
        window.updateGrainDirectionOptionsFromController = (newN: number) => {
            this._updateGrainDirectionOptions(this.uiEngine, newN);
        };
        
        await this._setupDynamicOptions();
        this._syncUIFromState(initialState.composition);
        this._bindElementListeners();
        this._bindUpdateButton();
        
        this.controller.subscribe((newState) => {
            this._syncUIFromState(newState.composition);
            this._updateConditionalUI(newState.composition);
        });
        
        this._bindSelectAllCheckbox();
        this._setupUploadInterface();
        new ProcessingOverlay('processingOverlay', this.controller);

        const { LeftPanelRenderer } = await import('./components/LeftPanelRenderer');
        const leftPanelRenderer = new LeftPanelRenderer('left-main-panel', (categoryId) => {
            this.controller.handleCategorySelected(categoryId);
            this.sceneManager.updateCameraOffset(); // Update camera on panel change
        });
        leftPanelRenderer.render();
        
        this.controller.restoreUIFromState();
        
        this.controller.subscribe((state) => this._handlePhaseTransition(state));
        if (initialState.phase !== 'upload') {
            this._handlePhaseTransition(initialState);
        }
        
        this._updateConditionalUI(initialState.composition);
        this._ensureSectionsOptionsVisible();
        this._initializeBottomControls();

        if (TourModal.shouldShow()) {
            const tourModal = new TourModal(() => {
                if (window.demoPlayer) window.demoPlayer.start();
            }, () => {});
            tourModal.show();
        }

        this.sceneManager.updateCameraOffset();
    }

    private _initializeBottomControls(): void {
        document.getElementById('resetViewBtn')?.addEventListener('click', () => this.sceneManager.resetCamera());
        document.getElementById('zoomInBtn')?.addEventListener('click', () => this.sceneManager.toggleZoom(true));
        document.getElementById('zoomOutBtn')?.addEventListener('click', () => this.sceneManager.toggleZoom(false));

        document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(err => console.error(err));
            else if (document.exitFullscreen) document.exitFullscreen();
        });

        let menusHidden = false;
        document.getElementById('toggleMenusBtn')?.addEventListener('click', () => {
            menusHidden = !menusHidden;
            document.body.classList.toggle('menus-hidden', menusHidden);
            const btn = document.getElementById('toggleMenusBtn');
            if (btn) btn.title = menusHidden ? 'Show Menus' : 'Hide Menus';
            setTimeout(() => this.sceneManager.updateCameraOffset(), 250);
        });
    }
    
    private _syncUIFromState(composition: CompositionStateDTO): void {
        this.uiEngine.getElementKeys().forEach(key => {
            const config = this.uiEngine.getElementConfig(key);
            if (!config) return;
            const value = this.uiEngine.getStateValue(composition, config.state_path) as string | number | null | undefined;
            if (value !== null && value !== undefined) {
                this.uiEngine.writeElementValue(key, value);
            }
        });
    }

    private async _setupDynamicOptions(): Promise<void> {
        for (const key of this.uiEngine.getElementKeys()) {
            const config = this.uiEngine.getElementConfig(key);
            const element = this.uiEngine.getElement(key) as HTMLSelectElement;
            if (!config || !element) continue;

            if (config.options_from_endpoint) {
                const options = await this.uiEngine.loadDynamicOptions(key);
                if (options.length > 0) {
                    element.innerHTML = '';
                    options.forEach(opt => {
                        const optionEl = document.createElement('option');
                        optionEl.value = String(opt.value);
                        optionEl.textContent = opt.label;
                        element.appendChild(optionEl);
                    });
                }
            } else if (config.options && element.tagName === 'SELECT') {
                element.innerHTML = '';
                config.options.forEach(opt => {
                    const optionEl = document.createElement('option');
                    optionEl.value = String(opt.value);
                    optionEl.textContent = opt.label;
                    element.appendChild(optionEl);
                });
            }
        }
    }

    private _captureUISnapshot(baseComposition: CompositionStateDTO): CompositionStateDTO {
        let composition = JSON.parse(JSON.stringify(baseComposition)) as CompositionStateDTO;
        for (const key of this.uiEngine.getElementKeys()) {
            const config = this.uiEngine.getElementConfig(key);
            if (!config) continue;
            let value = this.uiEngine.readElementValue(key);
            if (value === null || value === undefined) continue;
            if (config.type === 'select' && typeof value === 'string' && !isNaN(parseFloat(value))) {
                value = parseFloat(value);
            }
            if (key === 'size') {
                composition.frame_design.finish_x = value as number;
                composition.frame_design.finish_y = value as number;
                continue;
            }
            if (key === 'woodSpecies' || key === 'grainDirection') continue;
            composition = this.uiEngine.setStateValue(composition, config.state_path, value) as CompositionStateDTO;
        }
        return composition;
    }

    private _bindElementListeners(): void {
        this.uiEngine.getElementKeys().forEach(key => {
            const element = this.uiEngine.getElement(key);
            const config = this.uiEngine.getElementConfig(key);
            if (!element || !config) return;

            if (config.type === 'range' && config.display_value_id) {
                const displayEl = document.getElementById(config.display_value_id);
                if (displayEl) {
                    displayEl.textContent = (element as HTMLInputElement).value;
                    element.addEventListener('input', () => { displayEl.textContent = (element as HTMLInputElement).value; });
                }
            }

            if (key === 'sections') {
                element.addEventListener('change', () => {
                    const sections = parseInt((element as HTMLSelectElement).value);
                    this.uiEngine.updateSlotsStep(sections);
                    this._updateGrainDirectionOptions(this.uiEngine, sections);
                    const shapeEl = this.uiEngine.getElement('shape') as HTMLSelectElement;
                    this._updateConditionalUI({ shape: shapeEl?.value || 'circular', number_sections: sections });
                });
            }

            if (key === 'shape') {
                element.addEventListener('change', () => {
                    const shapeValue = (element as HTMLSelectElement).value;
                    const { composition } = this.controller.getState();
                    this._updateConditionalUI({ shape: shapeValue, number_sections: composition.frame_design.number_sections });
                });
            }

            if (config.on_change) {
                element.addEventListener('change', () => {
                    this._handleOnChangeAction(config.on_change!);
                });
            }
        });
    }

    private _bindUpdateButton(): void {
        const updateButtonConfig = this.uiEngine.getButtonConfig('updateDesign');
        const element = updateButtonConfig ? document.getElementById(updateButtonConfig.id) : null;
        if (!element) return;
        element.addEventListener('click', () => {
            const newComposition = this._captureUISnapshot(this.controller.getState().composition);
            void this.controller.handleCompositionUpdate(newComposition);
        });
    }
    
    private _bindSelectAllCheckbox(): void {
        const checkbox = document.getElementById('selectAllCheckbox') as HTMLInputElement;
        if (!checkbox) return;
        checkbox.checked = false;
        checkbox.indeterminate = false;	
        checkbox.addEventListener('change', () => {
            const numSections = this.controller.getState().composition.frame_design.number_sections;
            this.sceneManager.clearSelection();
            if (checkbox.checked) {
                for (let i = 0; i < numSections; i++) this.sceneManager.toggleSection(i);
            }
            this.controller.selectSection(this.sceneManager.getSelectedSections());
            this.sceneManager.updateSectionUI(this.sceneManager.getSelectedSections());
        });
    }
    
    private _setupUploadInterface(): void {
        const uploadConfig = this.uiEngine.getUploadConfig();
        if (!uploadConfig) return;
        new UploadInterface(uploadConfig.container_id, {
            onFileSelected: (file: File) => {
                const uiComposition = this._captureUISnapshot(this.controller.getState().composition);
                void this.controller.dispatch({ type: 'FILE_UPLOADED', payload: { file, uiSnapshot: uiComposition } });
            },
            onError: (error: string) => console.error('Upload error:', error)
        }, this.uiEngine);
    }

    private _updateConditionalUI(compositionOrSnapshot: Partial<CompositionStateDTO> | Record<string, unknown>): void {
        const currentState = {
            shape: (compositionOrSnapshot as CompositionStateDTO).frame_design?.shape ?? (compositionOrSnapshot as Record<string, unknown>).shape,
            number_sections: (compositionOrSnapshot as CompositionStateDTO).frame_design?.number_sections ?? (compositionOrSnapshot as Record<string, unknown>).number_sections
        };
        this.uiEngine.updateConditionalOptions(currentState);
        this.uiEngine.updateElementVisibility(currentState);
    }

    private _ensureSectionsOptionsVisible(): void {
        const sectionsEl = this.uiEngine.getElement('sections') as HTMLSelectElement;
        if (sectionsEl) {
            for (const option of sectionsEl.options) option.style.display = '';
        }
    }

    private _updateGrainDirectionOptions(uiEngine: UIEngine, numSections: number): void {
        const grainEl = uiEngine.getElement('grainDirection') as HTMLSelectElement;
        const grainConfig = uiEngine.getElementConfig('grainDirection');
        if (!grainEl || !grainConfig?.options) return;
        let isCurrentValueVisible = false;
        for (const option of grainConfig.options) {
            const optionEl = grainEl.querySelector(`option[value="${option.value}"]`);
            if (!optionEl) continue;
            let shouldShow = true;
            if (option.show_when?.number_sections && !option.show_when.number_sections.includes(numSections)) {
                shouldShow = false;
            }
            (optionEl as HTMLElement).style.display = shouldShow ? '' : 'none';
            if (shouldShow && grainEl.value === String(option.value)) {
                isCurrentValueVisible = true;
            }
        }
        if (!isCurrentValueVisible) grainEl.value = 'vertical';
    }

    private _handlePhaseTransition(state: ApplicationState): void {
        const uploadConfig = this.uiEngine.getUploadConfig();
        if (!uploadConfig) return;
        const uploadContainer = document.getElementById(uploadConfig.container_id);
        const visualizationContainer = document.getElementById('visualizationContainer'); // Assuming this exists for now
        if (!uploadContainer || !visualizationContainer) return;
        const isActive = state.phase === 'upload';
        uploadContainer.classList.toggle('active', isActive);
        visualizationContainer.classList.toggle('active', !isActive);
    }
    
    private _handleOnChangeAction(onChangeConfig: { action: string; requires?: string[] }): void {
        if (onChangeConfig.action === 'update_section_materials') {
            this._handleUpdateSectionMaterials(onChangeConfig);
        }
    }

    private _handleUpdateSectionMaterials(onChangeConfig: { requires?: string[] }): void {
        if (!onChangeConfig.requires || onChangeConfig.requires.length < 2) return;
        
        const [speciesKey, grainKey] = onChangeConfig.requires;
        const species = (this.uiEngine.getElement(speciesKey) as HTMLSelectElement)?.value;
        const grain = (this.uiEngine.getElement(grainKey) as HTMLSelectElement)?.value as 'horizontal' | 'vertical' | 'radiant' | 'diamond';

        if (!species || !grain) return;
        
        const selectedSections = this.sceneManager.getSelectedSections();
        
        if (selectedSections.size > 0) {
            selectedSections.forEach(id => {
                this.controller.updateSectionMaterial(id, species, grain);
            });
        } else {
            const numSections = this.controller.getState().composition.frame_design.number_sections;
            for (let i = 0; i < numSections; i++) {
                this.controller.updateSectionMaterial(i, species, grain);
            }
        }
    }
}