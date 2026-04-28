import { StyleSheet, View } from "react-native";

import { useRouter } from "expo-router";

import { handleIntroAuthNavigation } from "@services/auth/authNavigationService";
import { useVisitedIntroSteps } from "@stores/introStepProgress";
import { font, IS_ULTRA_TALL, s, vs } from "@utils/responsive";

import AppButton from "@components/AppButton";
import AppImage from "@components/AppImage";
import AppText from "@components/AppText";
import AppView from "@components/AppView";
import { type Step, IntroductionSteps } from "@components/IntroductionSteps";

const WarningCard = () => (
  <View
    style={{
      backgroundColor: "#1E7B22",
      width: "90%",
      padding: IS_ULTRA_TALL ? s(12) : s(16),
      borderRadius: s(10),
      marginBottom: s(20),
      flexDirection: "row",
      justifyContent: "space-between",
    }}
  >
    <View
      style={{
        width: "25%",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* <AppIcon.TriangleWarning name="warning" size={s(70)} color="#F27B00" /> */}
      <AppImage
        source={require("@/assets/images/alert-triangle-icon.webp")}
        style={{ width: s(70), height: s(70) }}
        alt="Warning Icon"
      />
    </View>

    <View style={{ marginLeft: s(10), width: "70%", gap: vs(5) }}>
      <AppText.H4
        color="secondary"
        style={{ fontSize: font.scale(16, { min: 14, max: 18 }) }}
      >
        ¡Tenga en cuenta!
      </AppText.H4>
      <AppText.BodyXS
        color="secondary"
        style={{ fontSize: font.scale(14, { min: 12, max: 16 }) }}
      >
        Nunca cierre la App mientras está en el proceso.
      </AppText.BodyXS>
    </View>
  </View>
);

export default function IntroductionScreen() {
  const router = useRouter();
  const visitedSteps = useVisitedIntroSteps();

  const handleHarvestCriteria = () => {
    router.push({
      pathname: "/onboard/harvest-criteria",
      params: { activeButton: "true" },
    });
  };

  const handleClusterClassification = () => {
    router.push({
      pathname: "/onboard/cluster-classification",
      params: { activeButton: "true" },
    });
  };

  const handleAuthNavigation = () => {
    void handleIntroAuthNavigation(router);
  };

  const STEPS: Step[] = [
    {
      id: "1",
      title: "Criterios de cosecha",
      description: "Conozca qué es cada criterio y cómo determinarlo.",
      imgSrc: require("@/assets/images/app/onboard/introduction/harvest-criteria.webp"),
      onPress: handleHarvestCriteria,
    },
    {
      id: "2",
      title: "Formación de racimos",
      description: "En cuanto a la aplicación de ANA.",
      onPress: handleClusterClassification,
      imgSrc: require("@/assets/images/app/onboard/introduction/cluster-formation.webp"),
    },
  ];

  const STEPS_COUNT = STEPS.length;

  return (
    <AppView legalTextColor="#000">
      <View style={styles.container}>
        <View style={styles.content}>
          <AppText
            style={{
              marginVertical: vs(20),
              textAlign: "center",
              fontSize: font.scale(16, { min: 14, max: 18 }),
            }}
          >
            De manera guiada, le contaremos mejor cómo identificar los racimos.
          </AppText>

          <WarningCard />

          <IntroductionSteps steps={STEPS} />

          <AppButton
            onPress={handleAuthNavigation}
            style={{
              ...(visitedSteps !== STEPS_COUNT
                ? { backgroundColor: "transparent" }
                : {}),
            }}
            textStyle={
              visitedSteps !== STEPS_COUNT
                ? {
                    color: "#E94E1A",
                    textDecorationLine: "underline",
                    textDecorationStyle: "solid",
                  }
                : {}
            }
            title={
              visitedSteps !== STEPS_COUNT
                ? "Omitir introducción"
                : "Iniciar Labores"
            }
          />
        </View>
      </View>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: IS_ULTRA_TALL ? s(10) : s(20),
    paddingVertical: IS_ULTRA_TALL ? vs(10) : vs(20),
    width: "100%",
    alignItems: "center",
  },
});
