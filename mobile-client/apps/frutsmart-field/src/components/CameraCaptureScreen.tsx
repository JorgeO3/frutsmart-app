import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { CameraView, type CameraType, useCameraPermissions } from "expo-camera";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
} from "react-native-reanimated";

type PhotoData = {
  uri: string;
  timestamp: number;
};

interface Props {
  onPhotoCaptured: (photoData: PhotoData) => void;
}

interface CapturedPhoto {
  uri: string;
  timestamp: number;
}

const AnimatedCameraView = Animated.createAnimatedComponent(CameraView);

export default function CameraCaptureScreen({ onPhotoCaptured }: Props) {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>("back");
  const [processing, setProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const zoom = useSharedValue(0);
  const animatedProps = useAnimatedProps(() => ({ zoom: zoom.value }));

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

  if (!permission) return <View style={styles.errorContainer} />;
  if (!permission.granted) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Permisos necesarios para cámara</Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={styles.permissionBtn}
        >
          <Text style={styles.permissionText}>Conceder permisos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.container}>
        {isFocused && !processing && (
          <AnimatedCameraView
            ref={cameraRef}
            style={styles.camera}
            active={true}
            facing={cameraType}
            ratio="16:9"
            animatedProps={animatedProps}
          />
        )}
        {processing && <ActivityIndicator size="large" style={styles.loader} />}
        {!processing && (
          <TouchableOpacity style={styles.captureBtn} onPress={handleCapture}>
            <Text style={styles.captureText}>Capturar</Text>
          </TouchableOpacity>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraContainer: {
    height: "70%",
    width: "100%",
    marginTop: 20,
  },
  camera: {
    flex: 1,
    borderRadius: 10,
  },
  captureBtn: {
    backgroundColor: "#E74C3C",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 10,
    alignSelf: "center",
  },
  captureText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "red",
    textAlign: "center",
  },
  permissionBtn: {
    backgroundColor: "#2E86C1",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permissionText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  // Loading indicator overlay
  loader: { position: "absolute", top: "50%", alignSelf: "center" },
});
