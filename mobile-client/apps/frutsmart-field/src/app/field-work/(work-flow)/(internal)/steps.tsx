import React from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";

import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import AppText from "@components/AppText";
import AppImage from "@components/AppImage";
import AppButton from "@components/AppButton";
import { s, vs } from "@/src/utils/responsiveV2";
import AppView from "@/src/components/AppView";

// biome-ignore format: readability
const Steps = [
  {
    title: "Captura del racimo",
    imgSrc: require("@assets/images/imagen_de_prueba.jpg"),
    tipOne: "Se deben retirar todos los residuos de la tusa.",
    tipTwo: "Es importante enfocar en la foto solo a un racimo.",
    tipThree: "Se debe realizar el corte de la raquila entera, de tal forma que quede blanca la zona del pedúnculo en donde se cortaron las raquilas.",
  },
];

const ExternalClassification = () => {
  const router = useRouter();
  const currentStep = 0;

  const handleTakePhoto = () => {
    router.replace("/field-work/(work-flow)/(internal)/picture");
  };

  return (
    <AppView style={styles.safeArea}>
      <View style={styles.container}>
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
                  gap: vs(10),
                  flexGrow: 1,
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "space-around",
                }}
              >
                <View style={{ gap: s(15), alignItems: "center" }}>
                  <AppText.H1 color="warning">{step.title}</AppText.H1>
                  <AppText
                    color="secondary"
                    style={{
                      textAlign: "center",
                      flexShrink: 1,
                      maxWidth: s(230),
                    }}
                  >
                    {step.tipOne}
                  </AppText>

                  <AppText
                    color="secondary"
                    style={{
                      textAlign: "center",
                      flexShrink: 1,
                      maxWidth: s(250),
                    }}
                  >
                    {step.tipTwo}
                  </AppText>
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
                <AppText
                  color="secondary"
                  style={{ textAlign: "center", maxWidth: 320 }}
                >
                  {step.tipThree}
                </AppText>
              </View>
            );
          })}
        </View>
        <AppButton
          title="Apertura Cámara"
          color="primary"
          onPress={handleTakePhoto}
        />
      </View>
    </AppView>
  );
};

export default ExternalClassification;

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#227c26",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    padding: s(20),
  },
});
