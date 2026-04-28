import { useState, useCallback, useRef } from "react";
import { Alert, View, StyleSheet } from "react-native";

import {
  withTiming,
  useSharedValue,
  useAnimatedProps,
} from "react-native-reanimated";
import { useCameraPermissions } from "expo-camera";
import { Gesture } from "react-native-gesture-handler";
import { useIsFocused } from "@react-navigation/native";
import type { CameraView, CameraType } from "expo-camera";

import CameraPresentation from "./CameraPresentation";
import PermissionScreen from "./PermissionScreen";

export type PhotoData = {
  uri: string;
  timestamp: number;
};

interface Props {
  onPhotoCaptured: (photoData: PhotoData) => void;
}

const CameraContainer = ({ onPhotoCaptured }: Props) => {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>("back");
  const [processing, setProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const zoom = useSharedValue(0);
  const animatedProps = useAnimatedProps(() => ({ zoom: zoom.value }));

  // Gestos
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      setCameraType((prev) => (prev === "back" ? "front" : "back"));
    });

  const pinch = Gesture.Pinch().onUpdate((e) => {
    zoom.value = withTiming(Math.max(0, Math.min(e.scale - 1, 1)));
  });

  const gesture = Gesture.Simultaneous(doubleTap, pinch);

  const handleCapture = useCallback(async () => {
    if (cameraRef.current && !processing) {
      setProcessing(true);
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (!photo) throw new Error("No photo captured");
        onPhotoCaptured({ uri: photo.uri, timestamp: Date.now() });
      } catch (e) {
        Alert.alert("Error", "No se pudo capturar la foto");
      } finally {
        setProcessing(false);
      }
    }
  }, [processing, onPhotoCaptured]);

  // Manejo de permisos
  if (!permission) return <View style={styles.errorContainer} />;
  if (!permission.granted) {
    return <PermissionScreen requestPermission={requestPermission} />;
  }

  return (
    <CameraPresentation
      cameraRef={cameraRef}
      cameraType={cameraType}
      processing={processing}
      zoom={zoom}
      animatedProps={animatedProps}
      handleCapture={handleCapture}
      gesture={gesture}
      isFocused={isFocused}
    />
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
});

export default CameraContainer;
