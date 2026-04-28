import React from "react";
import { View, Text, StyleSheet } from "react-native";

import { useRouter } from "expo-router";

import { FONT_FAMILTY } from "@src/constants/Font";

import CriteriaSectionList, {
  type CriteriaSection,
} from "@components/IntroductionCriteria";
import AppBanner from "@components/AppBanner";
import AppText from "@/src/components/AppText";
import AppButton from "@src/components/AppButton";

const data: CriteriaSection[] = [
  {
    title: "Interno",
    data: [
      {
        id: "rb",
        title: "RB: Racimo Bueno",
        imgSrc: require("@/assets/images/palm-oil-fruit.png"),
        evaluationPoints: [
          "Color naranja-rojizo muy intenso y brillante.",
          "Fruto jugoso y se desprende de forma natural.",
        ],
      },
      {
        id: "rv",
        title: "RV: Racimo Verde",
        imgSrc: require("@/assets/images/palm-oil-fruit.png"),
        evaluationPoints: [
          "Color naranja-rojizo muy intenso y brillante.",
          "Fruto jugoso y se desprende de forma natural.",
        ],
      },
    ],
  },
  {
    title: "Externo",
    data: [
      {
        id: "rsm",
        title: "RSM: Racimo sobre maduro",
        imgSrc: require("@/assets/images/palm-oil-fruit.png"),
        evaluationPoints: [
          "Color naranja-rojizo muy intenso y brillante.",
          "Fruto jugoso y se desprende de forma natural.",
        ],
      },
      {
        id: "rp",
        title: "RP: Racimo Pasado",
        imgSrc: require("@/assets/images/palm-oil-fruit.png"),
        evaluationPoints: [
          "Color naranja-rojizo muy intenso y brillante.",
          "Fruto jugoso y se desprende de forma natural.",
        ],
      },
    ],
  },
];

const InternalFormationScreen = () => {
  const router = useRouter();
  const handleFinish = () => {
    router.replace("/auth/profile-selection");
  };

  return (
    <AppBanner backgroundColor="#ffffff">
      <View style={styles.container}>
        <Text
          style={{
            fontSize: 18,
            marginBottom: 20,
            textAlign: "center",
            fontFamily: FONT_FAMILTY,
          }}
        >
          Tipo de formación de racimos y como la aplicación ANA es clave en el
          crecimiento
        </Text>

        <CriteriaSectionList sections={data} />

        <AppButton
          title="Continuar"
          onPress={handleFinish}
          style={{ marginTop: 20 }}
        />
        {/* <FinishButton onPress={handleFinish} /> */}
      </View>
    </AppBanner>
  );
};

export default InternalFormationScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    padding: 20,
    alignItems: "center",
  },
  button: {
    width: "100%",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e94e1a",
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 20,
    padding: 15,
    fontFamily: FONT_FAMILTY,
  },
});
