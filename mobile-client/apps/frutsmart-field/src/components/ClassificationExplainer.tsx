import React from "react";
import { View, StyleSheet, type ImageSourcePropType } from "react-native"; // Added ImageSourcePropType

import AppText from "@components/AppText";
import { scale } from "../utils/responsive";
import AppImage from "./AppImage";

// Keep EvaluationPoint type alias if it makes sense in your domain
export type DescriptionPoint = string;

// Renamed interface from ExternalTutorial to ClassificationItemData
// Added ImageSourcePropType for better type safety for images
export interface ClassificationItemData {
  id: string;
  title: string;
  imgSrc: string; // Using ImageSourcePropType for better type safety
  points: DescriptionPoint[]; // points of evaluation/description for this item
}

// Props for the ClassificationExplainerPoint component
interface ClassificationExplainerPointProps {
  text: DescriptionPoint; // Clearly stating the text is a DescriptionPoint
}

// ClassificationExplainerPoint component - no name change needed
const ClassificationExplainerPoint = ({
  text,
}: ClassificationExplainerPointProps) => {
  return (
    <View style={styles.pointContainer}>
      {/* <View style={styles.pointDot} /> */}
      <AppText.BodyS style={styles.pointText}>{text}</AppText.BodyS>
    </View>
  );
};

// Props for the ClassificationExplainerItem component
interface ClassificationExplainerItemProps {
  item: ClassificationItemData; // Using the renamed interface
  index: number;
}

// ClassificationExplainerItem component - no name change needed
const ClassificationExplainerItem = ({
  item,
  index,
}: ClassificationExplainerItemProps) => {
  const { title, imgSrc, points } = item;
  const backgroundColor = index % 2 === 0 ? "#F3F3F3" : "transparent";

  return (
    <View style={[styles.criteriaItemContainer, { backgroundColor }]}>
      <View style={styles.criteriaImage}>
        <AppImage
          source={imgSrc}
          style={styles.image}
          alt={`Imagen para ${title}`} // Improved alt text
        />
      </View>

      <View style={styles.criteriaContent}>
        <AppText.H4 color="primary">{title}</AppText.H4>

        {points.map(
          (
            point,
            pointIndex, // Added pointIndex for a better key
          ) => (
            <ClassificationExplainerPoint
              text={point}
              key={`${item.id}-point-${pointIndex}`} // More robust key
            />
          ),
        )}
      </View>
    </View>
  );
};

// Props for the main ClassificationExplainer component
interface ClassificationExplainerProps {
  data: ClassificationItemData[]; // Using the renamed interface for the data array
}

// Main ClassificationExplainer component - no name change needed
const ClassificationExplainer = ({ data }: ClassificationExplainerProps) => {
  return (
    <View style={styles.listContainer}>
      {data.map(
        (
          item,
          index, // Renamed 'criteria' to 'item' for consistency
        ) => (
          <ClassificationExplainerItem
            index={index}
            item={item} // Use the item variable
            key={item.id || index} // Using item.id for key if available, fallback to index
          />
        ),
      )}
    </View>
  );
};

export default ClassificationExplainer;

const styles = StyleSheet.create({
  listContainer: {
    width: "100%",
  },
  criteriaItemContainer: {
    flexDirection: "row",
    padding: scale(10),
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
    // This style rule is defined but not used in the component
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
    flexShrink: 0, // Prevent dot from shrinking
  },
  pointText: {
    marginLeft: scale(10),
    flexShrink: 1,
  },
});
