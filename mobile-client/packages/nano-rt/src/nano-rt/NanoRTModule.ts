import {NativeEventEmitter} from 'react-native';
import NativeNanoRTSpec from '../NativeNanoRT';
import type {
  NanoRTInitResult,
  NanoRTItem,
  NanoRTListResult,
  NanoRTOnInitErrorPayload,
  NanoRTOnReadyPayload,
} from '../NativeNanoRT';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Module initialization result */
export type {NanoRTInitResult};

/** Event payloads */
export type {NanoRTOnReadyPayload, NanoRTOnInitErrorPayload};

/** Module event map */
export type NanoRTModuleEvents = {
  onReady: (payload: NanoRTOnReadyPayload) => void;
  onInitError: (payload: NanoRTOnInitErrorPayload) => void;
};

/** Segmented item with URI and confidences */
export type {NanoRTItem};

/** Standard result envelope for all classification methods */
export type {NanoRTListResult};

/** Image format options for saving */
export type ImageFormat = 'webp' | 'png' | 'jpeg';

/** Classification method types */
export type ClassificationMethod =
  | 'plantExternal'
  | 'plantInternal'
  | 'fieldExternal'
  | 'fieldInternal';

/** Enhanced classification options */
export type ClassificationOptions = {
  /** Image format for output (default: webp) */
  format?: ImageFormat;
  /** Quality for lossy formats (default: 85) */
  quality?: number;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
};

// ============================================================================
// NATIVE MODULE INTERFACE
// ============================================================================

type NativeNanoRTSpecModule = NonNullable<typeof NativeNanoRTSpec>;

let nativeEmitter: NativeEventEmitter | null = null;

function getNativeModule(): NativeNanoRTSpecModule | null {
  return NativeNanoRTSpec ?? null;
}

function assertNativeModule(): NativeNanoRTSpecModule {
  const nativeModule = getNativeModule();
  if (!nativeModule) {
    throw new Error('[NanoRT] Native module not found. Did you build the app?');
  }
  return nativeModule;
}

function getNativeEmitter(): NativeEventEmitter {
  if (!nativeEmitter) {
    nativeEmitter = new NativeEventEmitter(assertNativeModule() as never);
  }
  return nativeEmitter;
}

export const isAvailable = !!getNativeModule();

export const NativeNanoRT = {
  version: '1.0.0-android',
  liteRT: '1.4.0',
  engine: 'LiteRT+OpenCV',

  isReady: () => getNativeModule()?.isReady() ?? false,
  initialize: () => assertNativeModule().initialize(),
  initializeModule: () => assertNativeModule().initializeModule(),

  classifyPlantExternal: (imageUri: string) => assertNativeModule().classifyPlantExternal(imageUri),
  classifyPlantInternal: (imageUri: string) => assertNativeModule().classifyPlantInternal(imageUri),
  classifyFieldExternal: (imageUri: string) => assertNativeModule().classifyFieldExternal(imageUri),
  classifyFieldInternal: (imageUri: string) => assertNativeModule().classifyFieldInternal(imageUri),

  addListener: <K extends keyof NanoRTModuleEvents>(eventName: K, listener: NanoRTModuleEvents[K]) =>
    getNativeEmitter().addListener(eventName, listener as (...args: unknown[]) => void),
};
