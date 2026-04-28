import { useCallback, useEffect, useRef, useState } from 'react';

import type { EventSubscription, } from 'expo-modules-core';

import type { NanoRTOnInitErrorPayload } from './NanoRTModule';
import { NativeNanoRT } from "./NanoRTModule"

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Readiness state with enhanced error information */
export type ReadyState = {
  initializing: boolean;
  ready: boolean;
  error: {
    message: string;
    type?: string;
    code?: string;
  } | null;
};

/** Hook configuration options */
export type UseNanoRTOptions = {
  /** Whether to auto-initialize on mount (default: true) */
  autoInitialize?: boolean;
  /** Custom error handler */
  onError?: (error: ReadyState['error']) => void;
  /** Custom ready handler */
  onReady?: () => void;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const createUnsubscriber = (subscription: EventSubscription): (() => void) | undefined => {
  if (typeof subscription === 'function') return subscription;
  if (subscription?.remove) return () => subscription.remove();
  return undefined;
};

const extractErrorInfo = (error: unknown): ReadyState['error'] => {
  if (typeof error === 'object' && error !== null) {
    // biome-ignore lint/suspicious/noExplicitAny: this is necessary for error extraction
    // biome-ignore lint/suspicious/noExplicitAny: error comes from Expo/native modules with unpredictable shape; we extract common fields
    const err = error as any;
    return {
      message: err.message ?? 'Unknown error occurred',
      type: err.type ?? err.name ?? 'UnknownError',
      code: err.code ?? 'unknown_error'
    };
  }
  return {
    message: String(error) || 'Initialization failed',
    code: 'unknown_error'
  };
};

// ============================================================================
// ENHANCED HOOK
// ============================================================================

/**
 * Enhanced hook for managing NanoRT module lifecycle
 */
export function useNanoRT(options: UseNanoRTOptions = {}): ReadyState & {
  /** Manually initialize the module */
  initializeModule: () => Promise<void>;
  /** Get module info */
  getModuleInfo: () => { version: string; engine: string; liteRT: string } | null;
} {
  const { autoInitialize = true, onError, onReady } = options;

  const [state, setState] = useState<ReadyState>({
    initializing: autoInitialize,
    ready: false,
    error: null,
  });

  const initialized = useRef(false);
  const listenersSetup = useRef(false);

  // Get module info safely
  const getModuleInfo = useCallback(() => {
    try {
      return {
        version: NativeNanoRT.version,
        engine: NativeNanoRT.engine,
        liteRT: NativeNanoRT.liteRT,
      };
    } catch {
      return null;
    }
  }, []);

  // Manual initialization function
  const initializeModule = useCallback(async () => {
    if (state.ready) return;

    setState(prev => ({ ...prev, initializing: true, error: null }));

    try {
      await NativeNanoRT.initializeModule();
      // State will be updated by event listeners
    } catch (error) {
      const errorInfo = extractErrorInfo(error);
      setState({
        initializing: false,
        ready: false,
        error: errorInfo
      });
      onError?.(errorInfo);
    }
  }, [state.ready, onError]);

  // Setup event listeners (once)
  useEffect(() => {
    if (listenersSetup.current) return;
    listenersSetup.current = true;

    const unsubscribers: (() => void)[] = [];

    // Ready event listener
    const readySubscription = NativeNanoRT.addListener('onReady', () => {
      setState({
        initializing: false,
        ready: true,
        error: null
      });
      onReady?.();
    });

    // Error event listener
    const errorSubscription = NativeNanoRT.addListener('onInitError', (payload: NanoRTOnInitErrorPayload) => {
      const errorInfo = {
        message: payload?.message ?? 'Unknown initialization error',
        type: payload?.type,
        code: 'init_error'
      };
      setState({
        initializing: false,
        ready: false,
        error: errorInfo
      });
      onError?.(errorInfo);
    });

    // Collect unsubscribers
    const readyUnsub = createUnsubscriber(readySubscription);
    const errorUnsub = createUnsubscriber(errorSubscription);
    unsubscribers.push(...[readyUnsub, errorUnsub].filter(Boolean) as (() => void)[]);

    return () => {
      for (const unsub of unsubscribers) {
        try {
          unsub();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [onError, onReady]);

  // Auto-initialization effect
  useEffect(() => {
    if (!autoInitialize || initialized.current) return;
    initialized.current = true;

    const performAutoInit = async () => {
      // Check if already ready (hot reload scenario)
      if (NativeNanoRT.isReady?.()) {
        setState({
          initializing: false,
          ready: true,
          error: null
        });
        onReady?.();
        return;
      }

      // Start initialization
      await initializeModule();
    };

    performAutoInit();
  }, [autoInitialize, initializeModule, onReady]);

  return {
    ...state,
    initializeModule,
    getModuleInfo,
  };
}


export function useNanoRTReady(): ReadyState {
  const { initializing, ready, error } = useNanoRT({ autoInitialize: true });

  return {
    initializing,
    ready,
    error
  };
}