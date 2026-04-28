import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";

import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";

import { useTakePhoto } from "@hooks/useTakePhoto";
import type { ClassifiedSegment } from "@stores/fieldWork";

import AppView from "@components/AppView";
import PhotoPreviewScreen from "@components/PhotoPreviewScreen";

// biome-ignore format: readability
const STRINGS = {
  TITLE: "Resultado de la captura",
  DESCRIPTION: 'Presione en el botón "Continuar" si la captura fue correcta, de lo contrario, puede repetirla.',
  LOADING_CAMERA: "Abriendo cámara...",
  RETRY: "Reintentar",
  CAPTURE_CANCELLED: "La captura fue cancelada o la cámara se cerró. Por favor, inténtalo de nuevo.",
};

// --- Tipos y Componentes reusables ---
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

const PictureScreen = () => {
  const router = useRouter();
  const { takePhoto, loading, error: cameraError } = useTakePhoto();
  const [photo, setPhoto] = useState<Picture | null>(null);
  const [wasCancelled, setWasCancelled] = useState(false);

  const initialCaptureAttempted = useRef(false);

  const handleCapture = useCallback(async () => {
    setPhoto(null);
    setWasCancelled(false);

    const photoResult = await takePhoto();

    if (photoResult) {
      setPhoto({ rawUri: photoResult.uri });
    } else if (!cameraError) {
      setWasCancelled(true);
    }
  }, [takePhoto, cameraError]);

  // CAMBIO 3: Modificamos handleContinue para pasar el objeto 'picture' en los params
  const handleContinue = useCallback(() => {
    if (!photo) return;

    // Serializamos el objeto a un string JSON
    const picture = JSON.stringify(photo);

    // Navegamos pasando el string en los parámetros de la ruta
    router.replace({
      pathname: "/field-work/(work-flow)/(internal)/detection",
      params: { picture }, // <-- Aquí pasamos el dato
    });
  }, [router, photo]);

  useEffect(() => {
    if (!initialCaptureAttempted.current) {
      initialCaptureAttempted.current = true;
      handleCapture();
    }
  }, [handleCapture]);

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
