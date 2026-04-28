import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export type NanoRTInitResult = {
  success: boolean;
  message: string;
  version: string;
};

export type NanoRTOnReadyPayload = Record<string, never>;

export type NanoRTOnInitErrorPayload = {
  message: string;
  type: string;
};

export type NanoRTItem = {
  uri: string;
  confidences: number[];
};

export type NanoRTListResult = {
  items: NanoRTItem[];
};

export interface Spec extends TurboModule {
  addListener(eventType: string): void;
  removeListeners(count: number): void;

  isReady(): boolean;
  initialize(): Promise<boolean>;
  initializeModule(): Promise<NanoRTInitResult>;

  classifyPlantExternal(imageUri: string): Promise<NanoRTListResult>;
  classifyPlantInternal(imageUri: string): Promise<NanoRTListResult>;
  classifyFieldExternal(imageUri: string): Promise<NanoRTListResult>;
  classifyFieldInternal(imageUri: string): Promise<NanoRTListResult>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeNanoRT');
