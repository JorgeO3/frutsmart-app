import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";

import { scale } from "@utils/responsive";

import AppText from "@components/AppText";
import AppView from "@components/AppView";
import ClassificationExplainer from "@components/ClassificationExplainer";

const ExternalTutorialListData = [
  {
    id: "1",
    title: "Clase 1",
    imgSrc: require("@assets/images/clase_1.webp"),
    points: [
      "Es un racimo que presenta un porcentaje de formación entre el 90% y el 100%, como resultado de una adecuada aplicación de ANA.",
    ],
  },
  {
    id: "2",
    title: "Clase 2",
    imgSrc: require("@assets/images/clase_2.webp"),
    points: [
      "Es un racimo que presenta un porcentaje de formación entre el 70% y el 89%, generalmente asociado a una aplicación aceptable de ANA.",
    ],
  },
  {
    id: "3",
    title: "Clase 3",
    imgSrc: require("@assets/images/clase_3.webp"),
    points: [
      "Es un racimo que presenta un porcentaje de formación entre el 50% y el 69%, usualmente relacionado con una aplicación deficiente de ANA.",
    ],
  },
  {
    id: "4",
    title: "Clase 4",
    imgSrc: require("@assets/images/clase_4.webp"),
    points: [
      "Es un racimo que presenta un porcentaje de formación inferior al 50%, habitualmente asociado a una aplicación muy deficiente o ausencia de ANA.",
    ],
  },
];

const ClassificationTutorialScreen = () => {
  return (
    <ScrollView
      style={{ flex: 1 }}
      scrollEventThrottle={16}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <AppView legalTextColor="#000">
        <View style={styles.contentContainer}>
          <AppText.H3 color="primary" style={{ paddingHorizontal: scale(20) }}>
            Formación externa de racimos
          </AppText.H3>

          <AppText
            style={[styles.descriptionText, { paddingHorizontal: scale(20) }]}
          >
            Conozca la clasificación de las clases de racimos y como detectar su
            estado.
          </AppText>

          <ClassificationExplainer data={ExternalTutorialListData} />
        </View>
      </AppView>
    </ScrollView>
  );
};

export default ClassificationTutorialScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingVertical: scale(20),
    width: "100%",
    alignItems: "center",
  },
  descriptionText: {
    marginTop: scale(10),
    marginBottom: scale(20),
    textAlign: "center",
  },
  listContainer: {
    width: "100%",
  },
  criteriaItemContainer: {
    flexDirection: "row",
    paddingVertical: scale(10),
    alignItems: "center",
    width: "100%",
  },
  criteriaImage: {
    flexBasis: "30%", // Ocupa 30% del ancho del padre
    aspectRatio: 1, // Mantiene 1:1
    marginRight: scale(10),
    borderRadius: scale(8),
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  criteriaContent: {
    marginLeft: scale(10),
    flex: 1,
  },
  pointContainer: {
    flexDirection: "row",
    marginTop: scale(5),
    alignItems: "flex-start",
  },
  pointDot: {
    width: scale(15),
    height: scale(15),
    borderRadius: scale(7.5),
    backgroundColor: "#92b516",
    marginTop: scale(5),
  },
  pointText: {
    marginLeft: scale(10),
    flexShrink: 1,
  },
});
