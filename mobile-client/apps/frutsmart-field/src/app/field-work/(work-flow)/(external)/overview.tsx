import React, { useRef } from "react";
import { View, StyleSheet, Alert } from "react-native";

import { useRouter } from "expo-router";
import * as Network from "expo-network";
import * as Location from "expo-location";
import LottieView from "lottie-react-native";

import { scale } from "@utils/responsive";
import {
  type Metadata,
  useFieldWorkActions,
  useTraceability,
} from "@/src/stores/fieldWork";

import AppText from "@components/AppText";
import AppView from "@components/AppView";
import AppButton from "@components/AppButton";

const OverviewScreen = () => {
  const router = useRouter();
  const traceability = useTraceability();
  const animation = useRef<LottieView>(null);

  console.log("Traceability Data:", traceability);

  const { setMetadata } = useFieldWorkActions();

  const handleContinue = async () => {
    try {
      // 1. Pedir permisos de ubicación
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Se necesita permiso de ubicación para continuar.");
      }

      const [location, networkState] = await Promise.all([
        Location.getCurrentPositionAsync(),
        Network.getNetworkStateAsync(),
      ]);

      // 3. Construir el objeto de metadatos
      const metadata: Metadata = {
        creationTimestamp: new Date().toISOString(),
        device: {
          timeOfDay:
            new Date().getHours() >= 6 && new Date().getHours() < 18
              ? "day"
              : "night",
          weather: "Despejado", // Placeholder, se podría integrar con una API de clima
          hasInternet: !!networkState.isInternetReachable,
        },
        geolocation: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      };

      setMetadata(metadata);

      router.replace("/field-work/(work-flow)/(external)/steps");
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Error",
        "Ocurrió un error al intentar continuar. Por favor, inténtalo de nuevo más tarde.",
      );
      if (animation.current) {
        animation.current.play();
      }
    }
  };

  return (
    <AppView style={{ backgroundColor: "#217B26" }}>
      <View style={styles.container}>
        <View style={styles.textContainer}>
          <AppText.H2 color="warning" style={styles.title}>
            Fotografía Racimos
          </AppText.H2>

          <AppText color="secondary" style={styles.bodyText}>
            Para garantizar una precisión adecuada de la clasificación, tenga en
            cuenta los siguientes pasos...
          </AppText>
        </View>

        <View style={styles.animationContainer}>
          <LottieView
            autoPlay
            ref={animation}
            style={styles.lottieAnimation}
            source={require("@assets/animations/camera.json")}
          />
        </View>

        <AppButton
          title="Iniciar"
          style={styles.button}
          onPress={handleContinue}
        />
      </View>
    </AppView>
  );
};

export default OverviewScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: scale(20), // Added some horizontal padding for better spacing
  },
  textContainer: {
    alignItems: "center",
    marginTop: scale(40),
  },
  title: {
    marginBottom: scale(10), // Add some space below the title
  },
  bodyText: {
    textAlign: "center", // Center the body text
    marginBottom: scale(20), // Add space below the body text
    paddingHorizontal: scale(20), // Add padding to the text block itself
  },
  animationContainer: {
    // You might want to add padding or margin around the animation if needed
    backgroundColor: "#ffffff", // Ensure the background is transparent
    borderRadius: 10, // Optional: Add some border radius for aesthetics
  },
  lottieAnimation: {
    width: scale(300),
    height: scale(300),
    backgroundColor: "transparent",
  },
  button: {
    marginVertical: scale(20), // Add some space above the button
  },
});
