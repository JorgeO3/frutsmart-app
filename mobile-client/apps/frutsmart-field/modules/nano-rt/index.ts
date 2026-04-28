// ============================================================================
// NANORT MODULE - Main entry point
// ============================================================================

// Re-export all types
export type {
  NanoRTInitResult,
  NanoRTOnReadyPayload,
  NanoRTOnInitErrorPayload,
  NanoRTModuleEvents,
  NanoRTItem,
  NanoRTListResult,
  ImageFormat,
  ClassificationMethod,
  ClassificationOptions,
} from './src/NanoRTModule';

export type {
  SegmentErrorReason,
  SegmentError,
} from './src/NanoRTErrors';

export type {
  ReadyState,
  UseNanoRTOptions,
} from './src/useNanoRT';

// Re-export native module
export { NativeNanoRT } from './src/NanoRTModule';

// Re-export error classes and utilities
export {
  NanoRTError,
  createSegmentError,
  convertToNanoRTError,
  isSegmentValidationError,
  getSegmentCount,
} from './src/NanoRTErrors';

// Re-export hooks
export { useNanoRT, useNanoRTReady } from './src/useNanoRT';

// Re-export classifier
export { NanoRTClassifier } from './src/NanoRTClassifier';

// ============================================================================
// DEFAULT EXPORT - Enhanced API
// ============================================================================

import { NanoRTClassifier } from './src/NanoRTClassifier';
import { useNanoRT } from './src/useNanoRT';
import { NanoRTError } from './src/NanoRTErrors';
import { NativeNanoRT } from './src/NanoRTModule';

export default {
  // Classification methods
  ...NanoRTClassifier,

  // Hooks and utilities
  useNanoRT,
  NanoRTError,

  // Utility functions
  getModuleInfo: () => {
    try {
      return {
        version: NativeNanoRT.version,
        engine: NativeNanoRT.engine,
        liteRT: NativeNanoRT.liteRT,
      };
    } catch {
      return null;
    }
  },

  // Direct access to native module for edge cases
  native: NativeNanoRT,
};