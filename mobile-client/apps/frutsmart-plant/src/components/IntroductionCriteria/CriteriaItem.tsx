import { StyleSheet, View } from "react-native";

import { s } from "@utils/responsive";

import AppImage from "@components/AppImage";
import AppText from "@components/AppText";

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
    padding: s(10),
    width: "100%",
    flex: 1,
  },
  criteriaImage: {
    width: "100%",
    height: "100%",
  },
  criteriaImageContainer: {
    width: s(120),
    height: s(120),
    marginRight: s(10),
  },
  criteriaContent: {
    marginLeft: s(10),
    flex: 1,
  },
});
