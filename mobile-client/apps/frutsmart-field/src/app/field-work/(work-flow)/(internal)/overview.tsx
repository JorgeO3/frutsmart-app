import React, { useRef } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";

import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";

import { scale } from "@utils/responsive";
import { useThemeColor } from "@hooks/useThemeColor";

import AppText from "@components/AppText";
import AppView from "@components/AppView";
import AppButton from "@components/AppButton";

const OverviewScreen = () => {
  const router = useRouter();

  const animation = useRef<LottieView>(null);
  const backgroundColor = useThemeColor({}, "backgroundSecondary");

  const handleContinue = () => {
    router.replace("/field-work/(work-flow)/(internal)/steps");
  };

  return (
    <AppView style={{ backgroundColor }}>
      <View style={styles.container}>
        <View style={styles.textContainer}>
          <AppText.H2 color="warning" style={styles.title}>
            Fotografía Racimos
          </AppText.H2>

          <AppText.BodyL color="secondary" style={styles.bodyText}>
            Para garantizar una precisión adecuada de la clasificación, tenga en
            cuenta los siguientes pasos...
          </AppText.BodyL>
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
    borderRadius: scale(10), // Optional: Add some border radius for aesthetics
    justifyContent: "center",
    alignItems: "center",
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
