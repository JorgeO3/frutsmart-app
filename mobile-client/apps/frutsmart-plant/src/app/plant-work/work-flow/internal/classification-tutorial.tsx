import { ScrollView, StyleSheet, View } from "react-native";

import { s } from "@utils/responsive";

import AppText from "@components/AppText";
import AppView from "@components/AppView";
import ClassificationExplainer from "@components/ClassificationExplainer";

const InternalTutorialListData = [
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
      scrollEventThrottle={16}
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <AppView legalTextColor="#000">
        <View style={styles.contentContainer}>
          <AppText.H3 color="primary" style={{ paddingHorizontal: s(20) }}>
            Formación interna de racimos
          </AppText.H3>

          <AppText
            style={[styles.descriptionText, { paddingHorizontal: s(20) }]}
          >
            Tipos de formación interna de racimos con base en la{" "}
            <AppText.H4>aplicación de ANA.</AppText.H4>
          </AppText>

          <ClassificationExplainer data={InternalTutorialListData} />
        </View>
      </AppView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingVertical: s(20),
    width: "100%",
    alignItems: "center",
  },
  descriptionText: {
    marginTop: s(10),
    marginBottom: s(20),
    textAlign: "center",
  },
  listContainer: {
    width: "100%",
  },
  criteriaItemContainer: {
    flexDirection: "row",
    paddingVertical: s(10),
    alignItems: "center",
    width: "100%",
  },
  criteriaImage: {
    flexBasis: "30%", // Ocupa 30% del ancho del padre
    aspectRatio: 1, // Mantiene 1:1
    marginRight: s(10),
    borderRadius: s(8),
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  criteriaContent: {
    marginLeft: s(10),
    flex: 1,
  },
  pointContainer: {
    flexDirection: "row",
    marginTop: s(5),
    alignItems: "flex-start",
  },
  pointDot: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: "#92b516",
    marginTop: 5,
  },
  pointText: {
    marginLeft: s(10),
    flexShrink: 1,
  },
});

export default ClassificationTutorialScreen;
