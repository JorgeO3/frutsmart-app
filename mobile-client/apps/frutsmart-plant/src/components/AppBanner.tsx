import { StyleSheet, View } from "react-native";

import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import AppView from "@components/AppView";
import { s } from "@utils/responsive";
import AppImage from "./AppImage";

// Definimos la altura inicial visible de la cabecera como una constante
const HEADER_HEIGHT = s(210);

interface SliverProps {
  scrollY: SharedValue<number>;
}

const Sliver = ({ scrollY }: SliverProps) => {
  // La animación de parallax sigue funcionando igual
  const style = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, 120],
      [0, -140],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateY }] };
  });

  return (
    // Este contenedor ahora se posiciona de forma absoluta sobre el contenido
    <Animated.View style={[styles.sliverContainer, style]}>
      {/* Círculo corregido para una curva perfecta */}
      <View style={styles.topCircle} />

      {/* La cabecera con el logo */}
      <View style={styles.header}>
        <AppImage
          resizeMode="contain"
          style={styles.logo}
          alt="Horizontal Logo"
          source={require("@/assets/images/horizontal-logo.webp")}
        />
      </View>
    </Animated.View>
  );
};

interface AppBannerProps {
  backgroundColor?: string;
  children: React.ReactNode;
  disableScroll?: boolean;
}

const AppBanner = ({
  children,
  disableScroll = false,
  backgroundColor = "#ffffff", // Cambiado a blanco para el fondo del contenido
}: AppBannerProps) => {
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  return (
    <AppView
      legalTextColor="#000"
      style={[styles.container, { backgroundColor }]}
    >
      {disableScroll ? (
        <>
          <View
            style={[
              styles.staticContentContainer,
              { paddingTop: HEADER_HEIGHT },
            ]}
          >
            {children}
          </View>
          <Sliver scrollY={scrollY} />
        </>
      ) : (
        <>
          <Animated.ScrollView
            onScroll={onScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: HEADER_HEIGHT,
              backgroundColor: "#ffffff",
              flexGrow: 1,
            }}
            style={styles.scroll}
          >
            {children}
          </Animated.ScrollView>
          {/* El Sliver se renderiza después, por lo que se apila encima del ScrollView */}
          <Sliver scrollY={scrollY} />
        </>
      )}
    </AppView>
  );
};

export default AppBanner;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    width: "100%",
  },
  sliverContainer: {
    // Posicionamiento absoluto para que flote sobre el contenido
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10, // Un zIndex alto para asegurar que esté por encima de todo
  },
  topCircle: {
    // --- CÍRCULO CORREGIDO ---
    width: s(540), // Ancho y alto iguales para un círculo perfecto
    height: s(540),
    borderRadius: s(400), // La mitad del ancho/alto
    backgroundColor: "#155425", // Color del círculo
    position: "absolute",
    // Posicionado para que solo la parte inferior sea visible
    top: -s(540) + HEADER_HEIGHT,
  },
  header: {
    paddingTop: s(15),
    height: HEADER_HEIGHT,
    width: s(300),
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    height: "100%",
    width: "100%",
    top: -s(10),
  },
  staticContentContainer: {
    flex: 1,
    width: "100%",
  },
});
