import { StyleSheet, View } from "react-native";

// import { useRouter } from "expo-router";

import { useFieldQualityActions } from "@stores/fieldQuality";
import { useSelectionActions } from "@stores/qualitySelection";
import { useClassificationCounterActions } from "src/stores/classificationCounter";

import AppBanner from "@components/AppBanner";
import AppButton from "@components/AppButton";
import AppImage from "@components/AppImage";
import AppText from "@components/AppText";

const EndScreen = () => {
  // const router = useRouter();
  const { reset: resetExt } = useClassificationCounterActions();
  const { clearAll: resetSelection } = useSelectionActions();
  const { reset: resetFieldQuality, resetClassificationData } =
    useFieldQualityActions();

  const handleContinue = () => {
    resetExt();
    resetClassificationData();
    // router.replace("/field-work/confirm-lot");
  };

  const handleFinish = () => {
    resetExt();
    resetSelection();
    resetFieldQuality();
    // router.replace("/field-work/overall-summary");
  };

  return (
    <AppBanner backgroundColor="white">
      <View style={styles.container}>
        <View style={styles.contentContainer}>
          <AppImage
            alt="Palm Oil Fruit"
            style={styles.image}
            source={require("@/assets/images/app/plant-work/work-flow/end/palm-oil-fruit.png")}
          />

          <AppText.H2 style={styles.title}>
            Si desea continuar con el proceso, presione el botón "Continuar con
            otro racimo".
          </AppText.H2>
        </View>

        <View style={styles.buttonContainer}>
          <AppButton
            color="warning"
            title="Continuar con otro racimo"
            onPress={handleContinue}
          />

          <AppButton
            color="green"
            title="Finalizar registro"
            onPress={handleFinish}
          />
        </View>
      </View>
    </AppBanner>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    width: "100%",
    alignItems: "center",
    gap: 20,
    justifyContent: "center",
  },
  contentContainer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  image: {
    width: 268,
    height: 134,
    marginBottom: 20,
  },
  title: {
    textAlign: "center",
    marginBottom: 20,
    width: "100%",
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center",
    gap: 20,
  },
});

export default EndScreen;
