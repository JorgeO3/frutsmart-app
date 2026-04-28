import type React from "react";
import { useEffect } from "react";
import {
  View,
  Modal,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import DateTimePicker, {
  type DateType,
  useDefaultStyles,
} from "react-native-ui-datepicker";

import ActionButtons from "./ActionButtons";
import { datePickerStyles } from "./AppDatePickerStyles";

// Props para el modal del calendario
interface AppDatePikerProps {
  headerText: string;
  visible: boolean;
  selected?: DateType;
  onDateChange: ({ date }: { date: DateType }) => void;
  onClose: () => void;
  onAccept: () => void;
}

// Componente del modal del calendario con animaciones
function AppDatePiker({
  visible,
  selected,
  onDateChange,
  onClose,
  onAccept,
}: AppDatePikerProps) {
  const defaultStyles = useDefaultStyles();
  const animation = useSharedValue(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (visible) {
      animation.value = withTiming(1, { duration: 300 });
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
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerText}>Selecciona una fecha</Text>
              </View>

              {/* Calendario */}
              <DateTimePicker
                locale="es"
                mode="single"
                date={selected}
                onChange={onDateChange}
                styles={{ ...defaultStyles, ...datePickerStyles }}
              />

              {/* Botones de acción */}
              <ActionButtons onCancel={handleClose} onAccept={handleAccept} />
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "white",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 20,
    width: "90%",
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  headerText: {
    fontSize: 18,
    color: "#333333",
    textAlign: "center",
    marginBottom: 10,
  },
});

export default AppDatePiker;
