# Project Files Overview

**Generated on:** 2025-12-22 11:23:31
**Source:** Specified files (4)
**Total files:** 4

## Files Included

- `C:\Users\paulj\WaveDesigner-refactor\adapters\pyqt\widgets\audio_tab.py`
- `C:\Users\paulj\WaveDesigner-refactor\core\algorithms\audio_processing.py`
- `C:\Users\paulj\WaveDesigner-refactor\services\audio_orchestration_service.py`
- `C:\Users\paulj\WaveDesigner-refactor\services\audio_pipeline_service.py`

---

## File: `C:\Users\paulj\WaveDesigner-refactor\adapters\pyqt\widgets\audio_tab.py`

```python
# adapters/pyqt/widgets/audio_tab.py (COMPLETE VERSION)
"""Audio processing tab adapter - complete with all UI elements"""

import logging
import os
from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGroupBox,
    QPushButton, QCheckBox, QSpinBox, QDoubleSpinBox,
    QLabel, QComboBox, QGridLayout, QStyle
)
from PyQt5.QtCore import pyqtSignal, QTimer, QSettings
from PyQt5.QtWidgets import QMessageBox
from adapters.pyqt.dialogs.progress_dialog import ProgressDialog
from core.contracts.progress_dto import TaskStatus, ProgressUpdate
from services.event_bus import EventType
from services.service_facade import WaveformDesignerFacade

logger = logging.getLogger(__name__)


class AudioTabAdapter(QWidget):
    """Adapter for audio processing tab"""
    
    def __init__(self, facade: WaveformDesignerFacade):
        super().__init__()
        self.facade = facade
        self._setup_ui()
        self._connect_signals()
        self._connect_error_handlers()
        # Auto-update timer for audio parameters
        self._update_timer = QTimer()
        self._update_timer.setSingleShot(True)
        self._update_timer.timeout.connect(self._on_process_audio)
        self._update_timer.setInterval(500)
        self._initialized = True
        
        # Track previous silence removal state for re-enabling
        self._previous_silence_state = False
        
    def _setup_ui(self):
        """Initialize audio tab UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        layout.setSpacing(5)
        pm = self.facade.parameter_manager # Get parameter manager for schema access
        
        # Optimization Mode
        type_group = QGroupBox("Optimization Mode")
        type_layout = QHBoxLayout()
        
        self.audio_mode_combo = QComboBox()
        self.audio_mode_combo.addItem("Music (Dynamics)", "music")
        self.audio_mode_combo.addItem("Speech (Clarity)", "speech")
        self.audio_mode_combo.setToolTip("Select source type to adjust analysis strategy")
        
        self.optimize_btn = QPushButton("Auto-Optimize")
        self.optimize_btn.setToolTip("Analyzes audio to find the visual 'sweet spot'")
        
        self.optimization_status = QLabel("")
        self.optimization_status.setStyleSheet("color: gray; font-size: 0.9em;")

        type_layout.addWidget(QLabel("Type:"))
        type_layout.addWidget(self.audio_mode_combo)
        type_layout.addWidget(self.optimize_btn)
        type_layout.addWidget(self.optimization_status)
        type_layout.addStretch()
        
        type_group.setLayout(type_layout)
        layout.addWidget(type_group)

        # Playback controls
        playback_group = QGroupBox("Playback Controls")
        playback_layout = QHBoxLayout()
        
        self.play_pause_btn = QPushButton()
        self.play_pause_btn.setIcon(self.style().standardIcon(QStyle.SP_MediaPlay))
        self.stop_btn = QPushButton()
        self.stop_btn.setIcon(self.style().standardIcon(QStyle.SP_MediaStop))
        
        playback_layout.addWidget(self.play_pause_btn)
        playback_layout.addWidget(self.stop_btn)
        playback_group.setLayout(playback_layout)
        layout.addWidget(playback_group)
        
        # Audio slicing
        slice_group = QGroupBox("Audio Slicing")
        slice_layout = QGridLayout()
        
        start_time_def = pm._schema["Audio.Processing.StartTime"]
        slice_layout.addWidget(QLabel("Start:"), 0, 0)
        self.start_time = QDoubleSpinBox()
        self.start_time.setRange(start_time_def["min"], start_time_def["max"])
        self.start_time.setValue(start_time_def["default"])
        self.start_time.setSuffix(" s")
        slice_layout.addWidget(self.start_time, 0, 1)
        
        self.set_start_btn = QPushButton("Set Start")
        slice_layout.addWidget(self.set_start_btn, 1, 0, 1, 2)
        
        end_time_def = pm._schema["Audio.Processing.EndTime"]
        self.end_time = QDoubleSpinBox()
        self.end_time.setRange(end_time_def["min"], end_time_def["max"])
        self.end_time.setValue(end_time_def["default"])
        self.end_time.setSuffix(" s")
        slice_layout.addWidget(self.end_time, 0, 3)
        
        self.set_end_btn = QPushButton("Set End")
        slice_layout.addWidget(self.set_end_btn, 1, 2, 1, 2)
        
        self.play_slice_btn = QPushButton("Play Slice")
        slice_layout.addWidget(self.play_slice_btn, 2, 0, 1, 4)
        
        slice_group.setLayout(slice_layout)
        layout.addWidget(slice_group)
        
        # Silence removal
        silence_group = QGroupBox("Silence Removal")
        silence_layout = QVBoxLayout()
        
        remove_silence_def = pm._schema["Audio.Processing.RemoveSilence"]
        self.silence_checkbox = QCheckBox("Remove silence before processing")
        self.silence_checkbox.setChecked(remove_silence_def["default"])
        silence_layout.addWidget(self.silence_checkbox)
        
        threshold_layout = QHBoxLayout()
        silence_thresh_def = pm._schema["Audio.Processing.SilenceThreshold"]
        threshold_layout.addWidget(QLabel("Threshold:"))
        self.silence_threshold = QSpinBox()
        self.silence_threshold.setRange(silence_thresh_def["min"], silence_thresh_def["max"])
        self.silence_threshold.setValue(silence_thresh_def["default"])
        self.silence_threshold.setSuffix(" dB")
        threshold_layout.addWidget(self.silence_threshold)
        silence_layout.addLayout(threshold_layout)
        
        duration_layout = QHBoxLayout()
        silence_dur_def = pm._schema["Audio.Processing.SilenceDuration"]
        duration_layout.addWidget(QLabel("Min Duration:"))
        self.silence_duration = QDoubleSpinBox()
        self.silence_duration.setRange(silence_dur_def["min"], silence_dur_def["max"])
        self.silence_duration.setValue(silence_dur_def["default"])
        self.silence_duration.setSuffix(" s")
        duration_layout.addWidget(self.silence_duration)
        silence_layout.addLayout(duration_layout)
        
        silence_group.setLayout(silence_layout)
        layout.addWidget(silence_group)
        
        # Stem separation
        stem_group = QGroupBox("Stem Separation (Demucs)")
        stem_layout = QVBoxLayout()
        
        use_stems_def = pm._schema["Audio.Processing.UseStems"]
        self.use_stems_checkbox = QCheckBox("Use stem separation")
        self.use_stems_checkbox.setChecked(use_stems_def["default"])
        stem_layout.addWidget(self.use_stems_checkbox)
        
        self.run_demucs_btn = QPushButton("Run Demucs")
        stem_layout.addWidget(self.run_demucs_btn)
        
        stem_choice_layout = QHBoxLayout()
        stem_choice_def = pm._schema["Audio.Processing.StemChoice"]
        stem_choice_layout.addWidget(QLabel("Stem:"))
        self.stem_choice = QComboBox()
        # Create a user-friendly list for the UI
        ui_stem_options = ["vocals", "music"] # 'music' maps to 'no_vocals' internally
        self.stem_choice.addItems(ui_stem_options)
        self.stem_choice.setCurrentText(stem_choice_def["default"])
        stem_choice_layout.addWidget(self.stem_choice)
        stem_layout.addLayout(stem_choice_layout)
        
        self.play_stem_btn = QPushButton("Play Stem")
        stem_layout.addWidget(self.play_stem_btn)
        
        stem_group.setLayout(stem_layout)
        layout.addWidget(stem_group)
        
        # Amplitude processing
        amplitude_group = QGroupBox("Amplitude Processing")
        amplitude_layout = QVBoxLayout()
        
        # Number of amplitude points
        num_amp_layout = QHBoxLayout()
        num_amp_def = pm._schema["Audio.Processing.NumRawSamples"]
        num_amp_layout.addWidget(QLabel("Num Raw Amplitude Pts:"))
        self.num_amplitudes = QSpinBox()
        self.num_amplitudes.setRange(num_amp_def["min"], num_amp_def["max"])
        self.num_amplitudes.setValue(num_amp_def["default"])
        num_amp_layout.addWidget(self.num_amplitudes)
        amplitude_layout.addLayout(num_amp_layout)
        
        # Filter checkbox
        apply_filter_def = pm._schema["Audio.Processing.ApplyFilter"]
        self.filter_checkbox = QCheckBox("Filter Data (Noise Floor)")
        self.filter_checkbox.setChecked(apply_filter_def["default"])
        amplitude_layout.addWidget(self.filter_checkbox)
        
        # Filter amount
        filter_layout = QHBoxLayout()
        filter_amount_def = pm._schema["Audio.Processing.FilterAmount"]
        filter_layout.addWidget(QLabel("Filter Amount (%):"))
        self.filter_amount = QDoubleSpinBox()
        self.filter_amount.setRange(filter_amount_def["range"][0] * 100, filter_amount_def["range"][1] * 100)
        self.filter_amount.setValue(filter_amount_def["default"] * 100.0)
        self.filter_amount.setSingleStep(0.5)
        self.filter_amount.setSuffix(" %")
        filter_layout.addWidget(self.filter_amount)
        amplitude_layout.addLayout(filter_layout)
        
        # Amplitude Exponent
        exp_layout = QHBoxLayout()
        amp_exp_def = pm._schema["Pattern.AmplitudeExponent"]
        exp_layout.addWidget(QLabel("Amplitude Exponent:"))
        self.amplitude_exponent = QDoubleSpinBox()
        self.amplitude_exponent.setRange(amp_exp_def["range"][0], amp_exp_def["range"][1])
        self.amplitude_exponent.setValue(amp_exp_def["default"])
        self.amplitude_exponent.setSingleStep(0.05)
        self.amplitude_exponent.setDecimals(2)
        exp_layout.addWidget(self.amplitude_exponent)
        amplitude_layout.addLayout(exp_layout)
        
        # Binning mode
        binning_layout = QHBoxLayout()
        binning_def = pm._schema["Audio.Processing.BinningMode"]
        binning_layout.addWidget(QLabel("Binning Mode:"))
        self.binning_mode_combo = QComboBox()
        # Create user-friendly labels for UI
        ui_binning_options = ["Mean Absolute", "Min/Max", "Continuous"]
        self.binning_mode_combo.addItems(ui_binning_options)
        # Set initial value from parameter manager
        mode_map = {"mean_abs": "Mean Absolute", "min_max": "Min/Max", "continuous": "Continuous"}
        self.binning_mode_combo.setCurrentText(mode_map.get(binning_def["default"], "Mean Absolute"))
        binning_layout.addWidget(self.binning_mode_combo)
        amplitude_layout.addLayout(binning_layout)
        
        # Process button
        self.process_btn = QPushButton("Process Audio")
        amplitude_layout.addWidget(self.process_btn)
        
        amplitude_group.setLayout(amplitude_layout)
        layout.addWidget(amplitude_group)
        
        # Audio status
        self.audio_status_label = QLabel("Audio: Not loaded")
        self.audio_status_label.setStyleSheet("QLabel { color: #666; padding: 5px; }")
        layout.addWidget(self.audio_status_label)
        
        # Detailed status info
        self.source_info_label = QLabel("Source: No file loaded")
        self.source_info_label.setStyleSheet("QLabel { color: #333; padding: 3px 5px; }")
        self.source_info_label.setWordWrap(True)
        layout.addWidget(self.source_info_label)
        
        self.processing_info_label = QLabel("Processing: Not configured")
        self.processing_info_label.setStyleSheet("QLabel { color: #333; padding: 3px 5px; }")
        self.processing_info_label.setWordWrap(True)
        layout.addWidget(self.processing_info_label)
        
        self.stem_info_label = QLabel("Stem: Not using stem separation")
        self.stem_info_label.setStyleSheet("QLabel { color: #333; padding: 3px 5px; }")
        self.stem_info_label.setWordWrap(True)
        layout.addWidget(self.stem_info_label)
        
        layout.addStretch()
        
    def _connect_signals(self):
        """Connect widget signals to facade methods"""
        # Always connect parameter updates first (for both modes)
        self.optimize_btn.clicked.connect(self._on_optimize_clicked)
        self.start_time.valueChanged.connect(self._on_audio_params_changed)
        self.end_time.valueChanged.connect(self._on_audio_params_changed)
        self.num_amplitudes.valueChanged.connect(self._on_audio_params_changed)
        self.filter_checkbox.stateChanged.connect(self._on_audio_params_changed)
        self.filter_amount.valueChanged.connect(self._on_audio_params_changed)
        self.amplitude_exponent.valueChanged.connect(self._on_audio_params_changed)
        self.silence_checkbox.stateChanged.connect(self._on_audio_params_changed)
        self.silence_threshold.valueChanged.connect(self._on_audio_params_changed)
        self.silence_duration.valueChanged.connect(self._on_audio_params_changed)
        self.use_stems_checkbox.stateChanged.connect(self._on_audio_params_changed)
        self.stem_choice.currentTextChanged.connect(self._on_audio_params_changed)
        self.binning_mode_combo.currentTextChanged.connect(self._on_binning_mode_changed)
        
        # Always connect these
        try:
            self.play_pause_btn.clicked.disconnect()
            self.stop_btn.clicked.disconnect()
            self.set_start_btn.clicked.disconnect()
            self.set_end_btn.clicked.disconnect()
            self.play_slice_btn.clicked.disconnect()
            self.process_btn.clicked.disconnect()
            self.run_demucs_btn.clicked.disconnect()
            self.play_stem_btn.clicked.disconnect()
        except:
            pass
            
        self.play_pause_btn.clicked.connect(self._on_play_pause)
        self.stop_btn.clicked.connect(self._on_stop)
        self.set_start_btn.clicked.connect(self._on_set_start)
        self.set_end_btn.clicked.connect(self._on_set_end)
        self.play_slice_btn.clicked.connect(self._on_play_slice)
        self.process_btn.clicked.connect(self._on_process_audio)
        self.run_demucs_btn.clicked.connect(self._on_run_demucs)
        self.play_stem_btn.clicked.connect(self._on_play_stem)
        
        # Check if auto-update is enabled
        if self._is_auto_update_enabled():
            # Immediate updates for checkboxes
            self.filter_checkbox.stateChanged.connect(lambda: self._queue_audio_update())
            self.silence_checkbox.stateChanged.connect(self._on_silence_checkbox_changed)
            self.use_stems_checkbox.stateChanged.connect(lambda: self._queue_audio_update())
            
            # Immediate update for dropdown
            self.stem_choice.currentTextChanged.connect(lambda: self._queue_audio_update())
            
            # Delayed updates for numeric values
            self.start_time.valueChanged.connect(lambda: self._queue_param_update())
            self.end_time.valueChanged.connect(lambda: self._queue_param_update())
            self.num_amplitudes.valueChanged.connect(lambda: self._queue_param_update())
            self.filter_amount.valueChanged.connect(lambda: self._queue_param_update())
            self.silence_threshold.valueChanged.connect(self._on_silence_param_changed)
            self.amplitude_exponent.valueChanged.connect(lambda: self._queue_param_update())
            self.silence_duration.valueChanged.connect(self._on_silence_param_changed)
        else:
            # Manual mode - just update parameters without processing
            self.start_time.valueChanged.connect(self._on_audio_params_changed)
            self.end_time.valueChanged.connect(self._on_audio_params_changed)
            self.num_amplitudes.valueChanged.connect(self._on_audio_params_changed)
            self.filter_checkbox.stateChanged.connect(self._on_audio_params_changed)
            self.filter_amount.valueChanged.connect(self._on_audio_params_changed)
            self.silence_checkbox.stateChanged.connect(self._on_audio_params_changed)
            self.silence_threshold.valueChanged.connect(self._on_audio_params_changed)
            self.silence_duration.valueChanged.connect(self._on_audio_params_changed)
            self.use_stems_checkbox.stateChanged.connect(self._on_audio_params_changed)
            self.stem_choice.currentTextChanged.connect(self._on_audio_params_changed)
        
    def _on_play_pause(self):
        """Handle play/pause button"""
        is_playing = self.facade.toggle_playback()
        self.play_pause_btn.setIcon(
            self.style().standardIcon(QStyle.SP_MediaPause if is_playing else QStyle.SP_MediaPlay)
        )
        
    def _on_stop(self):
        """Handle stop button"""
        self.facade.stop_playback()
        self.play_pause_btn.setIcon(self.style().standardIcon(QStyle.SP_MediaPlay))
        
    def _on_set_start(self):
        """Set start time from current position"""
        position = self.facade.get_playback_position()
        if position >= 0:
            self.start_time.setValue(position / 1000.0)
            
    def _on_set_end(self):
        """Set end time from current position"""
        position = self.facade.get_playback_position()
        if position >= 0:
            self.end_time.setValue(position / 1000.0)
            
    def _on_play_slice(self):
        """Play audio slice"""
        self.facade.play_slice(
            self.start_time.value(),
            self.end_time.value()
        )
        
    def _on_run_demucs(self):
        """Run Demucs stem separation"""
       
        # Create progress dialog
        self._progress_dialog = ProgressDialog(
            description="Running Demucs stem separation",
            cancellable=True,
            parent=self
        )
        self._progress_dialog.cancel_requested.connect(self._cancel_stem_separation)
        
        # Subscribe to progress events
        self.facade.event_bus.subscribe(EventType.PROGRESS_UPDATE, self._on_stem_progress)
        
        try:
            # Start task - returns task ID
            self._stem_task_id = self.facade.run_demucs()
            # Show dialog
            self._progress_dialog.show()
        except Exception as e:
            self._progress_dialog.close()
            self.facade.event_bus.unsubscribe(EventType.PROGRESS_UPDATE, self._on_stem_progress)
            QMessageBox.critical(self, "Error", f"Failed to start Demucs: {e}")
                
    def _on_play_stem(self):
        """Play selected stem"""
        try:
            stem_name = self.stem_choice.currentText()
            # Map "music" to "no_vocals"
            actual_stem = "no_vocals" if stem_name == "music" else stem_name
            self.facade.play_stem(actual_stem)
        except Exception as e:
            from PyQt5.QtWidgets import QMessageBox
            QMessageBox.warning(self, "Warning", str(e))
            
    def _on_optimize_clicked(self):
        """Handle auto-optimize click."""
        mode = self.audio_mode_combo.currentData()
        self.optimization_status.setText("Analyzing...")
        if hasattr(self.facade, 'force_ui_update'):
            self.facade.force_ui_update()

        try:
            result = self.facade.run_smart_optimization(mode)
            
            exp = result.get('exponent')
            status = result.get('status')
            
            if status == 'fallback':
                self.optimization_status.setText(f"⚠ Low contrast. Defaulted to {exp}")
                self.optimization_status.setStyleSheet("color: orange;")
            else:
                self.optimization_status.setText(f"✔ Optimized to {exp}")
                self.optimization_status.setStyleSheet("color: green;")

            self.update_from_state(self.facade.get_current_state())
            self._on_process_audio()
            
        except Exception as e:
            self.optimization_status.setText("Error")
            self.optimization_status.setStyleSheet("color: red;")
            logger.error(f"Optimization failed: {e}")        
        
    def _on_process_audio(self):
        """Process audio through facade"""
        logger.info("_on_process_audio called")
        
        # Show processing status
        if self.use_stems_checkbox.isChecked():
            stem = self.stem_choice.currentText()
            self.audio_status_label.setText(f"Audio: Processing {stem}...")
        else:
            self.audio_status_label.setText("Audio: Processing...")
        self.audio_status_label.setStyleSheet("QLabel { color: #1e90ff; padding: 5px; }")
        
        try:
            # Update parameter manager with current UI values first
            self._on_audio_params_changed()
            
            # Force full recalculation when button is clicked
            result = self.facade.force_full_recalculation()
            
            if result:
                self.audio_status_label.setText("Audio: Processed and ready")
                self.audio_status_label.setStyleSheet("QLabel { color: #228b22; padding: 5px; }")
                
                # Preview update will happen automatically via observer pattern
                # Status update handled by observer
                
        except Exception as e:
            logger.error(f"Audio processing failed: {e}")
            self.audio_status_label.setText("Audio: Processing failed")
            self.audio_status_label.setStyleSheet("QLabel { color: #dc143c; padding: 5px; }")

            
            
    def _on_audio_params_changed(self):
        """Update audio parameters in facade"""
        try:
            # Update parameter manager with current UI values
            self.facade.parameter_manager.set_parameter("Audio.Processing.StartTime", self.start_time.value())
            self.facade.parameter_manager.set_parameter("Audio.Processing.EndTime", self.end_time.value())
            self.facade.parameter_manager.set_parameter("Audio.Processing.NumRawSamples", self.num_amplitudes.value())
            self.facade.parameter_manager.set_parameter("Audio.Processing.FilterAmount", self.filter_amount.value() / 100.0)
            self.facade.parameter_manager.set_parameter("Audio.Processing.SilenceThreshold", self.silence_threshold.value())
            self.facade.parameter_manager.set_parameter("Pattern.AmplitudeExponent", self.amplitude_exponent.value())
            self.facade.parameter_manager.set_parameter("Audio.Processing.SilenceDuration", self.silence_duration.value())
            self.facade.parameter_manager.set_parameter("Audio.Processing.UseStems", self.use_stems_checkbox.isChecked())
            # Map "music" to "no_vocals" for internal processing
            stem_choice = self.stem_choice.currentText()
            actual_stem = "no_vocals" if stem_choice == "music" else stem_choice
            self.facade.parameter_manager.set_parameter("Audio.Processing.StemChoice", actual_stem)
            self.facade.parameter_manager.set_parameter("Audio.Processing.ApplyFilter", self.filter_checkbox.isChecked())
            self.facade.parameter_manager.set_parameter("Audio.Processing.RemoveSilence", self.silence_checkbox.isChecked())
        except Exception as e:
            logger.error(f"Failed to update audio parameters: {e}")

    def _on_silence_checkbox_changed(self):
        """Handle silence removal checkbox change with smart detection."""
        # Always update the parameter
        self._on_audio_params_changed()
        
        # Only trigger reprocessing if auto-update is enabled and there's audio
        if not self._is_auto_update_enabled() or not self.facade.get_current_state().get('has_audio', False):
            self._previous_silence_state = self.silence_checkbox.isChecked()
            return
        
        state = self.facade.get_current_state()
        current_state = self.silence_checkbox.isChecked()
        
        if current_state:
            # Turning ON silence removal
            if not self._previous_silence_state:
                # Was OFF, now ON - always reprocess
                logger.info("Enabling silence removal - triggering reprocess")
                self._queue_audio_update()
            else:
                # Was already ON - check if parameters changed
                audio_file = state.get('audio_file_path', '')
                
                # Handle stem files if using stems
                if self.use_stems_checkbox.isChecked():
                    stem_paths = self.facade.audio_state_manager.get_stem_paths()
                    if stem_paths:
                        stem_choice = self.stem_choice.currentText()
                        actual_stem = "no_vocals" if stem_choice == "music" else stem_choice
                        stem_file = stem_paths.get(actual_stem)
                        if stem_file and os.path.exists(stem_file):
                            audio_file = stem_file
                
                if audio_file and os.path.exists(audio_file):
                    has_silence = self.facade.audio_orchestration.audio_loader.has_removable_silence(
                        file_path=audio_file,
                        start_time=self.start_time.value(),
                        duration=self.end_time.value() - self.start_time.value() if self.end_time.value() > self.start_time.value() else None,
                        threshold_db=self.silence_threshold.value(),
                        min_duration=self.silence_duration.value()
                    )
                    
                    if has_silence:
                        logger.info("Removable silence detected - triggering reprocess")
                        self._queue_audio_update()
                    else:
                        logger.info("No removable silence found - skipping reprocess")
                        self.audio_status_label.setText("Audio: No silence to remove")
                        self.audio_status_label.setStyleSheet("QLabel { color: #ff8c00; padding: 5px; }")
        else:
            # Turning OFF silence removal
            if self._previous_silence_state:
                logger.info("Disabling silence removal - triggering reprocess")
                self._queue_audio_update()
        
        # Update previous state
        self._previous_silence_state = current_state
        
    def _on_silence_param_changed(self):
        """Handle changes to silence parameters, triggering a reprocess only if enabled."""
        # First, always update the parameter manager with the new value.
        self._on_audio_params_changed()
        
        # Then, if silence removal is checked, queue an audio update.
        if self.silence_checkbox.isChecked():
            self._queue_audio_update()        
            
    def _on_binning_mode_changed(self, text):
        """Handle binning mode change"""
        mode_map = {
            "Mean Absolute": "mean_abs",
            "Min/Max": "min_max",
            "Continuous": "continuous"
        }
        self.facade.parameter_manager.set_parameter("Audio.Processing.BinningMode", mode_map[text])
        # Queue reprocessing if auto-update is enabled
        if self._is_auto_update_enabled() and self.facade.get_current_state().get('has_audio', False):
            self._queue_audio_update()
        
    def _on_stem_usage_changed(self):
        """Handle stem usage changes - requires reprocessing"""
        # Update parameters
        self._on_audio_params_changed()
        
        # If audio is already processed, reprocess with new stem settings
        if self.facade.get_current_state().get('has_audio', False):
            from PyQt5.QtWidgets import QMessageBox, QApplication
            from PyQt5.QtCore import Qt
            
            reply = QMessageBox.question(
                self,
                "Reprocess Audio",
                "Changing stem settings requires reprocessing audio. Continue?",
                QMessageBox.Yes | QMessageBox.No
            )
            
            if reply == QMessageBox.Yes:
                # Show processing cursor
                QApplication.setOverrideCursor(Qt.WaitCursor)
                try:
                    logger.info("Reprocessing audio due to stem change")
                    self._on_process_audio()
                    logger.info("Reprocessing complete")
                except Exception as e:
                    logger.error(f"Error during reprocessing: {e}")
                    QMessageBox.critical(self, "Error", f"Failed to reprocess: {str(e)}")
                finally:
                    QApplication.restoreOverrideCursor()    
        
    def update_from_state(self, state: dict):
        """Update UI from facade state."""
        # Block signals to prevent UI changes from re-triggering processing
        for widget in self.findChildren(QWidget):
            if hasattr(widget, 'blockSignals'):
                widget.blockSignals(True)

        # Update all widget values from the parameter manager
        pm = self.facade.parameter_manager
        self.start_time.setValue(pm.get_parameter_safe("Audio.Processing.StartTime", 0.0))
        self.end_time.setValue(pm.get_parameter_safe("Audio.Processing.EndTime", 30.0))
        self.silence_checkbox.setChecked(pm.get_parameter_safe("Audio.Processing.RemoveSilence", False))
        self.silence_threshold.setValue(pm.get_parameter_safe("Audio.Processing.SilenceThreshold", -35))
        self.silence_duration.setValue(pm.get_parameter_safe("Audio.Processing.SilenceDuration", 0.2))
        self.use_stems_checkbox.setChecked(pm.get_parameter_safe("Audio.Processing.UseStems", False))
        
        stem_choice = pm.get_parameter_safe("Audio.Processing.StemChoice", "vocals")
        ui_stem = "music" if stem_choice == "no_vocals" else stem_choice
        self.stem_choice.setCurrentText(ui_stem)
        
        self.num_amplitudes.setValue(pm.get_parameter_safe("Audio.Processing.NumRawSamples", 8192))
        self.filter_checkbox.setChecked(pm.get_parameter_safe("Audio.Processing.ApplyFilter", False))
        self.filter_amount.setValue(pm.get_parameter_safe("Audio.Processing.FilterAmount", 0.0) * 100.0)
        self.amplitude_exponent.setValue(pm.get_parameter_safe("Pattern.AmplitudeExponent", 1.0))
        
        mode_map_inv = {"mean_abs": "Mean Absolute", "min_max": "Min/Max", "continuous": "Continuous"}
        binning_val = pm.get_parameter_safe("Audio.Processing.BinningMode", "mean_abs")
        self.binning_mode_combo.setCurrentText(mode_map_inv.get(binning_val, "Mean Absolute"))

        # Unblock signals now that values are set
        for widget in self.findChildren(QWidget):
            if hasattr(widget, 'blockSignals'):
                widget.blockSignals(False)

        # Update audio status labels (this is the original part of the method)
        has_audio = state.get('has_audio', False)
        audio_file_path = state.get('audio_file_path', '')
         
        if not audio_file_path:
            self.audio_status_label.setText("Audio: Please load audio file")
            self.audio_status_label.setStyleSheet("QLabel { color: #666; padding: 5px; }")
        elif has_audio:
            filename = os.path.basename(audio_file_path)
            self.audio_status_label.setText(f"Audio: {filename} processed and ready")
            self.audio_status_label.setStyleSheet("QLabel { color: #228b22; padding: 5px; }")
        else:
            filename = os.path.basename(audio_file_path)
            self.audio_status_label.setText(f"Audio: {filename} loaded but not processed")
            self.audio_status_label.setStyleSheet("QLabel { color: #ff8c00; padding: 5px; }")
            
        processed_params = state.get('processed_audio_params', {})
        if processed_params:
            filename = processed_params.get('file_name', 'Unknown')
            start = processed_params.get('start_time', 0)
            end = processed_params.get('end_time', 0)
            
            if end > start:
                self.source_info_label.setText(f"Source: {filename} (Slice: {start:.2f}s - {end:.2f}s)")
            else:
                self.source_info_label.setText(f"Source: {filename} (Full audio)")
        else:
            self.source_info_label.setText("Source: No file loaded")            
    def _queue_param_update(self):
        """Queue parameter update only"""
        if not hasattr(self, '_initialized'):
            return
        self._on_audio_params_changed()
    
    def _queue_audio_update(self):
        """Queue full audio reprocessing with delay"""
        if not hasattr(self, '_initialized'):
            return
        if not self.facade.get_current_state().get('has_audio', False):
            return
        self._update_timer.stop()
        self._update_timer.start()
    
    def _is_auto_update_enabled(self):
        """Check if auto-update is enabled from settings or main window"""
        # First try to get from main window checkbox
        try:
            main_window = self.window()
            if hasattr(main_window, 'preview_panel') and hasattr(main_window.preview_panel, 'auto_update_checkbox'):
                return main_window.preview_panel.auto_update_checkbox.isChecked()
        except:
            pass
        
        # Fall back to settings
        settings = QSettings("WorshipWaves", "WaveformDesigner")
        return settings.value("auto_update_preview", True, type=bool)
        
    def _on_stem_progress(self, event):
        """Handle progress updates for stem separation."""
        
        progress_update = event.data.get('progress_update')
        if not isinstance(progress_update, ProgressUpdate):
            return
            
        # Check if this is our task
        if hasattr(self, '_stem_task_id') and progress_update.task_id == self._stem_task_id:
            # Update dialog
            if hasattr(self, '_progress_dialog') and self._progress_dialog:
                self._progress_dialog.update_progress(
                    progress_update.progress,
                    progress_update.message,
                    progress_update.details
                )
                
            # Handle completion
            if progress_update.status == TaskStatus.COMPLETED:
                if hasattr(self, '_progress_dialog') and self._progress_dialog:
                    self._progress_dialog.set_completed(True, "Stem separation complete")
                    self._progress_dialog = None
                # Retrieve results and update state
                stem_paths = self.facade.get_stem_separation_result(self._stem_task_id)
                if stem_paths:
                    self.audio_status_label.setText("Audio: Stem separation complete")
                    self.audio_status_label.setStyleSheet("QLabel { color: #228b22; padding: 5px; }")
                    
                    # If "Use Stems" is checked, trigger reprocessing
                    if self.use_stems_checkbox.isChecked():
                        logger.info("Stems available and checkbox checked - triggering reprocessing")
                        self._on_process_audio()
                else:
                    self.audio_status_label.setText("Audio: Stem separation failed to save results")
                    self.audio_status_label.setStyleSheet("QLabel { color: #dc143c; padding: 5px; }")
                # Unsubscribe
                self.facade.event_bus.unsubscribe(EventType.PROGRESS_UPDATE, self._on_stem_progress)
                # Refresh UI
                state = self.facade.get_current_state()
                self.update_from_state(state)
                
            elif progress_update.status == TaskStatus.FAILED:
                if hasattr(self, '_progress_dialog') and self._progress_dialog:
                    self._progress_dialog.set_completed(False, progress_update.message or "Stem separation failed")
                    self._progress_dialog = None
                    self.audio_status_label.setText("Audio: Stem separation failed")
                    self.audio_status_label.setStyleSheet("QLabel { color: #dc143c; padding: 5px; }")
                    QMessageBox.critical(self, "Error", progress_update.message or "Stem separation failed")
                    # Unsubscribe
                    self.facade.event_bus.unsubscribe(EventType.PROGRESS_UPDATE, self._on_stem_progress)
                
            elif progress_update.status == TaskStatus.CANCELLED:
                if hasattr(self, '_progress_dialog') and self._progress_dialog:
                    self._progress_dialog.set_cancelled()
                    self._progress_dialog = None
                self.audio_status_label.setText("Audio: Stem separation cancelled")
                self.audio_status_label.setStyleSheet("QLabel { color: #ff8c00; padding: 5px; }")
                # Unsubscribe
                self.facade.event_bus.unsubscribe(EventType.PROGRESS_UPDATE, self._on_stem_progress)
                
    def _cancel_stem_separation(self):
        """Cancel stem separation task."""
        if hasattr(self, '_stem_task_id'):
            self.facade.cancel_background_task(self._stem_task_id)  

    def _connect_error_handlers(self):
        """Connect to processing failed events for user feedback."""
        self.facade.event_bus.subscribe(
            EventType.PROCESSING_FAILED, 
            self._on_slice_validation_failed
        )
        # Also connect to value changes to clear error when user edits
        self.start_time.valueChanged.connect(self._clear_slice_error)
        self.end_time.valueChanged.connect(self._clear_slice_error)

    def _on_slice_validation_failed(self, event):
        """Handle slice validation failures."""
        error_msg = event.data.get('error', 'Unknown error')
        # Update the existing audio_status_label with error
        self.audio_status_label.setText(f"Error: {error_msg}")
        self.audio_status_label.setStyleSheet("QLabel { color: #ff0000; padding: 5px; }")
        # Store that we're in error state
        self._slice_error_active = True

    def _clear_slice_error(self):
        """Clear slice error when user changes values."""
        if hasattr(self, '_slice_error_active') and self._slice_error_active:
            self._slice_error_active = False
            self._restore_audio_status()

    def _restore_audio_status(self):
        """Restore audio status after error clears."""
        state = self.facade.get_current_state()
        has_audio = state.get('has_audio', False)
        audio_file_path = state.get('audio_file_path', '')
        
        if not audio_file_path:
            self.audio_status_label.setText("Audio: Please load audio file")
            self.audio_status_label.setStyleSheet("QLabel { color: #666; padding: 5px; }")
        elif has_audio:
            filename = os.path.basename(audio_file_path)
            self.audio_status_label.setText(f"Audio: {filename} processed and ready")
            self.audio_status_label.setStyleSheet("QLabel { color: #228b22; padding: 5px; }")
        else:
            filename = os.path.basename(audio_file_path)
            self.audio_status_label.setText(f"Audio: {filename} loaded but not processed")
            self.audio_status_label.setStyleSheet("QLabel { color: #ff8c00; padding: 5px; }")
```

## File: `C:\Users\paulj\WaveDesigner-refactor\core\algorithms\audio_processing.py`

```python
# audio_processor.py
"""
Contains the AudioProcessor class for handling audio loading,
resampling, binning, filtering, and peak control operations.
"""

import numpy as np
from typing import Tuple, Optional, Dict, Any

from core.contracts.audio_dto import WaveformData
from core.contracts.audio_processing_dto import BinningMode
from core.contracts.exceptions import ProcessingException, ValidationException


class AudioProcessor:
    """
    Pure audio processing functions for waveform manipulation.
    """

    def __init__(self):  # No logger parameter
        pass  # No logging setup
        
    def apply_peak_controls(
        self,
        amplitudes: np.ndarray,
        clip_enabled: bool,
        clip_value: float,
        compress_enabled: bool,
        compress_value: float,
        scale_enabled: bool,
        scale_threshold: float,
        scale_all_enabled: bool,
        scale_all_value: float,
        bit_diameter: float
    ) -> np.ndarray:
        """Apply peak control methods to amplitudes."""
        result = amplitudes.copy()
        
        if clip_enabled:
            result = self.clip_tallest_bin(result, clip_value)
        if compress_enabled:
            result = self.apply_compression(result, compress_value)
        if scale_enabled:
            result = self.scale_up_others(result, scale_threshold)
        if scale_all_enabled:
            result = result * scale_all_value
            
        # Ensure minimum amplitude
        result = np.maximum(result, bit_diameter * 2.0)
        
        return result

    def filter_data(self, amplitudes: np.ndarray, filter_amount: float) -> np.ndarray:
        """Filters data by subtracting average noise floor and renormalizing."""
        if len(amplitudes) == 0 or filter_amount <= 0:
            return amplitudes

        sorted_amps = np.sort(np.abs(amplitudes))
        n = max(1, int(len(sorted_amps) * filter_amount))
        noise_floor = np.mean(sorted_amps[:n])

        filtered = np.maximum(0, np.abs(amplitudes) - noise_floor)

        max_val = np.max(filtered)
        if max_val > 1e-9:
            filtered = filtered / max_val
        
        return filtered

    def analyze_and_optimize(self, samples: np.ndarray, num_slots: int, mode: str = "music") -> Dict[str, Any]:
        """Runs a grid search to find the best amplitude exponent."""
        if mode == "speech":
            binning_mode = BinningMode.MIN_MAX
            filter_amount = 0.05
            fallback_exp = 0.6
        else: # music
            binning_mode = BinningMode.MEAN_ABSOLUTE
            filter_amount = 0.02
            fallback_exp = 1.0

        resampled_samples = self._extract_amplitudes(samples, 200000)
        _, max_b = self.bin_amplitudes(resampled_samples, num_slots, binning_mode)
        baseline = max_b
        
        clean_data = self.filter_data(baseline, filter_amount)
        
        rec_threshold = -40
        if mode == "speech":
            abs_samples = np.abs(resampled_samples)
            non_zeros = abs_samples[abs_samples > 1e-5]
            if len(non_zeros) > 0:
                noise_floor_db = 20 * np.log10(np.percentile(non_zeros, 15))
                rec_threshold = int(max(-60, min(-10, noise_floor_db + 4)))

        if mode == "speech":
            candidates = [0.8, 0.6, 0.45, 0.35, 0.25]
        else: # music
            candidates = [1.0, 0.9, 0.8, 0.7, 0.6]

        best_score = -float('inf')
        best_exp = fallback_exp
        logs = []

        for exp in candidates:
            test_data = np.power(clean_data, exp)
            
            p10 = np.percentile(test_data, 10)
            p90 = np.percentile(test_data, 90)
            spread = p90 - p10
            
            brick_pct = np.sum(test_data > 0.95) / len(test_data)
            ghost_pct = np.sum(test_data < 0.15) / len(test_data)
            
            score = spread - (brick_pct * 2.0) - (ghost_pct * 1.5)
            logs.append(f"Exp {exp}: Score={score:.3f} (Spread={spread:.2f}, Brick={brick_pct:.2f}, Ghost={ghost_pct:.2f})")
            
            if score > best_score:
                best_score = score
                best_exp = exp

        status = "optimized"
        if best_score < -0.1:
            logs.append(f"WARNING: Low quality score ({best_score:.3f}). Using fallback {fallback_exp}")
            best_exp = fallback_exp
            status = "fallback"

        return {
            "exponent": best_exp,
            "filter_amount": filter_amount,
            "silence_threshold": rec_threshold,
            "score": best_score,
            "status": status,
            "logs": logs
        }

    def process_waveform(self, waveform_data: WaveformData, num_amplitudes: int) -> np.ndarray:
        """Process waveform data to extract and normalize amplitudes."""
        return self._extract_amplitudes(waveform_data.samples, num_amplitudes)

    def _extract_amplitudes(self, y: np.ndarray, num_amplitudes: int) -> np.ndarray:
        """Converts to mono, normalizes [-1,1], resamples."""
        # Work on a copy to preserve immutability
        y_work = y.copy()
        
        if y_work.ndim > 1:
            y_work = np.mean(y_work, axis=1)
        max_abs = np.max(np.abs(y_work))
        if max_abs > 1e-9:
            y_work = y_work / max_abs
        else:
            y_work = np.zeros_like(y_work)

        current_len = len(y_work)
        if current_len == num_amplitudes or current_len == 0:
            return y_work

        target_indices = np.linspace(0, current_len - 1, num_amplitudes)
        if current_len > num_amplitudes:
            y_work = y_work[target_indices.astype(int)]
        else:
            y_work = np.interp(target_indices, np.arange(current_len), y_work)
        return y_work

    def bin_amplitudes(self, amplitudes: np.ndarray, num_slots: int, 
                       mode: BinningMode) -> Tuple[np.ndarray, np.ndarray]:
        """
        Bins amplitudes and returns min/max arrays based on mode.
        
        Returns:
            Tuple of (min_amplitudes, max_amplitudes)
            For MEAN_ABSOLUTE mode, both arrays are identical
        """

        if amplitudes is None or len(amplitudes) == 0:
            return np.zeros(num_slots), np.zeros(num_slots)

        if num_slots <= 0:
            raise ValidationException("Number of slots must be positive")

        min_binned_data = np.zeros(num_slots)
        max_binned_data = np.zeros(num_slots)

        if mode == BinningMode.CONTINUOUS:
            # Check if we have gaps from silence removal
            ratio = len(amplitudes) / num_slots if num_slots > 0 else 0
            will_fallback = len(amplitudes) < num_slots * 0.8
            
            if will_fallback:  # Less than 80% of expected samples
                return self.bin_amplitudes(amplitudes, num_slots, BinningMode.MEAN_ABSOLUTE)
                
            # Direct resampling, no binning
            # Use interpolation for smooth continuous waveform
            if len(amplitudes) != num_slots:
                old_indices = np.arange(len(amplitudes))
                new_indices = np.linspace(0, len(amplitudes)-1, num_slots)
                resampled = np.interp(new_indices, old_indices, amplitudes)
            else:
                resampled = amplitudes.copy()
            
            # Split positive/negative for visualization
            for i in range(num_slots):
                if resampled[i] >= 0:
                    min_binned_data[i] = 0
                    max_binned_data[i] = resampled[i]
                else:
                    min_binned_data[i] = resampled[i]
                    max_binned_data[i] = 0
        else:
            # Binning approaches (MEAN_ABSOLUTE and MIN_MAX)
            num_total_amplitudes = len(amplitudes)
            bin_size = num_total_amplitudes / float(num_slots)

            for i in range(num_slots):
                start_idx = int(round(i * bin_size))
                end_idx = int(round((i + 1) * bin_size))
                
                if start_idx >= num_total_amplitudes:
                    continue
                
                end_idx = min(end_idx, num_total_amplitudes)
                if start_idx >= end_idx:
                    continue

                slice_data = amplitudes[start_idx:end_idx]

                if len(slice_data) > 0:
                    if mode == BinningMode.MEAN_ABSOLUTE:
                        binned_value = np.mean(np.abs(slice_data))
                        min_binned_data[i] = -binned_value  # Symmetric
                        max_binned_data[i] = binned_value
                    elif mode == BinningMode.MIN_MAX:
                        min_binned_data[i] = np.min(slice_data)
                        max_binned_data[i] = np.max(slice_data)

        # For MEAN_ABSOLUTE, create symmetric values for backward compatibility
        if mode == BinningMode.MEAN_ABSOLUTE:
            # Normalize to [0, 1] but keep symmetry
            max_val = np.max(np.abs(max_binned_data))
            if max_val > 1e-9:
                # Keep negative/positive symmetry after normalization
                min_normalized = min_binned_data / max_val  # Will be negative
                max_normalized = max_binned_data / max_val  # Will be positive
            else:
                min_normalized = np.zeros_like(min_binned_data)
                max_normalized = np.zeros_like(max_binned_data)
        else:
            # For MIN_MAX and CONTINUOUS, preserve negative values
            # Normalize to maintain relative scale but keep signs
            all_values = np.concatenate([min_binned_data, max_binned_data])
            max_abs = np.max(np.abs(all_values))
            
            if max_abs > 1e-9:
                min_normalized = min_binned_data / max_abs
                max_normalized = max_binned_data / max_abs
            else:
                min_normalized = np.zeros_like(min_binned_data)
                max_normalized = np.zeros_like(max_binned_data)

        return min_normalized, max_normalized

    def filter_data(self, amplitudes: np.ndarray, filter_amount: float) -> np.ndarray:
        """Filters data by subtracting average noise floor."""
        if amplitudes is None or len(amplitudes) == 0:
            return np.array([])
        # Operate on the input array directly (usually the normalized 0-1 amps)
        temp_amps = np.sort(amplitudes.copy())  # Sort a copy to preserve input
        n = max(1, int(len(temp_amps) * filter_amount))
        average_noise = np.mean(temp_amps[:n])
        # Subtract noise and clip at 0
        filtered_amps = np.maximum(0, amplitudes - average_noise)
        # Optional Rescaling: Rescale so the max value after filtering matches the original max
        max_orig = np.max(amplitudes)
        max_filt = np.max(filtered_amps)
        if max_filt > 1e-9:
            filtered_amps = filtered_amps * (max_orig / max_filt)
        return filtered_amps

    def apply_artistic_scaling(self, amplitudes: np.ndarray, exponent: float) -> np.ndarray:
        """Apply artistic scaling using power function.
        
        Args:
            amplitudes: Input amplitude array
            exponent: Power exponent for scaling (1.0 = linear)
            
        Returns:
            Scaled amplitude array (input is not mutated)
        """
        # Create copy to ensure immutability
        result = amplitudes.copy()
        # Apply power scaling
        return np.power(result, exponent)

    def apply_roll_start(self, amplitudes: np.ndarray, roll_start: int) -> np.ndarray:
        """Applies circular shift."""
        if roll_start == 0 or amplitudes is None or len(amplitudes) == 0:
            return amplitudes
        return np.roll(amplitudes, roll_start)
        
    # --- Peak control methods (operate on whatever amplitude array is passed in) ---
    def clip_tallest_bin(self, amplitudes: np.ndarray, percentage: float) -> np.ndarray:
        if amplitudes is None or len(amplitudes) == 0:
            return np.array([])
        max_val = np.max(amplitudes)
        if max_val <= 0:
            return amplitudes  # Avoid issues if max is zero or negative
        max_allowed = percentage * max_val
        return np.minimum(amplitudes, max_allowed)

    def apply_compression(self, amplitudes: np.ndarray, exponent: float) -> np.ndarray:
        if amplitudes is None or len(amplitudes) == 0:
            return np.array([])
        min_amp = np.min(amplitudes)
        max_amp = np.max(amplitudes)
        range_original = max_amp - min_amp
        if range_original < 1e-9:
            return amplitudes
        temp_amps = (amplitudes - min_amp) / range_original
        compressed = temp_amps**exponent
        compressed = compressed * range_original + min_amp
        return compressed

    def scale_up_others(self, amplitudes: np.ndarray, threshold_pct: float) -> np.ndarray:
        if amplitudes is None or len(amplitudes) == 0:
            return np.array([])
        peak = np.max(amplitudes)
        threshold = threshold_pct * peak
        if threshold < 1e-9 or peak < 1e-9:
            return amplitudes
        scale_factor = peak / threshold
        scaled = np.where(amplitudes < threshold, amplitudes * scale_factor, threshold)
        return scaled
```

## File: `C:\Users\paulj\WaveDesigner-refactor\services\audio_orchestration_service.py`

```python
"""Service to orchestrate audio processing workflow."""

import logging
import os
from typing import Optional, Dict, Any, List, Tuple

import numpy as np

from core.contracts.audio_dto import AudioResultDTO,  WaveformData
from core.contracts.audio_processing_dto import AudioProcessingRequest
from core.contracts.design_dto import DesignParametersDTO
from core.contracts.exceptions import ValidationException, ProcessingException, AdapterException
from adapters.audio.audio_file import AudioFileAdapter
from adapters.audio.audio_loader import AudioLoaderAdapter
from adapters.audio.audio_playback import AudioPlaybackAdapter
from parameters.parameter_manager import ParameterManager
from services.audio_pipeline_service import AudioPipelineService
from services.audio_state_manager import AudioStateManager
from services.state_coordinator import StateCoordinator
from services.geometry_cache import GeometryCache
from services.geometry_service import GeometryService
from services.event_bus import EventBus, Event, EventType, ProcessingCompleteEvent, PreviewUpdatedEvent

logger = logging.getLogger(__name__)


class AudioOrchestrationService:
    """Orchestrates audio processing workflow according to architecture."""
    
    def __init__(
        self,
        parameter_manager: ParameterManager,
        state_coordinator: StateCoordinator,
        audio_state_manager: AudioStateManager,
        geometry_cache: GeometryCache,
        geometry_service: GeometryService,
        audio_pipeline: AudioPipelineService,
        audio_loader: AudioLoaderAdapter,
        event_bus: EventBus,
        parameter_service: 'ParameterService',  # ADD THIS
        reference_service: 'ReferenceStateService',  # ADD THIS
        audio_file_adapter: Optional[AudioFileAdapter] = None
    ):
        self.parameter_manager = parameter_manager
        self.state_coordinator = state_coordinator
        self.audio_state_manager = audio_state_manager
        self.geometry_cache = geometry_cache
        self.geometry_service = geometry_service
        self.audio_pipeline = audio_pipeline
        self.audio_loader = audio_loader
        self.event_bus = event_bus
        self.parameter_service = parameter_service
        self.reference_service = reference_service
        self.audio_file_adapter = audio_file_adapter or AudioFileAdapter()
        self._cached_silence_intervals = {}
        self._silence_cache_max_size = 10
        
    def process_audio(
        self,
        request_params: Optional[Dict[str, Any]],
        design_params: DesignParametersDTO
    ) -> AudioResultDTO:
        """Process audio file with given parameters."""

        # Build processing request
        processing_request = self._build_processing_request(request_params)
        # Validate per architecture policy
        processing_request.validate()        
        
        logger.info(f"[AUDIO PIPELINE TESTING - START] Processing audio with params: "
                   f"use_stems={processing_request.use_stems}, "
                   f"stem_choice={processing_request.stem_choice}, "
                   f"remove_silence={processing_request.remove_silence}, "
                   f"file={os.path.basename(processing_request.file_path)}")
        
        # Update parameter manager
        self._update_parameters(processing_request)
        
        # Load audio
        # For stems, apply silence removal after loading (stems are pre-sliced)
        should_remove_silence = processing_request.remove_silence
        if processing_request.use_stems and self.audio_state_manager.get_stem_paths():
            # Don't remove silence during load for stems
            waveform_data = self.audio_loader.load_audio(
                file_path=processing_request.file_path,
                start_time=0,  # Stems are already sliced
                duration=None,
                remove_silence=False,  # Apply later if needed
                silence_threshold_db=processing_request.silence_threshold_db,
                silence_min_duration=processing_request.silence_min_duration
            )
            # Apply silence removal as post-processing
            if should_remove_silence:
                waveform_data = self._apply_silence_removal(
                    waveform_data,
                    processing_request.silence_threshold_db,
                    processing_request.silence_min_duration
                )
        else:
            # Normal path - remove silence during load
            waveform_data = self.audio_loader.load_audio(
                file_path=processing_request.file_path,
                start_time=processing_request.start_time,
                duration=processing_request.duration,
                remove_silence=processing_request.remove_silence,
                silence_threshold_db=processing_request.silence_threshold_db,
                silence_min_duration=processing_request.silence_min_duration
            )
        
        # Calculate geometry
        logger.info("[DEBUG 5] ORCHESTRATION SERVICE: About to calculate geometry for working design.")
        geometry = self.geometry_service.calculate_geometries_dto(design_params)
        
        # Process through pipeline
        audio_result = self.audio_pipeline.process_pipeline(
            waveform_data,
            processing_request,
            geometry,
            force=False  # Enable cache per architecture policy
        )
        
        # Build processed params
        processed_params = self._build_processed_params(processing_request)
        
        # Update all state before notifying
        self._update_state(
            audio_result,
            processing_request,
            processed_params,
            geometry,
            design_params
        )
        
        # Generate preview with the now-updated state
        preview_data = self.geometry_service.generate_preview(
            self.geometry_cache.frame,
            self.geometry_cache.slots
        )
        self.geometry_cache.update_preview(preview_data)

        # Publish events with the complete, correct payload
        event_payload = {
            'preview_data': preview_data,
            'geometry': self.geometry_cache.geometry,
            'audio_result': self.state_coordinator.current_audio_result
        }
        self.event_bus.publish(Event(type=EventType.PREVIEW_UPDATED, data=event_payload))
        logger.info("[AUTO-UPDATE] Publishing ProcessingCompleteEvent")
        self.event_bus.publish(ProcessingCompleteEvent(audio_result))
        logger.info("[AUTO-UPDATE] ProcessingCompleteEvent published")
        
        # Generate preview after audio processing
        from services.preview_generation_service import PreviewGenerationService
        if hasattr(self, 'preview_service') and self.preview_service:
            logger.info("[AUTO-UPDATE] Calling preview_service.regenerate_preview() directly")
            self.preview_service.regenerate_preview()
        
        # Add completion logging
        logger.info(f"[AUDIO PIPELINE TESTING - COMPLETE] "
                   f"Processing complete, "
                   f"silence_removed={processing_request.remove_silence}, "
                   f"source={'stem_' + processing_request.stem_choice if processing_request.use_stems else 'raw'}")
        
        # Return DTO ensures immutability per architecture policy
        return audio_result
        
    def run_smart_optimization(self, mode: str) -> Dict[str, Any]:
        """Runs audio analysis and updates ParameterManager settings."""
        file_path = self.audio_state_manager.get_audio_file_path()
        if not file_path:
            raise ValidationException("No audio file loaded")

        waveform = self.audio_loader.load_audio(file_path)
        num_slots = self.parameter_manager.get_parameter("Pattern.NumberSlots")

        result = self.audio_pipeline.audio_processor.analyze_and_optimize(
            waveform.samples, num_slots, mode
        )

        self.parameter_manager.set_parameter("Pattern.AmplitudeExponent", float(result['exponent']))
        self.parameter_manager.set_parameter("Audio.Processing.FilterAmount", float(result['filter_amount']))
        
        if mode == "speech":
            self.parameter_manager.set_parameter("Audio.Processing.BinningMode", "min_max")
            self.parameter_manager.set_parameter("Audio.Processing.RemoveSilence", True)
            self.parameter_manager.set_parameter("Audio.Processing.SilenceThreshold", result.get('silence_threshold', -40))
            self.parameter_manager.set_parameter("Audio.Processing.SilenceDuration", 0.2)
        else:
            self.parameter_manager.set_parameter("Audio.Processing.BinningMode", "mean_abs")
            self.parameter_manager.set_parameter("Audio.Processing.RemoveSilence", False)

        for log_line in result.get('logs', []):
            logger.info(f"[OPTIMIZER] {log_line}")
        logger.info(f"[OPTIMIZER] Applied settings: Exp={result['exponent']}, Filter={result['filter_amount']}")

        return result    
        
    def process_audio_with_reference(self, request_params: Optional[dict] = None) -> AudioResultDTO:
        """Process audio file with automatic reference creation."""
        try:
            design_params = self.parameter_service.get_design_parameters()
            audio_result = self.process_audio(request_params, design_params)
            
            # Import locally to avoid circular dependency
            from services.reference_state_service import ReferenceStateService
            
            # Create initial n=1 reference if needed
            if hasattr(self, 'reference_service'):
                ref_service = self.reference_service
            else:
                # Get from event bus if available
                ref_service = None
                for attr_name in dir(self):
                    attr = getattr(self, attr_name)
                    if isinstance(attr, ReferenceStateService):
                        ref_service = attr
                        break
                        
            if ref_service and not ref_service.get_all_states() and design_params.slot_style != 'linear':
                current_audio_params = self.parameter_service.get_audio_parameters(
                    self.audio_state_manager.get_audio_file_path()
                )
                ref_service.create_n1_reference(
                    design_params,
                    current_audio_params,
                    self.parameter_manager
                )
                
            return audio_result
            
        except (ValidationException, ProcessingException):
            raise
        except Exception as e:
            logger.error(f"Unexpected error processing audio: {e}", exc_info=True)
            raise ProcessingException(f"Audio processing failed: {e}")    
        
    def set_audio_file(self, file_path: str) -> None:
        """Set the audio file path and clear all relevant state."""
        # Set the file in the new state manager
        self.audio_state_manager.set_audio_file(file_path)
        
        # Clear processing results only, preserve file paths
        self.audio_state_manager.clear_processing_results()
        self.state_coordinator.clear_processing_state()
        
        from services.event_bus import GeometryClearedEvent, AudioFileChangedEvent
        self.event_bus.publish(GeometryClearedEvent())
        self.event_bus.publish(AudioFileChangedEvent(file_path))
        
    def _make_silence_cache_key(
        self, 
        waveform_data: 'WaveformData',
        threshold_db: float,
        min_duration: float
    ) -> str:
        """Generate cache key for silence intervals."""
        import hashlib
        key_parts = [
            str(len(waveform_data.samples)),
            str(waveform_data.sample_rate),
            str(threshold_db),
            str(min_duration),
            str(np.mean(waveform_data.samples[:1000]))  # Sample signature
        ]
        return hashlib.md5('|'.join(key_parts).encode()).hexdigest()
    
    def _detect_silence_intervals(
        self,
        samples: np.ndarray,
        sample_rate: int,
        threshold_db: float,
        min_duration: float
    ) -> List[Tuple[int, int]]:
        """Detect and merge silence intervals."""
        import librosa
        
        intervals = librosa.effects.split(
            samples, top_db=-threshold_db, 
            frame_length=2048, hop_length=512
        )
        
        if len(intervals) == 0:
            return []
            
        min_samples = int(min_duration * sample_rate)
        merged_intervals = []
        
        for start, end in intervals:
            if end - start < min_samples:
                continue
            if merged_intervals and start - merged_intervals[-1][1] < min_samples:
                merged_intervals[-1] = (merged_intervals[-1][0], end)
            else:
                merged_intervals.append((start, end))
                
        return merged_intervals
    
    def _cache_silence_intervals(
        self,
        cache_key: str,
        intervals: List[Tuple[int, int]]
    ) -> None:
        """Cache silence intervals with LRU eviction."""
        self._cached_silence_intervals[cache_key] = intervals
        
        # LRU eviction
        if len(self._cached_silence_intervals) > self._silence_cache_max_size:
            # Remove oldest (first) entry
            oldest_key = next(iter(self._cached_silence_intervals))
            del self._cached_silence_intervals[oldest_key]
            logger.debug(f"[SILENCE-CACHE] Evicted oldest entry")        
        
    def play_audio_slice(self, start_time: float, end_time: float) -> None:
        """Play audio slice from start to end time."""
        audio_file = self.audio_state_manager.get_audio_file_path()
        if not audio_file:
            logger.warning("No audio file loaded")
            self.event_bus.publish(Event(type=EventType.PROCESSING_FAILED, data={'error': 'No audio file loaded'}))
            return
        
        playback_adapter = AudioPlaybackAdapter()
        temp_path = None
        
        try:
            logger.info(f"Creating audio slice from {start_time}s to {end_time}s")
            temp_path = self.audio_file_adapter.create_audio_slice(
                audio_file,
                start_time,
                end_time
            )
            logger.info(f"Audio slice created at: {temp_path}")
            playback_adapter.play_file(temp_path)
            
        except AdapterException as e:
            error_msg = str(e)
            logger.error(f"Failed to create audio slice: {error_msg}")
            self.event_bus.publish(Event(type=EventType.PROCESSING_FAILED, data={'error': error_msg}))
            
        except Exception as e:
            error_msg = f"Failed to play slice: {str(e)}"
            logger.error(error_msg)
            self.event_bus.publish(Event(type=EventType.PROCESSING_FAILED, data={'error': error_msg}))
            
        finally:
            if temp_path:
                logger.info(f"Cleaning up temp file: {temp_path}")
                self.audio_file_adapter.cleanup_temp_file(temp_path)
                
    def _build_processing_request(
        self,
        request_params: Optional[Dict[str, Any]]
    ) -> AudioProcessingRequest:
        """Build processing request from parameters."""
        # Get the definitive file path from the state manager.
        file_path = self.audio_state_manager.get_original_audio_file() or self.audio_state_manager.get_audio_file_path()

        if not file_path:
            raise ValidationException("No audio file path provided")

        # Get ALL current parameters from the single source of truth.
        all_params = self.parameter_manager.get_all_parameters()

        # Update the file path in the parameters dictionary.
        all_params['file_path'] = file_path

        # Handle stem files.
        use_stems = all_params.get('Audio.Processing.UseStems', False)
        stem_choice = all_params.get('Audio.Processing.StemChoice', 'vocals')
        
        # Resolve the actual file to be processed (original or stem).
        actual_file_path = self._resolve_stem_file(
            file_path,
            use_stems,
            stem_choice
        )
        all_params['file_path'] = actual_file_path
        
        # Calculate duration
        start_time = all_params.get('Audio.Processing.StartTime', 0.0)
        end_time = all_params.get('Audio.Processing.EndTime', 0.0)
        all_params['duration'] = end_time - start_time if end_time > start_time else None
        
        # Log the UI state before creating request
        logger.info(f"[SILENCE-DECISION] Building request - UI checkbox state: {all_params.get('Audio.Processing.RemoveSilence')}, "
                   f"stems enabled: {use_stems}, stem choice: {stem_choice}")

        # Create the request DTO directly from the comprehensive parameter dictionary.parameter dictionary.
        # The from_parameters classmethod will correctly extract all necessary fields.
        logger.info(f"[MIN-AMP-DEBUG] Building request with MinimumAmplitude from manager: {all_params.get('Pattern.MinimumAmplitude')}")
        return AudioProcessingRequest.from_parameters(all_params)
        
    def _merge_parameters(
        self,
        request_params: Dict[str, Any],
        file_path: str
    ) -> Dict[str, Any]:
        """
        DEPRECATED: This method is no longer needed and will be removed.
        The logic has been simplified and moved into _build_processing_request.
        """
        # This method can be completely removed or left empty.
        # For safety, we'll have it return an empty dict to avoid breaking any unexpected calls.
        return {}
        
    def _resolve_stem_file(
        self,
        file_path: str,
        use_stems: bool,
        stem_choice: str
    ) -> str:
        """Resolve actual file path for stem processing."""
        logger.info(f"[AUDIO PIPELINE TESTING - SOURCE] Resolving source: "
                   f"use_stems={use_stems}, stem_choice={stem_choice}, "
                   f"cached_silence_intervals={'exists' if self._cached_silence_intervals else 'none'}")
        
        if not use_stems:
            # Return the original audio file when not using stems
            original_file = self.audio_state_manager.get_original_audio_file()
            if original_file:
                logger.debug(f"[SILENCE-CACHE] Switching to raw audio: {original_file}")
                return original_file
            logger.debug("[SILENCE-CACHE] Switching to raw audio")
            return file_path
            
        # Check if stems need invalidation
        if self._should_invalidate_stems():
            logger.info("Stem parameters changed - clearing stems")
            self.state_coordinator.clear_processing_state()
            logger.info(f"[CACHE-CLEAR] Clearing silence cache - was type {type(self._cached_silence_intervals)}")
            self._cached_silence_intervals = {}
            return file_path
            
        stem_paths = self.audio_state_manager.get_stem_paths()
        if not stem_paths:
            return file_path
            
        stem_file = stem_paths.get(stem_choice)
        if stem_file and os.path.exists(stem_file):
            logger.info(f"Using stem file: {stem_choice} - {stem_file}")
            logger.debug(f"[SILENCE-CACHE] Using stem: {stem_choice}")
            return stem_file
        else:
            logger.warning(f"Stem {stem_choice} not found, using original file")
            return file_path
            
    def _apply_silence_removal(
        self,
        waveform_data: 'WaveformData',
        threshold_db: float,
        min_duration: float
    ) -> 'WaveformData':
        """Apply silence removal to already-loaded waveform data."""
       
        # Check cache for this source
        cache_key = self._make_silence_cache_key(
            waveform_data, threshold_db, min_duration
        )
        
        if cache_key in self._cached_silence_intervals:
            logger.info("[SILENCE-CACHE] Using cached silence intervals")
            intervals = self._cached_silence_intervals[cache_key]
        else:
            intervals = self._detect_silence_intervals(
                waveform_data.samples, 
                waveform_data.sample_rate,
                threshold_db, 
                min_duration
            )
            self._cache_silence_intervals(cache_key, intervals)
        
        logger.info(f"[AUDIO PIPELINE TESTING - SILENCE APPLY] "
                   f"Applying silence removal to {len(waveform_data.samples)} samples, "
                   f"clearing cached intervals")
        
        # Apply cached or detected intervals
        y = waveform_data.samples
        sr = waveform_data.sample_rate
        
        if not intervals:
            return waveform_data
            
        merged_intervals = intervals  # Already processed
            
        # Concatenate non-silent parts
        non_silent_parts = []
        for start, end in merged_intervals:
            non_silent_parts.append(y[start:end])
            
        processed_samples = np.concatenate(non_silent_parts) if non_silent_parts else y
        
        logger.info(f"[SILENCE-SAMPLES] Before: {len(y)} samples, After: {len(processed_samples)} samples, "
                   f"Removed: {len(y) - len(processed_samples)} samples")
        
        # Calculate new duration
        new_duration = len(processed_samples) / sr if sr > 0 else 0.0
        new_duration = len(processed_samples) / sr if sr > 0 else 0.0
        
        return WaveformData(
            samples=processed_samples,
            sample_rate=sr,
            duration=new_duration
        )        
            
    def _should_invalidate_stems(self) -> bool:
        """Check if stems should be invalidated due to parameter changes."""
        gen_params = self.audio_state_manager._stem_generation_params
        if not gen_params:
            return False
            
        current_start = self.parameter_manager.get_parameter("Audio.Processing.StartTime")
        current_end = self.parameter_manager.get_parameter("Audio.Processing.EndTime")
        
        # Invalidate if slice parameters changed
        if (gen_params.get('start_time') != current_start or 
            gen_params.get('end_time') != current_end):
            return True
            
        # Note: Remove silence is applied POST-stem separation
        # But we still need to track if it changed
        return False
        
    def _update_parameters(self, request: AudioProcessingRequest) -> None:
        """Update parameter manager from request."""        
            
    def _update_parameters(self, request: AudioProcessingRequest) -> None:
        """Update parameter manager from request."""
        param_map = {
            'use_stems': "Audio.Processing.UseStems",
            'stem_choice': "Audio.Processing.StemChoice",
            'remove_silence': "Audio.Processing.RemoveSilence",
            'num_raw_samples': "Audio.Processing.NumRawSamples",
            'start_time': "Audio.Processing.StartTime",
            'silence_threshold': "Audio.Processing.SilenceThreshold",
            'silence_duration': "Audio.Processing.SilenceDuration",
            'filter_amount': "Audio.Processing.FilterAmount",
            'amplitude_exponent': "Pattern.AmplitudeExponent"
        }
        
        for attr, param_id in param_map.items():
            value = getattr(request, attr, None)
            if value is not None:
                self.parameter_manager.set_parameter(param_id, value)
                
        # Calculate end time
        end_time = request.start_time + (request.duration or 0)
        self.parameter_manager.set_parameter("Audio.Processing.EndTime", end_time)

    def _build_processed_params(self, request: AudioProcessingRequest) -> Dict[str, Any]:
        """Build processed parameters dictionary using the DTO method."""
        has_stems = bool(self.audio_state_manager.get_stem_paths())
        return request.to_processed_params(has_stems=has_stems)
        
    def _would_silence_removal_change_audio(
        self,
        file_path: str,
        start_time: float,
        duration: Optional[float],
        threshold_db: float,
        min_duration: float
    ) -> bool:
        """Check if silence removal would actually change the audio."""
        logger.info(f"[SILENCE-DETECT-START] Checking {os.path.basename(file_path)} for removable silence: "
                   f"threshold={threshold_db}dB, min_duration={min_duration}s")
        result = self.audio_loader.has_removable_silence(
            file_path,
            start_time,
            duration,
            threshold_db,
            min_duration
        )
        logger.info(f"[SILENCE-DETECT-RESULT] Detection complete for {os.path.basename(file_path)}: "
                   f"would_change={result}")
        logger.info(f"[AUDIO PIPELINE TESTING - SILENCE CHECK] "
                   f"Checking silence for {os.path.basename(file_path)}: "
                   f"would_change={result}")
        return result
        
        
        
    def _update_state(
        self,
        audio_result: AudioResultDTO,
        processing_request: AudioProcessingRequest,
        processed_params: Dict[str, Any],
        geometry: Any,
        design_params: DesignParametersDTO
    ) -> None:
        """Update all state managers."""
        # Update audio state manager
        new_state = self.audio_state_manager.update_audio_result(
            audio_result,
            geometry,
            processing_request.file_path,
            processed_params,
            processing_request
        )
        
        # Update state coordinator
        self.state_coordinator.update_audio_result(
            audio_result,
            processing_request,
            processed_params
        )
        
        # Update geometry cache
        self.geometry_cache.update_geometry(geometry)
        frame = self.geometry_service.create_frame_geometry(design_params)
        self.geometry_cache.update_frame(frame)
        
        # Calculate slots
        current_nudges = new_state.slot_nudges
        slot_coords, dovetail_paths = self.geometry_service.calculate_slot_coordinates(
            audio_result.scaled_amplitudes,
            design_params,
            geometry,
            current_nudges,
            design_params.visual_correction_mode if design_params.apply_visual_correction else "nudge_adj",
            design_params.visual_correction_scale if design_params.apply_visual_correction else 0.0,
            audio_result.min_amplitudes,
            audio_result.max_amplitudes
        )
        self.geometry_cache.update_slots(slot_coords, dovetail_paths)
        self.state_coordinator.update_nudges(current_nudges)
```

## File: `C:\Users\paulj\WaveDesigner-refactor\services\audio_pipeline_service.py`

```python
"""Stateless audio processing pipeline service."""

import logging
import time
from typing import Optional, Tuple

import numpy as np

from core.contracts.service_interfaces import AudioProcessorContract
from core.contracts.audio_dto import WaveformData, AudioResultDTO
from core.contracts.audio_processing_dto import AudioProcessingRequest, AudioProcessingStage, BinningMode
from core.contracts.design_dto import GeometryResultDTO
from core.algorithms.audio_processing import AudioProcessor

logger = logging.getLogger(__name__)


class AudioPipelineService:
    """Orchestrates audio processing pipeline with pure functions."""
    
    def __init__(
        self,
        audio_processor: Optional[AudioProcessorContract] = None,
        cache: Optional['AudioProcessingCache'] = None
    ):
        """
        Initialize with injected dependencies.
        
        Args:
            audio_processor: Audio processing implementation
            cache: Cache implementation for pipeline results
        """
        self.audio_processor = audio_processor or AudioProcessor()
        if cache is None:
            from services.audio_processing_cache import AudioProcessingCache
            cache = AudioProcessingCache()
        self._cache = cache
        
    def process_pipeline(
        self,
        waveform_data: WaveformData,
        request: AudioProcessingRequest,
        geometry: GeometryResultDTO,
        force: bool = False
    ) -> AudioResultDTO:
        """Process audio through immutable pipeline stages."""        
        # Check cache first
        start_time = time.time()
        if not force:
            cached_result = self._cache.get_cached_result_with_geometry(request, geometry.max_amplitude_local)
            if cached_result:
                logger.info("[CACHE-HIT] Using cached audio processing result")
                return cached_result
        
        # Stage 1: Resample
        raw_amplitudes = self._resample_stage(
            waveform_data.samples,
            request.num_raw_samples
        )
        
        # Stage 2: Bin
        # Get binning mode from request or default
        from core.contracts.audio_processing_dto import BinningMode
        binning_mode = request.binning_mode if hasattr(request, 'binning_mode') and request.binning_mode else BinningMode.MEAN_ABSOLUTE
        
        # Log warning if using continuous mode with silence removal
        if binning_mode == BinningMode.CONTINUOUS and request.remove_silence:
            logger.warning("Continuous binning with silence removal - may auto-fallback to mean_abs")
        
        min_normalized, max_normalized = self._binning_stage(
            raw_amplitudes,
            geometry.num_slots,
            binning_mode
        )
        # For backward compatibility, normalized_amplitudes uses max values
        normalized = max_normalized
        
        # --- DIAGNOSTIC DUMP START ---
        import numpy as np
        print(f"\n[DIAGNOSTIC] Audio Pipeline Data Dump")
        print(f"1. Waveform Data:")
        print(f"   - Length: {len(waveform_data.samples)}")
        print(f"   - Sample Rate: {waveform_data.sample_rate}")
        print(f"   - Duration: {waveform_data.duration:.4f}s")
        print(f"   - First 5 samples: {waveform_data.samples[:5]}")
        print(f"   - Last 5 samples: {waveform_data.samples[-5:]}")
        
        print(f"2. Resampled (Raw Amplitudes):")
        print(f"   - Length: {len(raw_amplitudes)}")
        print(f"   - First 5: {raw_amplitudes[:5]}")
        
        print(f"3. Binned (Normalized):")
        print(f"   - Length: {len(normalized)}")
        print(f"   - Mode: {binning_mode}")
        print(f"   - Values: {list(np.round(normalized, 4))}") # Round for easier reading
        # --- DIAGNOSTIC DUMP END ---
        
        
        
        logger.debug(f"Binned to {len(normalized)} slots, range: [{np.min(normalized):.3f}, {np.max(normalized):.3f}]")
        
        # Stage 3: Filter
        min_filtered, max_filtered = self._filter_stage(
            min_normalized,
            max_normalized,
            request.apply_filter,
            request.filter_amount
        )
        # For backward compatibility
        filtered = max_filtered
        logger.debug(f"Filtered range: [{np.min(filtered):.3f}, {np.max(filtered):.3f}]")
        
        # Stage 3.5: Apply artistic scaling if exponent != 1.0
        if request.amplitude_exponent != 1.0:
            min_filtered = self.audio_processor.apply_artistic_scaling(min_filtered, request.amplitude_exponent)
            max_filtered = self.audio_processor.apply_artistic_scaling(max_filtered, request.amplitude_exponent)
            filtered = max_filtered  # Update for backward compatibility
            logger.debug(f"Applied artistic scaling with exponent {request.amplitude_exponent}")
        
        # Stage 4: Scale
        min_scaled, max_scaled = self._scale_stage(
            min_filtered,
            max_filtered,
            geometry.max_amplitude_local,
            geometry.true_min_radius * 2.0,
            geometry.bit_diameter,
            binning_mode,
        )
        # For backward compatibility
        scaled = max_scaled
        logger.debug(f"Scaled with max_amplitude={geometry.max_amplitude_local:.3f}, "
                    f"min_radius={geometry.true_min_radius * 2.0:.3f}, "
                    f"result range: [{np.min(scaled):.3f}, {np.max(scaled):.3f}]")
        logger.debug(f"BINNING DEBUG - Min array range: [{np.min(min_scaled):.4f}, {np.max(min_scaled):.4f}], "
                    f"Max array range: [{np.min(max_scaled):.4f}, {np.max(max_scaled):.4f}]")
        
        # Stage 5: Roll
        min_final, max_final = self._roll_stage(
            min_scaled,
            max_scaled,
            request.roll_amount
        )
        final = max_final  # For backward compatibility
        
        # Log pipeline progression
        logger.info(f"[AUDIO PIPELINE TESTING - PIPELINE] Stage progression: resample({len(raw_amplitudes)}) -> bin({len(normalized)}) -> filter({request.apply_filter}) -> scale({geometry.max_amplitude_local:.3f}) -> roll({request.roll_amount}) | Time: {time.time()-start_time:.3f}s")
        
        # Create immutable result
        result = AudioResultDTO(
            raw_amplitudes=raw_amplitudes.copy(),
            normalized_amplitudes=normalized.copy(),
            filtered_amplitudes=filtered.copy(),
            scaled_amplitudes=final.copy(),
            min_amplitudes=min_final.copy(),
            max_amplitudes=max_final.copy(),
            sample_rate=waveform_data.sample_rate,
            duration=waveform_data.duration
        )
        
        # Make arrays read-only
        for arr in [result.raw_amplitudes, result.normalized_amplitudes,
                   result.filtered_amplitudes, result.scaled_amplitudes]:
            arr.flags.writeable = False
            
        # Cache result with geometry's max_amplitude
        cache_key = self._cache._get_request_key(request) + f"|{geometry.max_amplitude_local:.6f}"
        self._cache._cache[cache_key] = result
        self._cache._update_access_order(cache_key)
        self._cache._evict_if_needed()
        
        return result
        
    def _resample_stage(self, samples: np.ndarray, target_size: int) -> np.ndarray:
        """Resample audio to target size."""
        return self.audio_processor._extract_amplitudes(samples, target_size)
        
    def _binning_stage(self, amplitudes: np.ndarray, num_slots: int, 
                      mode: Optional['BinningMode'] = None) -> Tuple[np.ndarray, np.ndarray]:
        """Bin amplitudes to slot count."""
        if mode is None:
            from core.contracts.audio_processing_dto import BinningMode
            mode = BinningMode.MEAN_ABSOLUTE
        
        # Logging moved from core algorithm to service layer
        logger.info(f"[AMPLITUDE-DEBUG-BIN-CALC] Input range: [{np.min(amplitudes):.6f}, {np.max(amplitudes):.6f}]")
        logger.info(f"[AMPLITUDE-DEBUG-BIN-CALC] Input std dev: {np.std(amplitudes):.6f}")
        
        return self.audio_processor.bin_amplitudes(amplitudes, num_slots, mode)
        
    def _filter_stage(
        self,
        min_amplitudes: np.ndarray,
        max_amplitudes: np.ndarray,
        apply_filter: bool,
        filter_amount: float
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Apply noise filter if requested."""
        if apply_filter:
            min_filtered = self.audio_processor.filter_data(min_amplitudes, filter_amount)
            max_filtered = self.audio_processor.filter_data(max_amplitudes, filter_amount)
            return min_filtered, max_filtered
        return min_amplitudes.copy(), max_amplitudes.copy()
        
    def _scale_stage(
        self,
        min_amplitudes: np.ndarray,
        max_amplitudes: np.ndarray,
        max_amplitude: float,
        min_safe_radius: float,
        bit_diameter: float,
        mode: BinningMode,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Scales normalized amplitudes to physical dimensions, respecting the binning mode.
        """
        logger.info(f"[AUDIO-SCALE] Scaling with max_amplitude: {max_amplitude:.4f}")

        min_scaled = min_amplitudes * max_amplitude
        max_scaled = max_amplitudes * max_amplitude

        # Determine the system's required minimum size for the slots based on geometry.
        system_minimum = 0
        if min_safe_radius < max_amplitude * 0.1:
            system_minimum = min_safe_radius
        else:
            logger.debug(f"Min safe radius {min_safe_radius:.3f} too large vs max_amplitude {max_amplitude:.3f}, using bit diameter as min")
            system_minimum = bit_diameter * 2.0

        # Use the greater of the system-required minimum or the user-defined minimum.
        final_minimum = system_minimum
        logger.debug(f"Final minimum amplitude enforced: {final_minimum:.3f} (system: {system_minimum:.3f})")

        # 1. Establish the definitive outer boundary. Ensure it's never smaller than our final minimum size.
        final_max_scaled = np.maximum(max_scaled, final_minimum)

        # 2. Determine the inner boundary based on the binning mode.
        if mode == BinningMode.MEAN_ABSOLUTE:
            # For symmetric mode, the inner boundary is a perfect mirror of the (clamped) outer boundary.
            final_min_scaled = -final_max_scaled
        else:
            # For asymmetric modes, we preserve the true negative values.
            final_min_scaled = min_scaled   

        return final_min_scaled, final_max_scaled
        
    def _roll_stage(self, min_amplitudes: np.ndarray, max_amplitudes: np.ndarray, 
                   roll_amount: int) -> Tuple[np.ndarray, np.ndarray]:
        """Apply circular shift."""
        if roll_amount != 0:
            return (self.audio_processor.apply_roll_start(min_amplitudes, roll_amount),
                    self.audio_processor.apply_roll_start(max_amplitudes, roll_amount))
        return min_amplitudes.copy(), max_amplitudes.copy()
```

