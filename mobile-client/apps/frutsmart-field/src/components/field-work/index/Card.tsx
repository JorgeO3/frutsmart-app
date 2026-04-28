import React, { memo, useCallback, useState } from "react";
import { Text, View, StyleSheet, type LayoutChangeEvent } from "react-native";

import { font, s, vs } from "@utils/responsiveV2";

import AppImage from "@components/AppImage";

const palmImageSource = require("@assets/images/palm-oil-icon.webp");

const CardImage = memo(() => (
  <AppImage
    source={palmImageSource}
    style={styles.image}
    contentFit="contain"
    transition={0}
    alt="Palm Oil Icon"
    allowDownscaling
    priority="low"
    cachePolicy="memory-disk"
  />
));

interface CardProps {
  id: string;
  label: string;
  isSelected: boolean;
  onPress: (id: string) => void;
}

const arePropsEqual = (prev: CardProps, next: CardProps) => {
  return prev.label === next.label && prev.isSelected === next.isSelected;
};

const Card = ({ id, label, isSelected, onPress }: CardProps) => {
  const handlePress = useCallback(() => onPress(id), [onPress, id]);
  const [hasBeenMeasured, setHasBeenMeasured] = useState(false);

  const handleLayout = (event: LayoutChangeEvent) => {
    // Nos aseguramos de medir y mostrar el log solo una vez
    // para no llenar la consola en cada render.
    if (!hasBeenMeasured) {
      const { width, height } = event.nativeEvent.layout;
      console.log("✅ Tamaño real del Card:", { width, height });
      setHasBeenMeasured(true);
    }
  };

  return (
    <View
      onLayout={handleLayout}
      onTouchEnd={handlePress}
      style={[styles.card, isSelected && styles.cardSelected]}
    >
      <CardImage />
      <Text style={styles.cardText} numberOfLines={2} ellipsizeMode="tail">
        {label}
      </Text>
    </View>
  );
};

export default memo(Card, arePropsEqual);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#92B516",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    padding: s(10),
    aspectRatio: 1,
    margin: s(4), // Espaciado gestionado por el propio item
  },
  cardSelected: {
    backgroundColor: "#227C26",
  },
  cardPressed: {
    opacity: 0.7,
  },
  image: {
    width: s(60),
    height: s(60),
  },
  cardText: {
    color: "#ffffff",
    fontSize: font.scale(24),
    fontWeight: "bold",
    textAlign: "center",
    marginTop: s(8),
  },
});
