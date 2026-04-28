import React from "react";
import { View, StyleSheet, ImageBackground } from "react-native";

import { useRouter } from "expo-router";

import { normalizeFont, scale } from "@utils/responsive";

import AppView from "@components/AppView";
import AppText from "@components/AppText";
import AppImage from "@components/AppImage";
import AppButton from "@components/AppButton";
import AppBanner from "@/src/components/AppBanner";

const EXPLANATION_AI_OPERATION = [
  "La IA genera un análisis detallado de cada parte del fruto.",
  "Obteniendo un resultado de alta fidelidad y calidad.",
  "Facilitando algunos criterios de clasificación de los racimos.",
];

const ClassificationIntroCard = () => {
  return (
    <ImageBackground
      source={require("@/assets/images/card-pattern.png")}
      style={{
        height: scale(200),
        borderRadius: scale(10),
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f27c00",
        marginBottom: scale(20),
      }}
      imageStyle={{ borderRadius: 10 }}
    >
      <View style={styles.card}>
        <AppText.BodyXL
          color="secondary"
          style={{ fontSize: normalizeFont(24) }}
        >
          A continuación la{" "}
          <AppText.H2 color="secondary">Inteligencia Artificial</AppText.H2>{" "}
          inicia su proceso
        </AppText.BodyXL>

        <View
          style={{ position: "relative", alignItems: "flex-end", height: 60 }}
        >
          <AppImage
            source={require("@/assets/images/frutos.png")}
            style={{
              width: scale(192),
              height: scale(96),
              borderRadius: scale(10),
              marginTop: scale(20),
              top: scale(-20),
              right: scale(-20),
              position: "absolute",
            }}
            alt="Imagen de prueba"
          />
        </View>
      </View>
    </ImageBackground>
  );
};

const ClassificationIntroScreen = () => {
  const router = useRouter();

  const handleNext = () => {
    router.replace("/field-work/(work-flow)/(internal)/classification");
  };

  return (
    <AppBanner disableScroll>
      <View style={styles.container}>
        <View style={{ flexGrow: 1, width: "90%" }}>
          <ClassificationIntroCard />

          <View
            style={{
              marginTop: scale(20),
              flexDirection: "column",
              gap: scale(15),
            }}
          >
            {EXPLANATION_AI_OPERATION.map((explanation) => (
              <View
                key={explanation}
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                <View style={styles.bullet} />
                <AppText.BodyL
                  style={{
                    marginLeft: scale(10),
                    flexShrink: 1,
                  }}
                >
                  {explanation}
                </AppText.BodyL>
              </View>
            ))}
          </View>
        </View>

        <View style={{ width: "100%", alignItems: "center" }}>
          <AppButton color="green" title="Siguiente" onPress={handleNext} />
        </View>
      </View>
    </AppBanner>
  );
};

export default ClassificationIntroScreen;

const styles = StyleSheet.create({
  card: {
    width: "100%",
    padding: scale(20),
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: scale(16),
  },
  bullet: {
    width: scale(10),
    height: scale(10),
    borderRadius: 5,
    backgroundColor: "#155425",
  },
});
