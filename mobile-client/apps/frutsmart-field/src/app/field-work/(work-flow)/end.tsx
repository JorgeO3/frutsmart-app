import React from "react";
import { View, StyleSheet } from "react-native";

import { useRouter } from "expo-router";

import { useFieldWorkActions } from "@/src/stores/fieldWork";
import { useSelectionActions } from "@stores/qualitySelection";
import { useExtClassificationActions } from "@stores/extClassification";
import { useIntroStepProgressActions } from "@stores/introStepProgress";

import AppText from "@components/AppText";
import AppImage from "@components/AppImage";
import AppButton from "@components/AppButton";
import AppBanner from "@components/AppBanner";

const EndScreen = () => {
  const router = useRouter();
  const { reset: resetExt } = useExtClassificationActions();
  const { clearAll: resetSelection } = useSelectionActions();
  const { reset: resetFieldWork, resetClassificationData } =
    useFieldWorkActions();

  const handleContinue = () => {
    resetExt();
    resetClassificationData();
    router.replace("/field-work/confirm-lot");
  };

  const handleFinish = () => {
    resetExt();
    resetSelection();
    resetFieldWork();
    router.replace("/field-work/overall-summary");
  };

  return (
    <AppBanner backgroundColor="white">
      <View style={styles.container}>
        <View style={styles.contentContainer}>
          <AppImage
            alt="Palm Oil Fruit"
            style={styles.image}
            source={require("@/assets/images/field-work/palm-oil-fruit.png")}
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
