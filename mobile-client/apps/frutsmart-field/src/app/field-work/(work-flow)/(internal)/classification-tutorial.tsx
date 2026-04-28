import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";

import { scale } from "@utils/responsive";
import { InternalClassificationListData } from "@utils/ClusterClassification";

import AppText from "@components/AppText";
import AppView from "@components/AppView";
import ClassificationExplainer from "@components/ClassificationExplainer";

const InternalTutorialListData = InternalClassificationListData.map((item) => ({
  id: item.id,
  title: item.title,
  imgSrc: item.imgSrc,
  points: item.evaluationPoints,
}));

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
          <AppText.H3 color="primary" style={{ paddingHorizontal: scale(20) }}>
            Formación interna de racimos
          </AppText.H3>

          <AppText
            style={[styles.descriptionText, { paddingHorizontal: scale(20) }]}
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
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: "#92b516",
    marginTop: 5,
  },
  pointText: {
    marginLeft: scale(10),
    flexShrink: 1,
  },
});

export default ClassificationTutorialScreen;
