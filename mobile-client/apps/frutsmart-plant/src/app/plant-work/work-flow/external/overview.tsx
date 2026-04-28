import { useCallback, useRef } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";

import { s } from "@utils/responsive";
import { usePlantWorkActions } from "src/stores/plantWork";

import AppButton from "@components/AppButton";
import AppImage from "@components/AppImage";
import AppText from "@components/AppText";
import AppView from "@components/AppView";
import { processSessionMetadata } from "src/utils/prepareSessionMetadata";

const IMAGE_SIZE = s(80);

interface ExternalCriteriaButtonProps {
  onPress: () => void;
}

// Componentes
const ExternalCriteriaButton = ({ onPress }: ExternalCriteriaButtonProps) => (
  <TouchableOpacity onPress={onPress} style={styles.criteriaButtonTouchable}>
    <View style={styles.criteriaButtonRow}>
      <View style={styles.criteriaButtonContainer}>
        <AppText.H5 color="secondary">¿Cuáles son las clases?</AppText.H5>
      </View>
      <View style={styles.criteriaImageWrapper}>
        <AppImage
          alt="harvest-criteria"
          source={require("@/assets/images/app/plant-work/work-flow/external/overview/clase_1.webp")}
          style={styles.criteriaImage}
        />
      </View>
    </View>
  </TouchableOpacity>
);

const OverviewScreen = () => {
  const router = useRouter();
  const { setMetadata } = usePlantWorkActions();
  const animation = useRef<LottieView>(null);

  const onStart = async () => {
    try {
      await processSessionMetadata({
        setMetadata,
        onOk: () => router.replace("/plant-work/work-flow/external/steps"),
        onError: () => animation.current?.play(),
      });
    } catch {
      /* alert was already shown above */
    }
  };

  const handleCriteriaButtonPress = useCallback(() => {
    router.push("/plant-work/work-flow/external/classification-tutorial");
  }, [router]);

  return (
    <AppView style={{ backgroundColor: "#217B26" }}>
      <View style={styles.container}>
        <View style={styles.textContainer}>
          <AppText.H2 color="warning" style={styles.title}>
            Fotografía Conjunto de Racimos
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

        <ExternalCriteriaButton onPress={handleCriteriaButtonPress} />

        <AppButton
          title="Iniciar"
          color="warning"
          style={styles.button}
          onPress={onStart}
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
    textAlign: "center", // Center the title
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
    borderRadius: 10, // Optional: Add some border radius for aesthetics
  },
  lottieAnimation: {
    width: s(300),
    height: s(300),
    backgroundColor: "transparent",
  },
  button: {
    marginBottom: s(20), // Add some space above the button
  },
  criteriaButtonTouchable: {
    overflow: "visible",
    marginVertical: s(15),
  },
  criteriaButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "visible",
  },
  criteriaButtonContainer: {
    backgroundColor: "#92B516",
    padding: s(15),
    borderRadius: 8,
    width: "85%",
  },
  criteriaImageWrapper: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: IMAGE_SIZE / 2,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -IMAGE_SIZE / 2,
    overflow: "hidden",
    borderWidth: s(3),
    borderColor: "#92B516",
  },
  criteriaImage: {
    width: "100%",
    height: "100%",
  },
  criteriaListContainer: {
    marginTop: s(20),
  },
  criteriaItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: s(15),
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#ccc",
  },
  criteriaRadioButton: {
    borderColor: "#ccc",
  },
});
