import { SplashScreen as ExpoSplash } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppImage from "@components/AppImage";
import { FONT_FAMILTY, FONT_WEIGHT } from "src/constants/font";
import { font, s } from "../utils/responsive";

// Constantes de animación
const ANIMATION_DURATION = {
  FADE_IN: 500,
  FADE_OUT: 400,
  LOGO_BOUNCE: 300,
} as const;

const ANIMATION_DELAYS = {
  TITLE: 0.8,
  SLOGAN: 1.4,
  LEGAL: 1.6,
  EXIT_STAGGER: 0.2,
} as const;

interface AppSplashProps {
  onComplete: () => void;
  isAppReady: boolean;
}

export default function AppSplash({ onComplete, isAppReady }: AppSplashProps) {
  console.log("[DIAG] AppSplash mount — isAppReady:", isAppReady);
  const insets = useSafeAreaInsets();
  const [isVisible, setIsVisible] = useState(true);
  const [hasStartedExit, setHasStartedExit] = useState(false);

  // Shared values para animaciones
  const opacity = useSharedValue(0);
  const containerScale = useSharedValue(0.8);
  const logoScale = useSharedValue(0.8);
  const titleOpacity = useSharedValue(0);
  const sloganOpacity = useSharedValue(0);
  const legalOpacity = useSharedValue(0);

  // Animación de entrada - se ejecuta al montar
  const startEntranceAnimation = useCallback(() => {
    console.log("[DIAG] AppSplash entrance animation started");
    const { FADE_IN, LOGO_BOUNCE } = ANIMATION_DURATION;
    const { TITLE, SLOGAN, LEGAL } = ANIMATION_DELAYS;

    // Fade in general
    opacity.value = withTiming(1, { duration: FADE_IN });
    containerScale.value = withTiming(1, { duration: FADE_IN });

    // Logo con efecto bounce
    logoScale.value = withSequence(
      withTiming(1.1, { duration: FADE_IN, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: LOGO_BOUNCE }),
    );

    // Textos escalonados
    titleOpacity.value = withDelay(
      FADE_IN * TITLE,
      withTiming(1, { duration: FADE_IN }),
    );
    sloganOpacity.value = withDelay(
      FADE_IN * SLOGAN,
      withTiming(1, { duration: FADE_IN }),
    );
    legalOpacity.value = withDelay(
      FADE_IN * LEGAL,
      withTiming(1, { duration: FADE_IN }),
    );
  }, [
    opacity,
    containerScale,
    logoScale,
    titleOpacity,
    sloganOpacity,
    legalOpacity,
  ]);

  // Animación de salida
  const startExitAnimation = useCallback(() => {
    console.log("[DIAG] AppSplash startExitAnimation — isAppReady:", isAppReady);
    if (hasStartedExit) return;
    setHasStartedExit(true);

    const { FADE_OUT } = ANIMATION_DURATION;
    const { EXIT_STAGGER } = ANIMATION_DELAYS;

    // Salida escalonada (orden inverso)
    legalOpacity.value = withTiming(0, { duration: FADE_OUT * 0.7 });
    sloganOpacity.value = withDelay(
      FADE_OUT * EXIT_STAGGER,
      withTiming(0, { duration: FADE_OUT * 0.7 }),
    );
    titleOpacity.value = withDelay(
      FADE_OUT * EXIT_STAGGER * 2,
      withTiming(0, { duration: FADE_OUT * 0.7 }),
    );
    logoScale.value = withDelay(
      FADE_OUT * EXIT_STAGGER * 3,
      withTiming(0.8, { duration: FADE_OUT }),
    );

    // Fade out final con callback
    opacity.value = withDelay(
      FADE_OUT * EXIT_STAGGER * 4,
      withTiming(
        0,
        {
          duration: FADE_OUT,
          easing: Easing.in(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            console.log("[DIAG] AppSplash exit animation finished — calling onComplete");
            runOnJS(setIsVisible)(false);
            runOnJS(onComplete)();
          }
        },
      ),
    );

    containerScale.value = withDelay(
      FADE_OUT * EXIT_STAGGER * 4,
      withTiming(0.9, { duration: FADE_OUT }),
    );
  }, [
    hasStartedExit,
    legalOpacity,
    sloganOpacity,
    titleOpacity,
    logoScale,
    opacity,
    containerScale,
    onComplete,
  ]);

  // Efecto para iniciar animación de entrada
  useEffect(() => {
    startEntranceAnimation();
  }, [startEntranceAnimation]);

  // Efecto para manejar cuando la app está lista
  useEffect(() => {
    if (isAppReady && !hasStartedExit) {
      startExitAnimation();
    }
  }, [isAppReady, hasStartedExit, startExitAnimation]);

  // Estilos animados
  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const animatedTitleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const animatedSloganStyle = useAnimatedStyle(() => ({
    opacity: sloganOpacity.value,
  }));

  const animatedLegalStyle = useAnimatedStyle(() => ({
    opacity: legalOpacity.value,
  }));

  // Ocultar splash nativo cuando el overlay está listo
  const handleLayout = () => {
    ExpoSplash.hideAsync().catch(() => {
      // Ignorar errores silenciosamente
    });
  };

  // Early return si no es visible
  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[
        StyleSheet.absoluteFill,
        styles.container,
        animatedContainerStyle,
      ]}
      testID="app-splash-screen"
    >
      <View style={[styles.content, { paddingBottom: insets.bottom + s(20) }]}>
        <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
          <AppImage
            source={require("@assets/images/logo.webp")}
            style={styles.logoImage}
            alt="FrutoSmart Logo"
          />
        </Animated.View>

        <Animated.View style={[styles.titleContainer, animatedTitleStyle]}>
          <Text style={styles.titleText}>FrutSmart</Text>
        </Animated.View>

        <Animated.View style={animatedSloganStyle}>
          <Text style={styles.sloganText}>
            Tecnología que Cultiva el futuro
          </Text>
        </Animated.View>
      </View>

      <Animated.Text
        style={[
          styles.legalText,
          animatedLegalStyle,
          { paddingBottom: insets.bottom },
        ]}
      >
        FrutoSmart ® S.A.S. Todos los derechos reservados 2025
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
  },
  logoImage: {
    width: s(250),
    height: s(250),
  },
  titleContainer: {
    alignItems: "center",
    marginTop: -15,
  },
  titleText: {
    fontSize: font.scale(70),
    fontFamily: FONT_FAMILTY,
    fontWeight: FONT_WEIGHT.black,
    color: "#e13510",
  },
  sloganText: {
    color: "#185527",
    fontSize: font.scale(18),
    fontFamily: FONT_FAMILTY,
    fontWeight: FONT_WEIGHT.regular,
    marginTop: s(-5),
  },
  legalText: {
    position: "absolute",
    bottom: s(15),
    fontSize: font.scale(12),
    fontFamily: FONT_FAMILTY,
    fontWeight: FONT_WEIGHT.medium,
  },
});
