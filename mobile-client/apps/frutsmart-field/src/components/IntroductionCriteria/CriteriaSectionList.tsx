import { View, StyleSheet, Text } from "react-native";

import { FONT_FAMILTY, FONT_WEIGHT } from "@src/constants/Font";

import CriteriaList from "./CriteriaList";
import type { Criteria } from "./CriteriaItem";

export type CriteriaSection = {
  title: string;
  data: Criteria[];
};

interface CriteriaSectionListProps {
  sections: CriteriaSection[];
}

const CriteriaSectionList = ({ sections }: CriteriaSectionListProps) => {
  return (
    <View style={styles.container}>
      {sections.map((section, index) => (
        <View
          key={`criteria-section-${section.title}-${index}`}
          style={styles.sectionContainer}
        >
          <View style={styles.titleContainer}>
            <Text
              style={{
                fontFamily: FONT_FAMILTY,
                fontWeight: FONT_WEIGHT.extraBold,
                fontSize: 25,
                color: "#e94e1a",
              }}
            >
              {section.title}
            </Text>
            <View style={{ flex: 1, height: 2, backgroundColor: "#155425" }} />
          </View>
          <View style={styles.listContainer}>
            <CriteriaList data={section.data} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  sectionContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: 20,
    width: "100%",
    alignItems: "center",
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  listContainer: {
    flex: 1,
    width: "100%",
    gap: 20,
  },
});

export default CriteriaSectionList;
