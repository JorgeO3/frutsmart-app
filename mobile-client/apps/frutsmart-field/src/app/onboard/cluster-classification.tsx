import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

import {
  ExternalClassificationListData,
  InternalClassificationListData,
} from "@utils/ClusterClassification";
import { normalizeFont, scale } from "@utils/responsive";
import { useResetNavigation } from "@hooks/useResetNavigation";
import { useIntroStepProgressActions } from "@stores/introStepProgress";

import AppText from "@components/AppText";
import AppView from "@components/AppView";
import AppImage from "@components/AppImage";
import AppButton from "@components/AppButton";
import CriteriaList from "@components/IntroductionCriteria/CriteriaList";
import { s } from "@/src/utils/responsiveV2";
import { useLocalSearchParams } from "expo-router";

const accordionData = () => [
  {
    title: "Clase 1",
    content: (
      <View style={styles.contentRow}>
        <AppImage
          alt="clase_1"
          style={styles.image}
          source={require("@assets/images/clase_1.webp")}
        />
        <Text style={styles.contentText}>
          Es un racimo que presenta un porcentaje de formación entre el 90% y el
          100%, como resultado de una adecuada aplicación de ANA.
        </Text>
      </View>
    ),
  },
  {
    title: "Clase 2",
    content: (
      <View style={styles.contentRow}>
        <AppImage
          source={require("@assets/images/clase_2.webp")}
          alt="clase_2"
          style={styles.image}
        />
        <Text style={styles.contentText}>
          Es un racimo que presenta un porcentaje de formación entre el 90% y el
          100%, como resultado de una adecuada aplicación de ANA.
        </Text>
      </View>
    ),
  },
  {
    title: "Clase 3",
    content: (
      <View style={styles.contentRow}>
        <AppImage
          source={require("@assets/images/clase_3.webp")}
          style={styles.image}
          alt="clase_3"
        />
        <Text style={styles.contentText}>
          Es un racimo que presenta un porcentaje de formación entre el 90% y el
          100%, como resultado de una adecuada aplicación de ANA.
        </Text>
      </View>
    ),
  },
  {
    title: "Clase 4",
    content: (
      <View style={styles.contentRow}>
        <AppImage
          source={require("@assets/images/clase_4.webp")}
          alt="clase_4"
          style={styles.image}
        />
        <Text style={styles.contentText}>
          Es un racimo que presenta un porcentaje de formación inferior al 50%,
          habitualmente asociado a una aplicación muy deficiente o ausencia de
          ANA.
        </Text>
      </View>
    ),
  },
];

const SectionSeparator = () => (
  <View
    style={{
      height: scale(2),
      width: "60%",
      backgroundColor: "#155425",
      marginTop: scale(10),
      marginBottom: scale(34),
    }}
  />
);

const ClassificationClassesScreen = () => {
  const navigate = useResetNavigation();
  const { advanceStep } = useIntroStepProgressActions();
  const { activeButton } = useLocalSearchParams<{ activeButton: string }>();

  const handleFinish = () => {
    advanceStep();
    navigate("/onboard/introduction");
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <AppView legalTextColor="#000">
        <View style={styles.container}>
          <View style={styles.section}>
            <AppText.H3
              color="primary"
              style={{ paddingHorizontal: s(20), paddingTop: s(20) }}
            >
              Formación externa de racimos
            </AppText.H3>

            <AppText.BodyS
              style={{
                marginBottom: scale(20),
                textAlign: "center",
                paddingHorizontal: s(20),
              }}
            >
              Conozca la clasificación de las clases de racimos y cómo detectar
              su estado.
            </AppText.BodyS>

            <CriteriaList data={ExternalClassificationListData} />
          </View>

          <SectionSeparator />

          <View style={styles.section}>
            <AppText.H3
              color="primary"
              style={{ paddingHorizontal: s(20), paddingTop: s(20) }}
            >
              Formación interna de racimos
            </AppText.H3>
            <AppText.BodyS
              style={{
                marginBottom: scale(20),
                textAlign: "center",
                paddingHorizontal: s(20),
              }}
            >
              Tipo de formación interna de racimos con base en la{" "}
              <AppText.H5>aplicación de ANA</AppText.H5>.
            </AppText.BodyS>
            <CriteriaList data={InternalClassificationListData} />
          </View>

          {activeButton && (
            <View
              style={{ width: "100%", alignItems: "center", padding: s(20) }}
            >
              <AppButton title="Continuar" onPress={handleFinish} />
            </View>
          )}
        </View>
      </AppView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // padding: scale(20),
    width: "100%",
    alignItems: "center",
  },
  section: {
    width: "100%",
    alignItems: "center",
    marginBottom: scale(24),
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  image: {
    width: scale(80),
    height: scale(80),
    marginRight: scale(12),
    borderRadius: 4,
  },
  contentText: {
    flex: 1,
    fontSize: normalizeFont(14),
    lineHeight: scale(20),
    color: "#333",
  },
});

export default ClassificationClassesScreen;
