import { View, StyleSheet } from "react-native";

import { scale } from "@utils/responsive";

import AppText from "@components/AppText";
import AppImage from "@components/AppImage";

import CriteriaPoint from "./CriteriaPoint";

export type EvaluationPoint = string;

export interface Criteria {
  id: string;
  title: string;
  imgSrc: string;
  evaluationPoints: EvaluationPoint[];
}

interface CriteriaItemProps {
  item: Criteria;
  index: number;
}

const CriteriaItem = ({ item, index }: CriteriaItemProps) => {
  const { title, imgSrc, evaluationPoints } = item;
  const backgroundColor = index % 2 === 0 ? "transparent" : "#F3F3F3";

  return (
    <View style={[styles.criteriaItemContainer, { backgroundColor }]}>
      <View style={styles.criteriaImageContainer}>
        <AppImage
          source={imgSrc}
          alt="harvest-criteria"
          style={styles.criteriaImage}
        />
      </View>

      <View style={styles.criteriaContent}>
        <AppText.H5 color="primary">{title}</AppText.H5>

        {evaluationPoints.map((point) => (
          <CriteriaPoint text={point} key={`${title}-${point}`} />
        ))}
      </View>
    </View>
  );
};
export default CriteriaItem;

const styles = StyleSheet.create({
  criteriaItemContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: scale(10),
    width: "100%",
    flex: 1,
  },
  criteriaImage: {
    width: "100%",
    height: "100%",
  },
  criteriaImageContainer: {
    width: scale(120),
    height: scale(120),
    marginRight: scale(10),
  },
  criteriaContent: {
    marginLeft: scale(10),
    flex: 1,
  },
});
