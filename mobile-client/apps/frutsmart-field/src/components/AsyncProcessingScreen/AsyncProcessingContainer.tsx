import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  withTiming,
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import type { AnimationObject } from "lottie-react-native";
import AsyncProcessingPresentation from "./AsyncProcessingPresentation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// --- Public API: Types & Factory Functions ---
// These should be imported by the parent component to construct the `asyncTask` return value.

/** Represents a successful outcome for the `asyncTask`. */
export type Ok<T> = { _tag: "Ok"; value: T };

/** Represents a failed outcome for the `asyncTask`. */
export type Err<E> = { _tag: "Err"; error: E };

/** A union of `Ok<T>` and `Err<E>` that the `asyncTask` must return. */
export type Result<T, E> = Ok<T> | Err<E>;

/** Factory function to create a success result. */
export const Ok = <T,>(value: T): Ok<T> => ({ _tag: "Ok", value });

/** Factory function to create an error result. */
export const Err = <E,>(error: E): Err<E> => ({ _tag: "Err", error });

// --- Component Props ---
interface AsyncProcessingScreenProps<T, E = Error> {
  /** A function that returns a Promise resolving to a `Result` type (`Ok` or `Err`). */
  asyncTask: () => Promise<Result<T, E>>;
  /** Callback executed with the success value when the entire exit animation is complete. */
  onTaskComplete: (result: T) => void;
  /** Callback executed with the error value when the entire exit animation is complete. */
  onTaskError: (error: E) => void;
  /** The Lottie animation object to display while processing. */
  loadingAnimation: AnimationObject;
  /** A message to display below the loading animation. */
  loadingMessage?: string;
  /** A fallback timeout in ms. This triggers the exit animation if the Lottie `onComplete` event doesn't fire. */
  fallbackTimeout?: number;
  /** The duration of the entry and exit animations in ms. */
  transitionDuration?: number;
  /** When `true`, the `asyncTask` will be executed. Defaults to `true`. */
  isReady?: boolean;
}

function AsyncProcessingScreen<T, E = Error>({
  asyncTask,
  onTaskComplete,
  onTaskError,
  loadingAnimation,
  loadingMessage = "Procesando...",
  fallbackTimeout = 2100,
  transitionDuration = 300,
  isReady = true,
}: AsyncProcessingScreenProps<T, E>) {
  // --- State ---
  const [successValue, setSuccessValue] = useState<T | null>(null);
  const [errorValue, setErrorValue] = useState<E | null>(null);
  const [shouldCompleteAnimation, setShouldCompleteAnimation] = useState(false);
  const { bottom } = useSafeAreaInsets();

  // --- Reanimated Shared Values ---
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  // --- Animations ---
  const startEntryAnimation = useCallback(() => {
    const config = {
      duration: transitionDuration,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    };
    opacity.value = withTiming(1, config);
    scale.value = withTiming(1, config);
  }, [opacity, scale, transitionDuration]);

  const startExitAnimation = useCallback(
    (onExitComplete: () => void) => {
      const config = {
        duration: transitionDuration,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      };
      // Once the opacity animation finishes, execute the final callback on the JS thread.
      opacity.value = withTiming(0, config, () => runOnJS(onExitComplete)());
      scale.value = withTiming(1.1, config);
    },
    [opacity, scale, transitionDuration],
  );

  // --- Handlers ---
  const handleLottieAnimationFinished = useCallback(() => {
    const finalCallback = () => {
      if (successValue !== null) {
        onTaskComplete(successValue);
      } else if (errorValue !== null) {
        onTaskError(errorValue);
      }
    };
    startExitAnimation(finalCallback);
  }, [
    successValue,
    errorValue,
    startExitAnimation,
    onTaskComplete,
    onTaskError,
  ]);

  // --- Main Effect ---
  useEffect(() => {
    let isMounted = true;
    startEntryAnimation();

    const executeTask = async () => {
      try {
        const result = await asyncTask();
        if (isMounted) {
          if (result._tag === "Ok") {
            setSuccessValue(result.value);
          } else {
            setErrorValue(result.error);
          }
          setShouldCompleteAnimation(true);
        }
      } catch (e) {
        if (isMounted) {
          console.error("An unexpected error was thrown by `asyncTask`:", e);
          setErrorValue(e as E);
          setShouldCompleteAnimation(true);
        }
      }
    };

    // The `isReady` prop acts as a gate, preventing the task from running
    // until all preconditions in the parent component are met (e.g., model loaded).
    if (isReady) {
      executeTask();
    }

    return () => {
      isMounted = false;
    };
  }, [isReady, asyncTask, startEntryAnimation]);

  // --- Render ---
  return (
    <View style={[styles.container, { paddingBottom: bottom }]}>
      <Animated.View style={[styles.animatedContainer, animatedContainerStyle]}>
        <AsyncProcessingPresentation
          message={loadingMessage}
          source={loadingAnimation}
          onComplete={handleLottieAnimationFinished}
          shouldComplete={shouldCompleteAnimation}
          duration={fallbackTimeout}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    zIndex: 1000,
  },
  animatedContainer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});

// Memoize the component to prevent re-renders if the parent component updates,
// as long as the props passed to this screen have not changed.
// Note: Parent component must wrap callbacks (onTaskComplete, etc.) in `useCallback`.
export default React.memo(
  AsyncProcessingScreen,
) as typeof AsyncProcessingScreen;
