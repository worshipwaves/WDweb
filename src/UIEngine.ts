/**
 * UIEngine - Generic UI rendering engine driven by backend configuration
 * 
 * Reads _ui_config from default_parameters.json and:
 * - Provides element access without hardcoded IDs
 * - Dynamically loads options from endpoints
 * - Executes conditional logic (like disabling n=3 for rectangular)
 */
 
import { z } from 'zod';
 

interface UIElementConfig {
  id: string;
  type: string;
  label: string;
  state_path: string;
  show_when?: Record<string, Array<string | number>>;
  options?: Array<{ value: string | number; label: string; disabled_when?: Record<string, string>; show_when?: Record<string, Array<number>> }>;
  options_from_endpoint?: string;
  options_path?: string;
  default_value_from_endpoint?: string;
  default_value_path?: string;
  min?: number;
  max?: number;
  step?: number;
  display_value_id?: string;
  on_change?: UIOnChangeConfig;
  on_change_triggers?: Array<{
    action: string;
    source_path: string;
  }>;
}

interface UIButtonConfig {
  id: string;
  label: string;
  title?: string;
  action: string;
}

interface UIOnChangeConfig {
  action: string;
  requires?: string[];
}

interface UIUploadConfig {
  container_id: string;
  drop_zone_id: string;
  file_input_id: string;
  accepted_mime_types: string[];
  accepted_extensions: string[];
  max_file_size_mb: number;
  hint_delay_ms: number;
  messages: {
    invalid_type: string;
    file_too_large: string;
    drop_hint: string;
  };
}

interface UIConfig {
  elements: Record<string, UIElementConfig>;
  buttons: Record<string, UIButtonConfig>;
  upload: UIUploadConfig;
}

// Zod schemas for runtime validation
const UIElementConfigSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  state_path: z.string()
}).passthrough();

const UIButtonConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  title: z.string().optional(),
  action: z.string()
}).passthrough();

const UIUploadConfigSchema = z.object({
  container_id: z.string(),
  drop_zone_id: z.string(),
  file_input_id: z.string(),
  accepted_mime_types: z.array(z.string()),
  accepted_extensions: z.array(z.string()),
  max_file_size_mb: z.number(),
  hint_delay_ms: z.number(),
  messages: z.object({
    invalid_type: z.string(),
    file_too_large: z.string(),
    drop_hint: z.string()
  }).passthrough()
}).passthrough();

const UIConfigSchema = z.object({
  elements: z.record(z.string(), UIElementConfigSchema),
  buttons: z.record(z.string(), UIButtonConfigSchema),
  upload: UIUploadConfigSchema
}).passthrough();

export class UIEngine {
  private config: UIConfig | null = null;
  private elementCache: Map<string, string> = new Map();
  
  /**
   * Load UI configuration from backend
   */
  async loadConfig(): Promise<void> {
    const response = await fetch('/api/config/default-parameters');
    if (!response.ok) {
      throw new Error('Failed to load UI configuration');
    }
    
    const raw = await response.json() as unknown;
    
    if (typeof raw !== 'object' || raw === null || !('_ui_config' in raw)) {
      throw new Error('Invalid config structure: missing _ui_config');
    }
    
    const parsed = UIConfigSchema.safeParse((raw as { _ui_config: unknown })._ui_config);
    if (!parsed.success) {
      console.error('UIConfig validation failed:', parsed.error.format());
			console.error('Detailed errors:', JSON.stringify(parsed.error.format(), null, 2));
      throw new Error('UIConfig validation failed');
    }
    
    this.config = parsed.data;
    
    // Build element ID cache
    if (this.config) {
      Object.entries(this.config.elements).forEach(([key, element]) => {
        this.elementCache.set(key, element.id);
      });
      
      Object.entries(this.config.buttons).forEach(([key, button]) => {
        this.elementCache.set(key, button.id);
      });
      
      // Upload IDs
      this.elementCache.set('uploadContainer', this.config.upload.container_id);
      this.elementCache.set('uploadDropZone', this.config.upload.drop_zone_id);
      this.elementCache.set('fileInput', this.config.upload.file_input_id);
    }
  }
  
  /**
   * Get HTML element by config key (not hardcoded ID)
   */
  getElement(key: string): HTMLElement | null {
    const id = this.elementCache.get(key);
    if (!id) {
      console.warn(`[UIEngine] No element found for key: ${key}`);
      return null;
    }
    return document.getElementById(id);
  }
  
  /**
   * Get element config by key
   */
  getElementConfig(key: string): UIElementConfig | null {
    if (!this.config) return null;
    return this.config.elements[key] || null;
  }
  
  /**
   * Get button config by key
   */
  getButtonConfig(key: string): UIButtonConfig | null {
    if (!this.config) return null;
    return this.config.buttons[key] || null;
  }
  
  /**
   * Get upload configuration
   */
  getUploadConfig(): UIUploadConfig | null {
    return this.config?.upload || null;
  }
  
  /**
   * Load dynamic options from endpoint (e.g., wood species)
   */
  async loadDefaultValue(key: string): Promise<string | null> {
    const elementConfig = this.getElementConfig(key);
    if (!elementConfig || !elementConfig.default_value_from_endpoint) {
      return null;
    }
    
    const response = await fetch(elementConfig.default_value_from_endpoint);
    if (!response.ok) {
      console.error(`[UIEngine] Failed to load default value for ${key}`);
      return null;
    }
    
    const raw = await response.json() as unknown;
    const path = elementConfig.default_value_path || '';
    const defaultValue = path.split('.').reduce((obj: unknown, key: string) => {
      if (typeof obj === 'object' && obj !== null && key in obj) {
        return (obj as Record<string, unknown>)[key];
      }
      return undefined;
    }, raw);
    
    return defaultValue || null;
  }
  
  async loadDynamicOptions(key: string): Promise<Array<{ value: string; label: string }>> {
    const elementConfig = this.getElementConfig(key);
    if (!elementConfig || !elementConfig.options_from_endpoint) {
      return [];
    }
    
    const response = await fetch(elementConfig.options_from_endpoint);
    if (!response.ok) {
      console.error(`[UIEngine] Failed to load options for ${key}`);
      return [];
    }
    
    const raw = await response.json() as unknown;
    
    // Navigate to options using path (e.g., "species_catalog")
    const path = elementConfig.options_path || '';
    const options = path.split('.').reduce((obj: unknown, key: string) => {
      if (typeof obj === 'object' && obj !== null && key in obj) {
        return (obj as Record<string, unknown>)[key];
      }
      return undefined;
    }, raw);
    
    if (!Array.isArray(options)) {
      console.error(`[UIEngine] Invalid options data for ${key}`);
      return [];
    }
    
    // Map to {value, label} format
    return options.map((opt: { id: string; display: string }) => ({
      value: opt.id,
      label: opt.display
    }));
  }
  
  /**
   * Check if option should be disabled based on current state
   */
  shouldDisableOption(
    elementKey: string, 
    optionValue: string | number, 
    currentState: Record<string, string | number>
  ): boolean {
    const elementConfig = this.getElementConfig(elementKey);
    if (!elementConfig || !elementConfig.options) return false;
    
    const option = elementConfig.options.find(opt => opt.value === optionValue);
    if (!option || !option.disabled_when) return false;
    
    // Check if disabled_when conditions are met
    return Object.entries(option.disabled_when).every(([stateKey, stateValue]) => {
      const currentValue = currentState[stateKey];
          // Support both single values and arrays
          if (Array.isArray(stateValue)) {
            return stateValue.includes(currentValue);
          }
          return currentValue === stateValue;
        });
  }
  
  /**
   * Get all element keys
   */
  getElementKeys(): string[] {
    if (!this.config) return [];
    return Object.keys(this.config.elements);
  }
  
  /**
   * Get all button keys
   */
  getButtonKeys(): string[] {
    if (!this.config) return [];
    return Object.keys(this.config.buttons);
  }
  
  /**
   * Read value from element based on its type
   */
  readElementValue(key: string): string | number | null {
    const element = this.getElement(key);
    const config = this.getElementConfig(key);
    
    if (!element || !config) return null;
    
    switch (config.type) {
      case 'select':
        return (element as HTMLSelectElement).value;
      case 'range':
        return parseFloat((element as HTMLInputElement).value);
      default:
        return null;
    }
  }
  
  /**
   * Write value to element based on its type
   */
  writeElementValue(key: string, value: string | number): void {
    const element = this.getElement(key);
    const config = this.getElementConfig(key);
    
    if (!element || !config) return;
    
    switch (config.type) {
      case 'select':
        (element as HTMLSelectElement).value = String(value);
        break;
      case 'range':
        (element as HTMLInputElement).value = String(value);
        // Update display value if configured
        if (config.display_value_id) {
          const displayEl = document.getElementById(config.display_value_id);
          if (displayEl) displayEl.textContent = String(value);
        }
        break;
    }
  }
  
  /**
   * Get value from composition state using state_path
   */
  getStateValue(composition: Record<string, unknown>, statePath: string): unknown {
    const parts = statePath.split('.');
    let value: unknown = composition;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part.includes('[]')) {
        const arrayPart = part.replace('[]', '');
        if (typeof value === 'object' && value !== null && arrayPart in value) {
          const arrayValue = (value as Record<string, unknown>)[arrayPart];
          if (Array.isArray(arrayValue) && arrayValue.length > 0) {
            value = arrayValue[0];
          } else {
            return null;
          }
        } else {
          return null;
        }
      } else {
        if (typeof value === 'object' && value !== null && part in value) {
          value = (value as Record<string, unknown>)[part];
        } else {
          return null;
        }
      }
      
      if (value === undefined || value === null) {
        return null;
      }
    }
    
    return value;
  }
  
  /**
   * Set value in composition state using state_path (immutable)
   */
  setStateValue(composition: Record<string, unknown>, statePath: string, value: string | number): Record<string, unknown> {
    // Handle special case for array properties like "section_materials[].species"
    if (statePath.includes('[]')) {
      const newComposition = JSON.parse(JSON.stringify(composition)) as Record<string, unknown>;
      const [arrayPath, property] = statePath.split('[].');
      const parts = arrayPath.split('.');
      
      let current: Record<string, unknown> = newComposition;
      for (const part of parts) {
        if (part in current) {
          const next = current[part];
          if (typeof next === 'object' && next !== null) {
            current = next as Record<string, unknown>;
          }
        }
      }
      
      // Update all array items with the value
      if (Array.isArray(current) && property) {
        current.forEach((item: unknown, index: number) => {
          if (typeof item === 'object' && item !== null) {
            const typedItem = item as Record<string, unknown>;
            typedItem[property] = value;
            current[index] = typedItem;
          }
        });
      }
      
      return newComposition;
    }
    
    // Handle normal nested paths
    const parts = statePath.split('.');
    const newComposition = JSON.parse(JSON.stringify(composition)) as Record<string, unknown>;
    
    let current: Record<string, unknown> = newComposition;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part && part in current) {
        const next = current[part];
        if (typeof next === 'object' && next !== null) {
          current = next as Record<string, unknown>;
        }
      }
    }
    
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      current[lastPart] = value;
    }
    return newComposition;
  }
  
  /**
   * Validate slots divisibility by sections
   */
  validateSlotsDivisibility(slots: number, sections: number): number {
    if (slots % sections === 0) return slots;
    
    // Snap to nearest valid value
    const remainder = slots % sections;
    if (remainder < sections / 2) {
      return slots - remainder;
    } else {
      return slots + (sections - remainder);
    }
  }
  
  /**
   * Handle on_change_triggers for an element
   * Executes configured actions and updates only affected UI elements
   */
  handleOnChangeTriggers(elementKey: string, newValue: string | number, currentState: Record<string, unknown>): void {
    const config = this.getElementConfig(elementKey);
    if (!config?.on_change_triggers) return;
    
    for (const trigger of config.on_change_triggers) {
      if (trigger.action === 'apply_size_defaults') {
        this._applyOnChangeSizeDefaults(newValue, trigger.source_path, currentState);
      }
      // Future actions can be added here
    }
  }
  
  /**
   * Apply size defaults and update affected UI elements
   * @private
   */
  private _applyOnChangeSizeDefaults(newSize: number, sourcePath: string, currentState: Record<string, unknown>): void {
    const sizeKey = String(newSize);
    const sizeDefaults = this._getNestedValue(currentState, sourcePath);
    
    if (typeof sizeDefaults !== 'object' || sizeDefaults === null) return;
    
    const defaults = (sizeDefaults as Record<string, unknown>)[sizeKey];
    
    if (typeof defaults !== 'object' || defaults === null) return;
    
    const typedDefaults = defaults as Record<string, unknown>;
    
    // Map of state paths to their new values
    const updates = {
      'pattern_settings.number_slots': typedDefaults.number_slots,
      'frame_design.separation': typedDefaults.separation,
    };
    
    // Find affected elements by reverse-lookup on state_path
    for (const [statePath, newValue] of Object.entries(updates)) {
      const affectedKey = this._findElementKeyByStatePath(statePath);
      if (affectedKey) {
        this.writeElementValue(affectedKey, newValue);
      }
    }
  }
  
  /**
   * Find element key by its state_path (reverse lookup)
   * @private
   */
  private _findElementKeyByStatePath(statePath: string): string | null {
    for (const [key, config] of Object.entries(this.config!.elements)) {
      if (config.state_path === statePath) {
        return key;
      }
    }
    return null;
  }
  
  /**
   * Get nested value from object using dot notation path
   * @private
   */
  private _getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (typeof current === 'object' && current !== null && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj as unknown);
  }
  
  /**
   * Update slots step based on sections value
   */
  updateSlotsStep(sections: number): void {
    const slotsEl = this.getElement('slots') as HTMLInputElement;
    if (slotsEl) {
      slotsEl.step = String(sections);
    }
  }
  
  /**
   * Handle conditional option disabling (e.g., n=3 for rectangular)
   */
  updateConditionalOptions(currentState: Record<string, unknown>): void {
    const elementsConfig = this.config?.elements;
    if (!elementsConfig) return;
    
    Object.entries(elementsConfig).forEach(([key, config]) => {
      if (!config.options) return;
      
      const element = this.getElement(key) as HTMLSelectElement;
      if (!element) return;
      
      config.options.forEach(option => {
        if (!option.disabled_when) return;
        
        const optionEl = element.querySelector(`option[value="${option.value}"]`) as HTMLOptionElement;
        if (!optionEl) return;
        
        // Check if disabled_when conditions are met
        const shouldDisable = Object.entries(option.disabled_when).every(([stateKey, stateValue]) => {
          return currentState[stateKey] === stateValue;
        });
        
        optionEl.disabled = shouldDisable;
        if (shouldDisable) {
          optionEl.style.display = 'none';
          // If this option is currently selected, change to first valid option
          if (element.value === String(option.value)) {
            const firstValid = config.options?.find(opt => !opt.disabled_when);
            if (firstValid) {
              element.value = String(firstValid.value);
            }
          }
        } else {
          optionEl.style.display = '';
        }
      });
    });
  }
	
	/**
   * Update element visibility based on show_when conditions
   */
  updateElementVisibility(currentState: Record<string, unknown>): void {
    const elementsConfig = this.config?.elements;
    if (!elementsConfig) return;
    
    Object.entries(elementsConfig).forEach(([key, config]) => {
      if (!config.show_when) return;
      
      const element = this.getElement(key);
      if (!element) return;
      
      // Get the parent control-group div
      const controlGroup = element.closest('.control-group');
      if (!controlGroup) return;
      
      // Check if show_when conditions are met
      const shouldShow = Object.entries(config.show_when).every(([stateKey, allowedValues]) => {
        const currentValue = currentState[stateKey];
        return allowedValues.includes(currentValue);
      });
      
      // Show or hide the entire control group
      (controlGroup as HTMLElement).style.display = shouldShow ? '' : 'none';
    });
  }
}