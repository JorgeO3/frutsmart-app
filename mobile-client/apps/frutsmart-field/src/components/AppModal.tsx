import React, { useEffect } from "react";
import {
  View,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

import { scale } from "../utils/responsive";

import AppText from "./AppText";
import AppButton from "./AppButton";
import AppImage from "./AppImage";
import { s, IS_ULTRA_TALL, vs } from "@utils/responsiveV2";

interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  onAccept: () => void;
  description: string;
  acceptText: string;
  cancelText: string;
}

const AppModal = (props: AppModalProps) => {
  const { onClose, visible, onAccept, acceptText, cancelText, description } =
    props;

  const animation = useSharedValue(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: This effect runs only when `visible` changes
  useEffect(() => {
    if (visible) {
      animation.value = withTiming(1, { duration: 300 });
    } else {
      animation.value = withTiming(0, { duration: 300 });
    }
  }, [visible]);

  const handleClose = () => {
    animation.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  };

  const handleAccept = () => {
    animation.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(onAccept)();
      }
    });
  };

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: animation.value,
    transform: [{ scale: animation.value }],
  }));

  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(0, 0, 0, ${animation.value * 0.5})`,
  }));

  return (
    <View>
      <Modal
        transparent
        visible={visible}
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View
            style={[styles.modalBackground, backgroundAnimatedStyle]}
          >
            <TouchableWithoutFeedback onPress={() => {}}>
              <Animated.View
                style={[styles.modalContainer, containerAnimatedStyle]}
              >
                {/* Descripción */}
                <AppText style={{ color: "#333333", textAlign: "center" }}>
                  {description}
                </AppText>

                {/* Botones de acción */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: scale(10),
                  }}
                >
                  <View style={{ width: "47%" }}>
                    <AppButton
                      size="sm"
                      color="tertiary"
                      title={cancelText}
                      onPress={handleClose}
                    />
                  </View>

                  <View style={{ width: "47%" }}>
                    <AppButton
                      size="sm"
                      color="warning"
                      title={acceptText}
                      onPress={handleAccept}
                    />
                  </View>
                </View>

                <View style={{ position: "relative" }}>
                  <View
                    style={{
                      width: s(IS_ULTRA_TALL ? 130 : 100),
                      height: vs(100),
                      top: -s(33),
                      left: "25%",
                      position: "absolute",
                    }}
                  >
                    <AppImage
                      source={require("@/assets/images/field-work/(work-flow)/(external)/classification-result/palm-oil-fruit.webp")}
                      style={{
                        width: "100%",
                        height: "100%",
                      }}
                      contentFit="contain"
                      alt="Palm Oil Fruit"
                    />
                  </View>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default AppModal;

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "white",
    padding: scale(20),
    borderRadius: scale(20),
    width: IS_ULTRA_TALL ? "80%" : "70%",
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: scale(4),
    elevation: scale(5),
    gap: scale(15),
  },
  header: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});
