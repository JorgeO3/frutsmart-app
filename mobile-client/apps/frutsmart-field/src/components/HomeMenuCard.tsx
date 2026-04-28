import React, { use, useEffect } from "react";
import { View, Pressable, StyleSheet } from "react-native";

import { type Href, useRouter } from "expo-router";
import AppImage from "./AppImage";
import AppText from "./AppText";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { s } from "../utils/responsiveV2";

interface ImgSrc {
  uri: string;
  alt: string;
}

interface Props {
  title: string;
  img: ImgSrc;
  Link: Href; // Href
}

const HomeMenuCard = ({ title, img, Link }: Props) => {
  const router = useRouter();
  const scale = useSharedValue(1);

  // Animación al pulsar
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(scale.value, {
          damping: 20,
          stiffness: 150,
        }),
      },
    ],
  }));

  const handlePressIn = () => {
    scale.value = 0.95;
  };
  const handlePressOut = () => {
    scale.value = 1;

    if (title === "Configuración") {
      router.replace(Link);
    } else {
      router.push(Link);
    }
  };

  return (
    <Pressable
      style={styles.pressable}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.container, animatedStyle]}>
        {/* — Contenedor de la imagen — */}
        <View style={styles.imgWrapper}>
          <AppImage source={img.uri} alt={img.alt} style={styles.image} />
        </View>

        {/* — Título centrado bajo la imagen — */}
        <AppText.BodyS style={styles.text} numberOfLines={2}>
          {title}
        </AppText.BodyS>
      </Animated.View>
    </Pressable>
  );
};

export default HomeMenuCard;

const styles = StyleSheet.create({
  pressable: {
    flex: 1, // para llenar el 48% definido en el wrapper
  },
  container: {
    flex: 1, // ocupa todo el espacio del wrapper
    borderRadius: 16,
    backgroundColor: "#EBEBEB",
    padding: s(5),
    justifyContent: "space-around",
    alignItems: "center",
    // Sombra Android/iOS
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  imgWrapper: {
    width: "60%", // 40% del ancho del card
    aspectRatio: 1, // mismo width y height
    borderRadius: 999, // círculo perfecto
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "5%", // espacio relativo bajo la imagen
    padding: "10%", // padding relativo al ancho del padre
  },
  image: {
    width: "100%", // 80% del imgWrapper
    height: "100%",
    resizeMode: "contain",
  },
  text: {
    textAlign: "center",
    flexShrink: 1, // para que no desborde si es muy largo
  },
});
