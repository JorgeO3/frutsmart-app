import { type Href, useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import AppImage from "@components/AppImage";
import AppText from "@components/AppText";
import { s } from "@utils/responsive";

interface ImgSrc {
  uri: string;
  alt: string;
}

interface Props {
  title: string;
  img: ImgSrc;
  Link: Href;
  onPress?: (href: Href) => void;
}

const HomeMenuCard = ({ title, img, Link, onPress }: Props) => {
  const router = useRouter();
  const scale = useSharedValue(1);

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

    // Si se ha pasado una función 'onPress', se ejecuta y se detiene la navegación.
    if (onPress) {
      onPress(Link);
      return; // Salimos de la función para no ejecutar la lógica de navegación.
    }

    // Si no hay 'onPress', se ejecuta la lógica de navegación original.
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
        <View style={styles.imgWrapper}>
          <View style={styles.imageContainer}>
            <AppImage source={img.uri} alt={img.alt} style={styles.image} />
          </View>
        </View>

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
    position: "relative",
    width: "70%", // 70% del ancho del card
    aspectRatio: 1, // mismo width y height
    borderRadius: 999, // círculo perfecto
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "5%", // espacio relativo bajo la imagen
  },
  imageContainer: {
    position: "absolute",
    width: s(60),
    height: s(60),
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  text: {
    textAlign: "center",
    flexShrink: 1, // para que no desborde si es muy largo
  },
});
