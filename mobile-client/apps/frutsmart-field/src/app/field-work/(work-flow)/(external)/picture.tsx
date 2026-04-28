import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";

// --- State & Hooks ---
import { useTakePhoto } from "@hooks/useTakePhoto";
import type { ClassifiedSegment } from "@stores/fieldWork";

// --- UI Components ---
import AppView from "@components/AppView";
import PhotoPreviewScreen from "@components/PhotoPreviewScreen";

// --- Constants ---
// biome-ignore format: true
const STRINGS = {
  TITLE: "Resultado de la captura",
  DESCRIPTION: "No tome las fotos en contraluz, así no afectá la coloración y captura del fruto.",
  LOADING_CAMERA: "Abriendo cámara...",
  RETRY: "Reintentar",
  CAPTURE_CANCELLED: "La captura fue cancelada o la cámara se cerró. Por favor, inténtalo de nuevo.",
};

type Picture = Pick<ClassifiedSegment, "rawUri">;

const ActionButton = React.memo(
  ({ title, onPress }: { title: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={styles.button}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  ),
);

const LoadingView = React.memo(() => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#FFFFFF" />
    <Text style={styles.loadingText}>{STRINGS.LOADING_CAMERA}</Text>
  </View>
));

const ErrorView = React.memo(
  ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{message}</Text>
      <ActionButton title={STRINGS.RETRY} onPress={onRetry} />
    </View>
  ),
);

/**
 * Manages the photo capture flow. It launches the camera automatically
 * upon entering the screen, handles the result (preview, cancellation, or error),
 * and allows the user to proceed or retry.
 */
const PictureScreen = () => {
  const router = useRouter();
  const { takePhoto, loading, error: cameraError } = useTakePhoto();
  const [photo, setPhoto] = useState<Picture | null>(null);
  const [wasCancelled, setWasCancelled] = useState(false);

  // This ref ensures the automatic capture only runs once per mount.
  const initialCaptureAttempted = useRef(false);

  const handleCapture = useCallback(async () => {
    // Reset component state before each capture attempt.
    setPhoto(null);
    setWasCancelled(false);

    const photoResult = await takePhoto();

    if (photoResult) {
      setPhoto({ rawUri: photoResult.uri });
    } else if (!cameraError) {
      setWasCancelled(true);
    }
  }, [takePhoto, cameraError]);

  const handleContinue = useCallback(() => {
    if (!photo) return;

    const picture = JSON.stringify(photo);

    router.replace({
      pathname: "/field-work/(work-flow)/(external)/detection",
      params: { picture },
    });
  }, [router, photo]);

  // Launch camera automatically on initial mount.
  useEffect(() => {
    // The ref prevents the camera from re-launching on re-renders.
    if (!initialCaptureAttempted.current) {
      initialCaptureAttempted.current = true;
      handleCapture();
    }
  }, [handleCapture]);

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

  // This state is shown briefly before the initial useEffect runs.
  return <LoadingView />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#227c26",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#227c26",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#d9534f",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    gap: 20,
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  errorText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 16,
  },
  button: {
    borderWidth: 1,
    borderColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "500",
  },
});

export default PictureScreen;
