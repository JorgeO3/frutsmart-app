import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import isEqual from "react-fast-compare";

// --- State & Hooks ---
import { useTakePhoto } from "@hooks/useTakePhoto";

// --- UI Components ---
import AppView from "@components/AppView";
import PhotoPreviewScreen from "@components/PhotoPreviewScreen";

// --- Types ---
type Picture = { id: string; rawUri: string };

interface ActionButtonProps {
  title: string;
  onPress: () => void;
}

interface ErrorViewProps {
  message: string;
  onRetry: () => void;
}

// --- Constants ---
const STRINGS = {
  TITLE: "Resultado de la captura",
  DESCRIPTION:
    "No tome las fotos en contraluz, así no afectá la coloración y captura del fruto.",
  LOADING_CAMERA: "Abriendo cámara...",
  RETRY: "Reintentar",
  CAPTURE_CANCELLED:
    "La captura fue cancelada o la cámara se cerró. Por favor, inténtalo de nuevo.",
} as const;

const COLORS = {
  PRIMARY: "#227c26",
  ERROR: "#d9534f",
  WHITE: "#FFFFFF",
} as const;

const generatePicture = (uri: string): Picture => ({
  id: Crypto.randomUUID(),
  rawUri: uri,
});

const serializePicture = (picture: Picture): string => JSON.stringify(picture);

// --- UI Components ---
const ActionButtonComponent = (props: ActionButtonProps) => {
  const { title, onPress } = props;

  return (
    <TouchableOpacity onPress={onPress} style={styles.button}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
};

const ActionButton = memo(ActionButtonComponent, isEqual);

const LoadingViewComponent = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={COLORS.WHITE} />
    <Text style={styles.loadingText}>{STRINGS.LOADING_CAMERA}</Text>
  </View>
);

const LoadingView = memo(LoadingViewComponent);

const ErrorViewComponent = (props: ErrorViewProps) => {
  const { message, onRetry } = props;

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{message}</Text>
      <ActionButton title={STRINGS.RETRY} onPress={onRetry} />
    </View>
  );
};

const ErrorView = memo(ErrorViewComponent, isEqual);

// --- Custom Hooks ---
const useCameraCapture = () => {
  const { takePhoto, loading, error: cameraError } = useTakePhoto();
  const [photo, setPhoto] = useState<Picture | null>(null);
  const [wasCancelled, setWasCancelled] = useState(false);
  const initialCaptureAttempted = useRef(false);

  const resetState = useCallback(() => {
    setPhoto(null);
    setWasCancelled(false);
  }, []);

  const handleCapture = useCallback(async () => {
    resetState();

    const photoResult = await takePhoto();

    if (photoResult?.uri) {
      setPhoto(generatePicture(photoResult.uri));
    } else if (!cameraError) {
      setWasCancelled(true);
    }
  }, [takePhoto, cameraError, resetState]);

  const isInitialCaptureComplete = () => initialCaptureAttempted.current;
  const markInitialCaptureAttempted = () => {
    initialCaptureAttempted.current = true;
  };

  return {
    photo,
    loading,
    cameraError,
    wasCancelled,
    handleCapture,
    isInitialCaptureComplete,
    markInitialCaptureAttempted,
  };
};

const useNavigation = () => {
  const router = useRouter();

  const navigateToDetection = useCallback(
    (picture: Picture) => {
      const serializedPicture = serializePicture(picture);

      router.replace({
        pathname: "/plant-work/work-flow/external/detection",
        params: { picture: serializedPicture },
      });
    },
    [router],
  );

  return { navigateToDetection };
};

// --- Main Component ---
/**
 * Manages the photo capture flow. It launches the camera automatically
 * upon entering the screen, handles the result (preview, cancellation, or error),
 * and allows the user to proceed or retry.
 */
const PictureScreenComponent = () => {
  const {
    photo,
    loading,
    cameraError,
    wasCancelled,
    handleCapture,
    isInitialCaptureComplete,
    markInitialCaptureAttempted,
  } = useCameraCapture();

  const { navigateToDetection } = useNavigation();

  const handleContinue = useCallback(() => {
    if (!photo) return;
    navigateToDetection(photo);
  }, [photo, navigateToDetection]);

  // Launch camera automatically on initial mount
  useEffect(() => {
    if (!isInitialCaptureComplete()) {
      markInitialCaptureAttempted();
      handleCapture();
    }
  }, [handleCapture, isInitialCaptureComplete, markInitialCaptureAttempted]);

  // --- Render Logic ---
  if (loading) {
    return <LoadingView />;
  }

  if (cameraError) {
    return <ErrorView message={cameraError.message} onRetry={handleCapture} />;
  }

  if (wasCancelled) {
    return (
      <ErrorView message={STRINGS.CAPTURE_CANCELLED} onRetry={handleCapture} />
    );
  }

  console.log("Current photo state:", photo);

  if (photo) {
    return (
      <AppView style={styles.container}>
        <PhotoPreviewScreen
          title={STRINGS.TITLE}
          description={STRINGS.DESCRIPTION}
          onRepeat={handleCapture}
          onContinue={handleContinue}
          photoData={{ uri: photo.rawUri }}
        />
      </AppView>
    );
  }

  // Fallback state shown briefly before initial useEffect runs
  return <LoadingView />;
};

const PictureScreen = memo(PictureScreenComponent);

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.ERROR,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    gap: 20,
  },
  loadingText: {
    color: COLORS.WHITE,
    fontSize: 16,
  },
  errorText: {
    color: COLORS.WHITE,
    textAlign: "center",
    fontSize: 16,
  },
  button: {
    borderWidth: 1,
    borderColor: COLORS.WHITE,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: COLORS.WHITE,
    fontSize: 18,
    fontWeight: "500",
  },
});

export default PictureScreen;
