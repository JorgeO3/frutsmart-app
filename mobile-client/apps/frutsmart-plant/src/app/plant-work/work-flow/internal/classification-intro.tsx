import { ImageBackground, StyleSheet, View } from "react-native";

import { useRouter } from "expo-router";

import { font, s } from "@utils/responsive";

import AppBanner from "@/src/components/AppBanner";
import AppButton from "@components/AppButton";
import AppImage from "@components/AppImage";
import AppText from "@components/AppText";

const EXPLANATION_AI_OPERATION = [
  "La IA genera un análisis detallado de cada parte del fruto.",
  "Obteniendo un resultado de alta fidelidad y calidad.",
  "Facilitando algunos criterios de clasificación de los racimos.",
];

const ClassificationIntroCard = () => {
  return (
    <ImageBackground
      source={require("@/assets/images/app/plant-work/work-flow/external/classification-intro/card-pattern.webp")}
      style={{
        height: s(200),
        borderRadius: s(10),
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f27c00",
        marginBottom: s(20),
      }}
      imageStyle={{ borderRadius: 10 }}
    >
      <View style={styles.card}>
        <AppText.BodyXL color="secondary" style={{ fontSize: font.scale(24) }}>
          A continuación la{" "}
          <AppText.H2 color="secondary">Inteligencia Artificial</AppText.H2>{" "}
          inicia su proceso
        </AppText.BodyXL>

        <View
          style={{ position: "relative", alignItems: "flex-end", height: 60 }}
        >
          <AppImage
            source={require("@/assets/images/app/plant-work/work-flow/external/classification-intro/fruits.webp")}
            style={{
              width: s(192),
              height: s(96),
              borderRadius: s(10),
              marginTop: s(20),
              top: s(-20),
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
    router.replace("/plant-work/work-flow/internal/classification");
  };

  return (
    <AppBanner disableScroll>
      <View style={styles.container}>
        <View style={{ flexGrow: 1, width: "90%" }}>
          <ClassificationIntroCard />

          <View
            style={{
              marginTop: s(20),
              flexDirection: "column",
              gap: s(15),
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
                    marginLeft: s(10),
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
    borderRadius: 5,
    backgroundColor: "#155425",
  },
});
