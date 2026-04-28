import { useRef } from "react";
import { StyleSheet, View } from "react-native";

import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";

import { s } from "@utils/responsive";

import AppButton from "@components/AppButton";
import AppText from "@components/AppText";
import AppView from "@components/AppView";

const OverviewScreen = () => {
  const router = useRouter();

  const animation = useRef<LottieView>(null);

  const handleContinue = () => {
    router.replace("/plant-work/work-flow/internal/steps");
  };

  return (
    <AppView style={{ backgroundColor: "#217B26" }}>
      <View style={styles.container}>
        <View style={styles.textContainer}>
          <AppText.H2 color="warning" style={styles.title}>
            Clasificación interna
          </AppText.H2>

          <AppText.BodyL color="secondary" style={styles.bodyText}>
            Registre cuál es el criterio de cosecha para el racimo.
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
    paddingHorizontal: s(20), // Added some horizontal padding for better spacing
  },
  textContainer: {
    alignItems: "center",
    marginTop: s(40),
  },
  title: {
    marginBottom: s(10), // Add some space below the title
  },
  bodyText: {
    textAlign: "center", // Center the body text
    marginBottom: s(20), // Add space below the body text
    paddingHorizontal: s(20), // Add padding to the text block itself
  },
  animationContainer: {
    // You might want to add padding or margin around the animation if needed
    backgroundColor: "#ffffff", // Ensure the background is transparent
    borderRadius: s(10), // Optional: Add some border radius for aesthetics
    justifyContent: "center",
    alignItems: "center",
  },
  lottieAnimation: {
    width: s(300),
    height: s(300),
    backgroundColor: "transparent",
  },
  button: {
    marginVertical: s(20), // Add some space above the button
  },
});
