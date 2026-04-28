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
} from './NanoRTModule';

export type {
  SegmentErrorReason,
  SegmentError,
} from './NanoRTErrors';

export type {
  ReadyState,
  UseNanoRTOptions,
} from './useNanoRT';

// Re-export native module
export { NativeNanoRT } from './NanoRTModule';

// Re-export error classes and utilities
export {
  NanoRTError,
  createSegmentError,
  convertToNanoRTError,
  isSegmentValidationError,
  getSegmentCount,
} from './NanoRTErrors';

// Re-export hooks
export { useNanoRT, useNanoRTReady } from './useNanoRT';

// Re-export classifier
export { NanoRTClassifier } from './NanoRTClassifier';

// ============================================================================
// DEFAULT EXPORT - Enhanced API
// ============================================================================

import { NanoRTClassifier } from './NanoRTClassifier';
import { useNanoRT } from './useNanoRT';
import { NanoRTError } from './NanoRTErrors';
import { NativeNanoRT } from './NanoRTModule';

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
