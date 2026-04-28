import { useCallback, useEffect } from "react";
import {
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { IS_ULTRA_TALL, s, vs } from "@utils/responsive";
import AppButton from "./AppButton";
import AppImage from "./AppImage";
import AppText from "./AppText";

// Constantes
const ANIMATION_DURATION = 300;
const BACKGROUND_OPACITY = 0.5;
const BUTTON_WIDTH = "47%";
const palmOilFruitImage = require("@/assets/images/palm-oil-fruit.webp");

interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  onAccept: () => void;
  description: string;
  acceptText: string;
  cancelText: string;
}

const AppModal = ({
  visible,
  onClose,
  onAccept,
  description,
  acceptText,
  cancelText,
}: AppModalProps) => {
  const animation = useSharedValue(0);

  // Manejo de animaciones
  useEffect(() => {
    animation.value = withTiming(visible ? 1 : 0, {
      duration: ANIMATION_DURATION,
    });
  }, [visible, animation]);

  // Handlers con useCallback para optimización
  const handleClose = useCallback(() => {
    animation.value = withTiming(
      0,
      { duration: ANIMATION_DURATION },
      (finished) => {
        if (finished) {
          runOnJS(onClose)();
        }
      },
    );
  }, [animation, onClose]);

  const handleAccept = useCallback(() => {
    animation.value = withTiming(
      0,
      { duration: ANIMATION_DURATION },
      (finished) => {
        if (finished) {
          runOnJS(onAccept)();
        }
      },
    );
  }, [animation, onAccept]);

  // Estilos animados
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: animation.value,
    transform: [{ scale: animation.value }],
  }));

  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      animation.value,
      [0, 1],
      ["transparent", `rgba(0, 0, 0, ${BACKGROUND_OPACITY})`],
    ),
  }));

  // Prevenir propagación del evento
  const preventEventPropagation = useCallback(() => {}, []);

  return (
    <View>
      <Modal
        transparent
        visible={visible}
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <View style={{ flex: 1 }} collapsable={false}>
          <TouchableWithoutFeedback onPress={handleClose}>
            <Animated.View
              style={[styles.modalBackground, backgroundAnimatedStyle]}
            >
              <TouchableWithoutFeedback onPress={preventEventPropagation}>
                <Animated.View
                  style={[styles.modalContainer, containerAnimatedStyle]}
                >
                  <AppText style={styles.description}>{description}</AppText>

                  <View style={styles.buttonContainer}>
                    <View style={styles.buttonWrapper}>
                      <AppButton
                        size="sm"
                        color="tertiary"
                        title={cancelText}
                        onPress={handleClose}
                      />
                    </View>

                    <View style={styles.buttonWrapper}>
                      <AppButton
                        size="sm"
                        color="warning"
                        title={acceptText}
                        onPress={handleAccept}
                      />
                    </View>
                  </View>

                  <View style={styles.imageContainer}>
                    <View style={styles.imageWrapper}>
                      <AppImage
                        source={palmOilFruitImage}
                        style={styles.image}
                        contentFit="contain"
                        alt="Palm Oil Fruit"
                      />
                    </View>
                  </View>
                </Animated.View>
              </TouchableWithoutFeedback>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "white",
    padding: s(20),
    borderRadius: s(20),
    width: IS_ULTRA_TALL ? "80%" : "70%",
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: s(4),
    elevation: s(5),
    gap: s(15),
  },
  description: {
    color: "#333333",
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: s(10),
  },
  buttonWrapper: {
    width: BUTTON_WIDTH,
  },
  imageContainer: {
    position: "relative",
  },
  imageWrapper: {
    width: s(IS_ULTRA_TALL ? 130 : 100),
    height: vs(100),
    top: -s(33),
    left: "25%",
    position: "absolute",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

export default AppModal;
