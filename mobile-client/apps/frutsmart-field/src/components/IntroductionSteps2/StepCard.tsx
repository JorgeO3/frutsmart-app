import type React from "react";
import { useEffect } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppCard from "../AppCard";
import ChecksIcon from "./ChecksIcon";
import { FONT_FAMILTY } from "@src/constants/Font";
import {
  withSpring,
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import AppText from "../AppText";
import { scale } from "@utils/responsive";
import { vs, s, font, IS_ULTRA_TALL } from "@utils/responsiveV2";
import AppImage from "../AppImage";

const COLORS = {
  PENDING: "#e94e1a",
  COMPLETED: "#92b516",
};

const SCREEN_PADDING = scale(20);

interface StepCardProps {
  index: number;
  title: string;
  imgSrc: string;
  description: string;
  isCompleted: boolean;
  onPress: () => void;
}

export const StepCard = (props: StepCardProps) => {
  const { index, title, imgSrc, description, isCompleted, onPress } = props;

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const availableWidth = screenWidth - SCREEN_PADDING * 2;
  // Anchura de la card: 75% de la pantalla
  const cardWidth = availableWidth * 0.78;
  // Tamaño de la imagen: 15% de la card
  const imageSize = cardWidth * 0.25;

  // Circle size
  const circleSize = s(36); // 60% del tamaño de la imagen

  // Constantes para calcular altura mínima
  const PAD_VERTICAL = vs(12); // paddingVertical de AppCard
  const ICON_HEIGHT = s(28); // altura fija del contenedor de ChecksIcon
  const ICON_BOTTOM = vs(8); // bottom offset de ChecksIcon
  // Altura necesaria para la imagen + paddings
  const minForImage = imageSize + PAD_VERTICAL * 2;
  // Altura total considerando el icono
  const minForIcon = ICON_HEIGHT + ICON_BOTTOM;
  // Altura basada en % del alto de pantalla
  const baseHeight = screenHeight * 0.13; // 20% de la pantalla
  // Elige la mayor de las tres
  const cardHeight = Math.max(baseHeight, minForImage + minForIcon);

  const isLeft = index % 2 === 1;
  const color = isCompleted ? COLORS.COMPLETED : COLORS.PENDING;

  // Animación de entrada
  const translateX = useSharedValue(isLeft ? -screenWidth : screenWidth);
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    translateX.value = withSpring(0, { damping: 25, stiffness: 100, mass: 1 });
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const ellipsis = (str: string, max: number) =>
    str.length > max ? `${str.slice(0, max)}…` : str;

  return (
    <View
      style={[
        styles.container,
        { justifyContent: isLeft ? "flex-start" : "flex-end" },
      ]}
      onTouchEnd={onPress}
    >
      {/* Círculo índice */}
      {isLeft && (
        <View
          style={[
            styles.circle,
            {
              width: circleSize, // para que el círculo también escale
              height: circleSize,
              borderRadius: circleSize / 2,
              backgroundColor: color,
              marginRight: s(8),
            },
          ]}
        >
          <AppText.H3
            style={[styles.circleText, { fontSize: circleSize * 0.5 }]}
          >
            {index}
          </AppText.H3>
        </View>
      )}

      {/* Card con altura fija responsive */}
      <AppCard
        style={[
          styles.card,
          {
            width: s(270),
            height: s(100),
            borderColor: color,
          },
          animStyle,
        ]}
      >
        <LinearGradient
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 0 }}
          colors={[color, "transparent"]}
          style={[
            StyleSheet.absoluteFill,
            { justifyContent: "center", alignItems: "center" },
          ]}
        />

        {/* Imagen circular */}
        <View
          style={[
            styles.imageWrapper,
            {
              width: s(70),
              height: s(70),
              borderRadius: s(80) / 2,
            },
          ]}
        >
          <AppImage
            source={imgSrc}
            style={styles.image}
            contentFit="contain"
            alt="Step Image"
          />
        </View>

        {/* Texto con paddingBottom para no tapar el icono */}
        <View style={[styles.textWrapper]}>
          <AppText.H5
            style={{
              color,
              fontSize: font.scale(12, { min: 12, max: 18 }),
              ...(IS_ULTRA_TALL ? { fontWeight: "900" } : {}),
            }}
          >
            {title}
          </AppText.H5>
          <View
            style={{
              display: "flex",
              flexDirection: "row",
              height: s(70),
              width: "100%",
              justifyContent: "space-between",
            }}
          >
            <AppText.BodyXS
              style={{
                width: "80%",
                fontSize: font.scale(IS_ULTRA_TALL ? 12 : 14, {
                  min: 12,
                  max: 15,
                }),
              }}
            >
              {description}
            </AppText.BodyXS>
            <ChecksIcon isCompleted={isCompleted} iconColor={color} />
          </View>
        </View>

        {/* Icono absoluto en la esquina inferior derecha */}
      </AppCard>

      {!isLeft && (
        <View
          style={[
            styles.circle,
            {
              width: circleSize, // para que el círculo también escale
              height: circleSize,
              borderRadius: circleSize / 2,
              backgroundColor: color,
              marginLeft: s(8),
            },
          ]}
        >
          <Text style={[styles.circleText, { fontSize: circleSize * 0.45 }]}>
            {index}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(16),
    marginVertical: vs(8),
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderRadius: scale(8),
    paddingTop: s(10),
    paddingLeft: s(10),
    overflow: "hidden",
    alignItems: "center",
  },
  circle: {
    alignItems: "center",
    justifyContent: "center",
  },
  circleText: {
    color: "#fff",
    fontFamily: FONT_FAMILTY,
  },
  imageWrapper: {
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: scale(16),
  },
  image: {
    width: "85%",
    height: "85%",
  },
  textWrapper: {
    flex: 1,
    flexDirection: "column",
    height: "100%",
  },
});
