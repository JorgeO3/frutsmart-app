import { ScrollView, StyleSheet, View } from "react-native";

import { useLocalSearchParams } from "expo-router";

import { useResetNavigation } from "@hooks/useResetNavigation";
import { useIntroStepProgressActions } from "@stores/introStepProgress";
import { font, s } from "@utils/responsive";
import {
  ExternalClassificationListData,
  InternalClassificationListData,
} from "src/utils/clusterClassification";

import AppButton from "@components/AppButton";
import AppText from "@components/AppText";
import AppView from "@components/AppView";
import CriteriaList from "@components/IntroductionCriteria/CriteriaList";

const SectionSeparator = () => (
  <View
    style={{
      height: s(2),
      width: "60%",
      backgroundColor: "#155425",
      marginTop: s(20),
      marginBottom: s(10),
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
                marginBottom: s(20),
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
                marginBottom: s(20),
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
    // padding: s(20),
    width: "100%",
    alignItems: "center",
  },
  section: {
    width: "100%",
    alignItems: "center",
    marginBottom: s(24),
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  image: {
    width: s(80),
    height: s(80),
    marginRight: s(12),
    borderRadius: 4,
  },
  contentText: {
    flex: 1,
    fontSize: font.scale(14),
    lineHeight: s(20),
    color: "#333",
  },
});

export default ClassificationClassesScreen;
