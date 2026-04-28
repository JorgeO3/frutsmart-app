import type { ClassificationMethod } from './NanoRTModule';

// ============================================================================
// SEGMENT VALIDATION ERRORS
// ============================================================================

/** Segment validation error reasons (matches Kotlin enum) */
export type SegmentErrorReason = 'NO_SEGMENT' | 'MULTIPLE_SEGMENTS';

/** Segment validation error details */
export type SegmentError = {
  reason: SegmentErrorReason;
  segmentsCount: number;
  entity: string;
  userMessage: string;
  guidance: string[];
};

/**
 * Enhanced NanoRT error that works with Expo's CodedError system
 */
export class NanoRTError extends Error {
  constructor(
    message: string,
    public code: string,
    public type?: string,
    public cause?: Error,
    public segmentError?: SegmentError
  ) {
    super(message);
    this.name = 'NanoRTError';
  }

  /** Check if this is a segment validation error */
  isSegmentError(): boolean {
    return this.code === 'no_segment' || this.code === 'multi_segment';
  }

  /** Get user-friendly message for segment errors */
  getUserMessage(): string {
    return this.segmentError?.userMessage ?? this.message;
  }

  /** Get guidance for segment errors */
  getGuidance(): string[] {
    return this.segmentError?.guidance ?? [];
  }

  /** Convert to CodedError format for compatibility */
  // biome-ignore lint/suspicious/noExplicitAny: returns a plain JS object matching Expo's CodedError shape for interop with Expo/native modules
  toCodedError(): any {
    return {
      code: this.code,
      message: this.message,
      type: this.type,
      segmentError: this.segmentError
    };
  }
}

// ============================================================================
// ERROR UTILITIES
// ============================================================================

/**
 * Creates contextual segment error information based on classification method
 */
export const createSegmentError = (
  code: string,
  message: string,
  method: ClassificationMethod
): SegmentError => {
  const entityMap: Record<ClassificationMethod, string> = {
    plantExternal: 'plantas',
    plantInternal: 'planta',
    fieldExternal: 'cultivo',
    fieldInternal: 'cultivo'
  };

  const entity = entityMap[method];
  const reason: SegmentErrorReason = code === 'no_segment' ? 'NO_SEGMENT' : 'MULTIPLE_SEGMENTS';

  const guidance = reason === 'NO_SEGMENT'
    ? [
      `El ${entity} debe estar bien enfocado y sin obstrucciones.`,
      'Asegure buena iluminación y una distancia apropiada.',
      'Verifique que el objetivo esté completamente visible en la imagen.'
    ]
    : [
      `Por favor, enfoque solo un ${entity} en la imagen.`,
      'Asegúrese de que no haya otros objetivos en el cuadro.',
      'Mantenga una distancia apropiada para capturar un solo elemento.'
    ];

  return {
    reason,
    segmentsCount: reason === 'NO_SEGMENT' ? 0 : -1, // -1 indicates multiple
    entity,
    userMessage: message,
    guidance
  };
};

/**
 * Converts any error to NanoRTError with proper segment handling
 */
export const convertToNanoRTError = (
  // biome-ignore lint/suspicious/noExplicitAny: incoming error shape is provided by native/Expo and cannot be strictly typed here
  error: any,
  method: ClassificationMethod,
  fallbackCode = 'unknown_error'
): NanoRTError => {
  // Handle Expo CodedError from native module
  if (error?.code) {
    // Handle segment validation errors specifically
    if (error.code === 'no_segment' || error.code === 'multi_segment') {
      const segmentError = createSegmentError(error.code, error.message, method);
      return new NanoRTError(
        error.message ?? 'Segment validation failed',
        error.code,
        error.type,
        error,
        segmentError
      );
    }

    // Handle other coded errors from native
    return new NanoRTError(
      error.message ?? 'Classification failed',
      error.code,
      error.type,
      error
    );
  }

  // Handle non-coded errors
  const errorMessage = error instanceof Error ? error.message : String(error);
  return new NanoRTError(
    errorMessage,
    fallbackCode,
    error?.constructor?.name,
    error instanceof Error ? error : undefined
  );
};

/**
 * Checks if an error is a segment validation error
 */
export const isSegmentValidationError = (
  // biome-ignore lint/suspicious/noExplicitAny: error may come from native/Expo and lacks a stable TS type
  error: any
): boolean => {
  return error?.code === 'no_segment' || error?.code === 'multi_segment';
};

/**
 * Extracts segment count from error (useful for analytics)
 */
export const getSegmentCount = (error: NanoRTError): number => {
  return error.segmentError?.segmentsCount ?? -1;
};