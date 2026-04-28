import { useEffect } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { font, IS_ULTRA_TALL, s, vs } from "@utils/responsive";
import { FONT_FAMILTY } from "src/constants/font";

import AppCard from "../AppCard";
import AppImage from "../AppImage";
import AppText from "../AppText";
import ChecksIcon from "./ChecksIcon";

const COLORS = {
  PENDING: "#e94e1a",
  COMPLETED: "#92b516",
};

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

  const { width: screenWidth } = useWindowDimensions();

  // Circle size
  const circleSize = s(36); // 60% del tamaño de la imagen

  const isLeft = index % 2 === 1;
  const color = isCompleted ? COLORS.COMPLETED : COLORS.PENDING;

  // Animación de entrada
  const translateX = useSharedValue(isLeft ? -screenWidth : screenWidth);
  // biome-ignore lint/correctness/useExhaustiveDependencies: This effect runs only once on mount.
  useEffect(() => {
    translateX.value = withSpring(0, { damping: 25, stiffness: 100, mass: 1 });
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

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
    borderRadius: s(8),
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
    marginRight: s(16),
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
