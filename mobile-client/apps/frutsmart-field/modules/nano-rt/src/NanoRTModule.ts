import { NativeModule, requireNativeModule } from 'expo';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Module initialization result */
export type NanoRTInitResult = {
  success: boolean;
  message: string;
  version: string;
};

/** Event payloads */
export type NanoRTOnReadyPayload = Record<string, never>;
export type NanoRTOnInitErrorPayload = {
  message: string;
  type: string;
};

/** Module event map */
export type NanoRTModuleEvents = {
  onReady: (payload: NanoRTOnReadyPayload) => void;
  onInitError: (payload: NanoRTOnInitErrorPayload) => void;
};

/** Segmented item with URI and confidences */
export type NanoRTItem = {
  uri: string;          // WebP file URI in cache
  confidences: number[]; // Classification confidences
};

/** Standard result envelope for all classification methods */
export type NanoRTListResult = {
  items: NanoRTItem[];
};

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

declare class NanoRTModule extends NativeModule<NanoRTModuleEvents> {
  // Constants
  readonly version: string;
  readonly liteRT: string;
  readonly engine: string;

  // Lifecycle methods
  isReady(): boolean;
  initialize(): Promise<boolean>;
  initializeModule(): Promise<NanoRTInitResult>;

  // Classification methods
  classifyPlantExternal(imageUri: string): Promise<NanoRTListResult>;
  classifyPlantInternal(imageUri: string): Promise<NanoRTListResult>;
  classifyFieldExternal(imageUri: string): Promise<NanoRTListResult>;
  classifyFieldInternal(imageUri: string): Promise<NanoRTListResult>;
}

export const NativeNanoRT = requireNativeModule<NanoRTModule>('NanoRT');