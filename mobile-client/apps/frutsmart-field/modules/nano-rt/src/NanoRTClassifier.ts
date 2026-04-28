import {
  NativeNanoRT,
  type ClassificationMethod,
  type ClassificationOptions,
  type NanoRTListResult
} from './NanoRTModule';
import { NanoRTError, convertToNanoRTError } from './NanoRTErrors';

// ============================================================================
// CLASSIFICATION API
// ============================================================================

const executeClassification = async (
  method: ClassificationMethod,
  imageUri: string,
  options: ClassificationOptions
): Promise<NanoRTListResult> => {
  const { timeout = 30000 } = options;

  if (!imageUri?.trim()) {
    throw new NanoRTError('Image URI is required', 'invalid_input');
  }

  // Check if module is ready
  if (!NativeNanoRT.isReady?.()) {
    throw new NanoRTError('Module is not ready. Call initializeModule() first.', 'not_ready');
  }

  // Map method to native function
  const nativeMethod = {
    plantExternal: NativeNanoRT.classifyPlantExternal,
    plantInternal: NativeNanoRT.classifyPlantInternal,
    fieldExternal: NativeNanoRT.classifyFieldExternal,
    fieldInternal: NativeNanoRT.classifyFieldInternal,
  }[method];

  try {
    // Execute with timeout
    const result = await Promise.race([
      nativeMethod.call(NativeNanoRT, imageUri),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new NanoRTError('Classification timeout', 'timeout')), timeout)
      ),
    ]);

    // Validate result structure
    if (!result?.items || !Array.isArray(result.items)) {
      throw new NanoRTError('Invalid result structure from native module', 'invalid_result');
    }

    return result;
  } catch (error) {
    console.log('Classification error details:', error);
    throw convertToNanoRTError(error, method, 'classification_error');
  }
};

/**
 * Enhanced classification methods with options and error handling
 */
export const NanoRTClassifier = {
  /**
   * Classify plant external features
   */
  async classifyPlantExternal(
    imageUri: string,
    options: ClassificationOptions = {}
  ): Promise<NanoRTListResult> {
    return executeClassification('plantExternal', imageUri, options);
  },

  /**
   * Classify plant internal features  
   */
  async classifyPlantInternal(
    imageUri: string,
    options: ClassificationOptions = {}
  ): Promise<NanoRTListResult> {
    return executeClassification('plantInternal', imageUri, options);
  },

  /**
   * Classify field external features
   */
  async classifyFieldExternal(
    imageUri: string,
    options: ClassificationOptions = {}
  ): Promise<NanoRTListResult> {
    return executeClassification('fieldExternal', imageUri, options);
  },

  /**
   * Classify field internal features
   */
  async classifyFieldInternal(
    imageUri: string,
    options: ClassificationOptions = {}
  ): Promise<NanoRTListResult> {
    return executeClassification('fieldInternal', imageUri, options);
  },

  /**
   * Generic classification method
   */
  async classify(
    method: ClassificationMethod,
    imageUri: string,
    options: ClassificationOptions = {}
  ): Promise<NanoRTListResult> {
    return executeClassification(method, imageUri, options);
  },
};

export default NanoRTClassifier;