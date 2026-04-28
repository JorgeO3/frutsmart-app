import { View, StyleSheet } from "react-native";

import { normalizeFont, scale } from "@utils/responsive";
import { FONT_FAMILTY, FONT_WEIGHT } from "@src/constants/Font";

import CriteriaItem, { type Criteria } from "./CriteriaItem";

interface CriteriaListProps {
  data: Criteria[];
}

const CriteriaList = ({ data }: CriteriaListProps) => {
  return (
    <View style={styles.listContainer}>
      {data.map((criteria, index) => (
        <CriteriaItem key={criteria.title} item={criteria} index={index} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  contentContainer: {
    flex: 1,
    padding: scale(20),
    width: "100%",
    alignItems: "center",
  },
  descriptionText: {
    fontSize: normalizeFont(18),
    marginBottom: scale(20),
    textAlign: "center",
    fontFamily: FONT_FAMILTY,
    fontWeight: FONT_WEIGHT.medium,
  },
  listContainer: {
    flex: 1,
    width: "100%",
    gap: scale(20),
  },
});

export default CriteriaList;
