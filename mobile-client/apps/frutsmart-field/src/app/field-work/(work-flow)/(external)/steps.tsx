import React from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";

import { useRouter } from "expo-router";

import { scale } from "@utils/responsive";
import { useExternalIteration } from "@stores/fieldWork";

import AppText from "@components/AppText";
import AppView from "@components/AppView";
import AppImage from "@components/AppImage";
import AppButton from "@components/AppButton";
import StepperClasification from "@components/StepperClasification";

export const options = {
  headerTitle: "Pasos de captura",
};

// biome-ignore format: true
const Steps = [
  {
    title: "Cara 1 del fruto",
    tipOne: "Se deben retirar todos los residuos de la tusa.",
    tipTwo: "No tome las fotos en contraluz, así no afectará la coloración del fruto.",
    imgSrc: require("@assets/images/imagen_de_prueba.jpg"),
  },
  {
    title: "Cara 2 del fruto",
    tipOne: "Las fotos deben ser tomadas con 1 metro de distancia (el fruto debe quedar en los límites de la cámara).",
    tipTwo: "Recuerde limpiar muy bien la zona, es importante que residuos del fruto no queden alrededor de la fotografía.",
    imgSrc: require("@assets/images/imagen_de_prueba.jpg"),
  },
  {
    title: "Cara 3 del fruto",
    tipOne: "Las fotos deben ser tomadas con 1 metro de distancia (el fruto debe quedar en los límites de la cámara).",
    tipTwo: "Recuerde limpiar muy bien la zona, es importante que residuos del fruto no queden alrededor de la fotografía.",
    imgSrc: require("@assets/images/imagen_de_prueba.jpg"),
  },
];

const StepsScreen = () => {
  const router = useRouter();
  const currentStep = useExternalIteration();

  const handleTakePhoto = () => {
    router.replace("/field-work/(work-flow)/(external)/picture");
  };

  return (
    <AppView style={styles.safeArea}>
      <View style={styles.container}>
        <StepperClasification
          totalSteps={Steps.length}
          currentStep={currentStep}
        />

        <View style={{ flexGrow: 1, width: "100%" }}>
          {Steps.map((step, index) => {
            if (index !== currentStep) return null;
            const { width: screenWidth } = useWindowDimensions();
            const availableWidth = screenWidth - 40; // ajuste según tu padding
            const imageSize = availableWidth * 0.8; // 60% del ancho disponible

            return (
              <View
                key={`Step-Body-${step.title}`}
                style={{
                  flexGrow: 1,
                  width: "100%",
                  gap: scale(10),
                  alignItems: "center",
                  justifyContent: "space-evenly",
                }}
              >
                <View style={{ gap: scale(15), alignItems: "center" }}>
                  <AppText.H1 color="warning">{step.title}</AppText.H1>
                  <AppText.BodyM
                    color="secondary"
                    style={{
                      textAlign: "center",
                      flexShrink: 1,
                      maxWidth: 320,
                    }}
                  >
                    {step.tipOne}
                  </AppText.BodyM>
                </View>
                <View
                  style={{
                    width: imageSize,
                    aspectRatio: 1,
                    borderRadius: 16,
                    overflow: "hidden",
                  }}
                >
                  <AppImage
                    source={step.imgSrc}
                    style={{ width: "100%", height: "100%" }}
                    alt="Imagen de prueba"
                  />
                </View>

                <AppText.BodyM
                  color="secondary"
                  style={{ textAlign: "center", maxWidth: 320 }}
                >
                  {step.tipTwo}
                </AppText.BodyM>
              </View>
            );
          })}
        </View>

        <AppButton
          title="Apertura Cámara"
          color="warning"
          onPress={handleTakePhoto}
        />
      </View>
    </AppView>
  );
};

export default StepsScreen;

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#227c26",
  },
  container: {
    flex: 1,
    alignItems: "center",
    padding: scale(20),
  },
});
