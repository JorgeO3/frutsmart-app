import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";

import { CameraView, type CameraType } from "expo-camera";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { type SharedValue } from "react-native-reanimated";

const AnimatedCameraView = Animated.createAnimatedComponent(CameraView);

type CameraPresentationProps = {
  cameraRef: React.RefObject<CameraView>;
  cameraType: CameraType;
  processing: boolean;
  zoom: SharedValue<number>;
  animatedProps: any;
  handleCapture: () => void;
  gesture: any;
  isFocused: boolean;
};

const CameraPresentation = ({
  cameraRef,
  cameraType,
  processing,
  gesture,
  animatedProps,
  handleCapture,
  isFocused,
}: CameraPresentationProps) => {
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  loader: {
    position: "absolute",
    top: "50%",
    alignSelf: "center",
  },
});

export default CameraPresentation;
