import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

import AppImage from "@components/AppImage";
import { normalizeFont, scale as scaleR } from "@/src/utils/responsive";

interface AnimatedCardProps {
  label: string;
  imgSrc: string;
  isSelected: boolean;
  onPress: () => void;
}

export function AnimatedCard({
  label,
  imgSrc,
  isSelected,
  onPress,
}: AnimatedCardProps) {
  const scale = useSharedValue(1);
  const ani = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.95);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[styles.card, ani, isSelected && styles.cardSelected]}
      >
        <AppImage
          source={imgSrc}
          style={{ width: scaleR(80), height: scaleR(80) }}
          alt="Imagen de selección"
        />
        <Text style={styles.cardText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#afb0b1",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cardSelected: {
    backgroundColor: "#92B516",
  },
  cardText: {
    color: "#ffffff",
    fontSize: normalizeFont(30),
    fontWeight: "bold",
  },
});
