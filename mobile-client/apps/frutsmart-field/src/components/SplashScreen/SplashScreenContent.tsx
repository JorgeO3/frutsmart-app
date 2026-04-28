import { useEffect } from "react";
import { Text, StyleSheet, View } from "react-native";

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { scale, normalizeFont } from "@utils/responsive";
import { FONT_FAMILTY, FONT_WEIGHT } from "@src/constants/Font";

import AppImage from "@components/AppImage";

interface SplashScreenContentProps {
  onAnimationComplete?: () => void;
  dataLoaded: boolean;
}

const frutoSmartLegalInfo =
  "FrutoSmart ® S.A.S. Todos los derechos reservados 2025";

const SplashScreenContent = ({
  onAnimationComplete,
  dataLoaded,
}: SplashScreenContentProps) => {
  const insets = useSafeAreaInsets();

  const ANIMATION_DURATION = 500;

  // Valores animados compartidos
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const logoScale = useSharedValue(0.8);
  const legalOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const sloganOpacity = useSharedValue(0);

  const startAnimation = () => {
    console.log("[Splash] startAnimation()", Date.now());

    // Animación de entrada
    opacity.value = withTiming(1, { duration: ANIMATION_DURATION }, () => {
      console.log("[Splash] fade‑in finished", Date.now());
    });
    scale.value = withTiming(1, { duration: ANIMATION_DURATION });
    logoScale.value = withSequence(
      withTiming(1.1, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1, { duration: 300 }),
    );

    titleOpacity.value = withDelay(
      ANIMATION_DURATION * 0.8,
      withTiming(1, { duration: ANIMATION_DURATION }),
    );

    sloganOpacity.value = withDelay(
      ANIMATION_DURATION * 1.4,
      withTiming(1, { duration: ANIMATION_DURATION }),
    );

    legalOpacity.value = withDelay(
      ANIMATION_DURATION * 1.6,
      withTiming(1, { duration: ANIMATION_DURATION }),
    );
  };

  const exitAnimation = () => {
    console.log("[Splash] exitAnimation()", Date.now());

    // Animación de salida en orden inverso
    legalOpacity.value = withTiming(0, {
      duration: ANIMATION_DURATION * 0.7,
    });

    sloganOpacity.value = withDelay(
      ANIMATION_DURATION * 0.2,
      withTiming(0, { duration: ANIMATION_DURATION * 0.7 }),
    );

    titleOpacity.value = withDelay(
      ANIMATION_DURATION * 0.4,
      withTiming(0, { duration: ANIMATION_DURATION * 0.7 }),
    );

    logoScale.value = withDelay(
      ANIMATION_DURATION * 0.6,
      withTiming(0.8, { duration: ANIMATION_DURATION }),
    );

    opacity.value = withDelay(
      ANIMATION_DURATION * 0.8,
      withTiming(
        0,
        { duration: ANIMATION_DURATION, easing: Easing.in(Easing.cubic) },
        () => {
          console.log("[Splash] fade‑out finished", Date.now());
          onAnimationComplete && runOnJS(onAnimationComplete)();
        },
      ),
    );

    scale.value = withDelay(
      ANIMATION_DURATION * 0.8,
      withTiming(0.9, { duration: ANIMATION_DURATION }),
    );
  };

  // Animación de entrada al montar el componente
  // biome-ignore lint/correctness/useExhaustiveDependencies: this is a one-time effect
  useEffect(() => {
    startAnimation();
  }, []);

  // Cuando la data está cargada, se dispara la animación de salida
  // biome-ignore lint/correctness/useExhaustiveDependencies: this is a one-time effect
  useEffect(() => {
    if (dataLoaded) {
      exitAnimation();
    }
  }, [dataLoaded]);

  // Estilos animados
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const sloganAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sloganOpacity.value,
  }));

  const legalAnimatedStyle = useAnimatedStyle(() => ({
    opacity: legalOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        containerAnimatedStyle,
        { paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.subContainer}>
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <AppImage
            source={require("@assets/images/logo.webp")}
            style={styles.logoImage}
            alt="FrutoSmart Logo"
          />
        </Animated.View>

        <Animated.View style={[styles.titleContainer, titleAnimatedStyle]}>
          <Text style={styles.logoText}>FrutSmart</Text>
        </Animated.View>

        <Animated.View style={sloganAnimatedStyle}>
          <Text style={styles.tecnologiaText}>
            Tecnología que Cultiva el futuro
          </Text>
        </Animated.View>
      </View>

      <Animated.Text style={[styles.legalInfoText, legalAnimatedStyle]}>
        {frutoSmartLegalInfo}
      </Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    paddingVertical: scale(30),
  },
  subContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
  },
  logoImage: {
    height: scale(250),
    width: scale(250),
  },
  titleContainer: {
    alignItems: "center",
    marginTop: -15,
  },
  logoText: {
    fontSize: normalizeFont(70),
    fontFamily: FONT_FAMILTY,
    fontWeight: FONT_WEIGHT.black,
    color: "#e13510",
  },
  tecnologiaText: {
    color: "#185527",
    fontSize: normalizeFont(18),
    fontFamily: FONT_FAMILTY,
    fontWeight: FONT_WEIGHT.regular,
    marginTop: scale(-5),
  },
  legalInfoText: {
    bottom: scale(15),
    fontSize: normalizeFont(12),
    fontFamily: FONT_FAMILTY,
    fontWeight: FONT_WEIGHT.medium,
  },
});

export { SplashScreenContent };
