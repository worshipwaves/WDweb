import { CompositionStateDTO } from './types/PanelTypes';

export const TEST_PARAMS: CompositionStateDTO = {
  frameDesign: {
    shape: 'circular',
    frameOrientation: 'vertical',
    finishX: 36.0,
    finishY: 36.0,
    finishZ: 0.375,
    numberSections: 3,  // Change from 2 to 3, 4, etc
    separation: 2.0,
    species: 'maple'
  },
  patternSettings: {
    slotStyle: 'radial',
    numberSlots: 48,  // Try 36, 60, 72
    bitDiameter: 0.25,
    spacer: 0.5,
    xOffset: 0.75,
    yOffset: 1.5,
    scaleCenterPoint: 1.0,
    amplitudeExponent: 1.0,  // Try 0.5 for compressed, 1.5 for expanded
    orientation: 'auto',
    grainAngle: 90.0,
    leadOverlap: 0.25,
    leadRadius: 0.25,
    dovetailSettings: {
      generateDovetails: false,
      showDovetails: false,
      dovetailInset: 0.0625,
      dovetailCutDirection: 'climb',
      dovetailEdgeDefault: 0,
      dovetailEdgeOverrides: {}
    }
  },
  visualCorrection: {
    method: 'none',
    offset: 0.0,
    radMin: 1.0,
    radMax: 7.0,
    angleStart: 90.0,
    angleEnd: 90.0
  },
  // Dummy audio data - replace with actual amplitudes
  audioSource: {
    sourceFile: null,
    startTime: 0,
    endTime: 30,
    useStems: false,
    stemChoice: 'vocals'
  },
  audioProcessing: {
    numRawSamples: 200000,
    filterAmount: 0.05,
    applyFilter: false,
    binningMethod: 'mean',
    binningMode: 'mean_abs',
    removeSilence: false,
    silenceThreshold: -20,
    silenceDuration: 0.5
  },
  peakControl: {
    method: 'none',
    threshold: 0.8,
    rollAmount: 0,
    nudgeEnabled: false,
    clipEnabled: false,
    compressEnabled: false,
    scaleEnabled: false,
    scaleAllEnabled: false,
    manualEnabled: false,
    clipPercentage: 0.8,
    compressionExponent: 0.75,
    thresholdPercentage: 0.9,
    scaleAllPercentage: 1.0,
    manualSlot: 0,
    manualValue: 1.0
  },
  displaySettings: {
    showDebugCircle: false,
    debugCircleRadius: 1.5,
    showLabels: false,
    showOffsets: false
  },
  exportSettings: {
    cncMargin: 1.0,
    sectionsInSheet: 1
  },
  artisticRendering: {
    artisticStyle: 'none',
    colorPalette: 'ocean',
    colorPalettes: {}
  },
  amplitudes: null,
  processedAmplitudes: null
};