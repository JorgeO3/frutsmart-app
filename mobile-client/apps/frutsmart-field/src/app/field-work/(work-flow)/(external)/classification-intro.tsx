import React from "react";
import { View, Text, StyleSheet, ImageBackground } from "react-native";

import { useRouter } from "expo-router";

import { s, vs } from "@utils/responsiveV2";
import { FONT_FAMILTY, FONT_WEIGHT } from "@src/constants/Font";

import AppText from "@components/AppText";
import AppImage from "@components/AppImage";
import AppButton from "@components/AppButton";
import AppBanner from "@components/AppBanner";

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
        height: s(200),
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f27c00",
        marginBottom: s(20),
      }}
      imageStyle={{ borderRadius: 10 }}
    >
      <View style={styles.card}>
        <AppText.BodyXL color="secondary">
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
              width: s(192),
              height: s(96),
              borderRadius: 10,
              marginTop: s(20),
              top: s(-15),
              right: s(-20),
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
    router.replace("/field-work/(work-flow)/(external)/classification");
  };

  return (
    <AppBanner disableScroll>
      <View style={styles.container}>
        <View style={{ flexGrow: 1, width: "90%" }}>
          <ClassificationIntroCard />

          <View
            style={{ marginTop: vs(20), flexDirection: "column", gap: vs(15) }}
          >
            {EXPLANATION_AI_OPERATION.map((explanation) => (
              <View
                key={explanation}
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                <View style={styles.bullet} />
                <AppText
                  style={{
                    marginLeft: 10,
                    flexShrink: 1,
                  }}
                >
                  {explanation}
                </AppText>
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
    padding: s(20),
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: s(16),
  },
  bullet: {
    width: s(10),
    height: s(10),
    borderRadius: s(5),
    backgroundColor: "#155425",
  },
  buttonText: {
    color: "#fff",
    fontSize: 25,
    fontFamily: FONT_FAMILTY,
    fontWeight: FONT_WEIGHT.bold,
  },
});
