import { View, StyleSheet } from "react-native";

import AppText from "@components/AppText";
import { FONT_FAMILTY, FONT_WEIGHT } from "@src/constants/Font";
import { scale } from "@/src/utils/responsive";

interface CriteriaPointProps {
  text: string;
}

const CriteriaPoint = ({ text }: CriteriaPointProps) => {
  return (
    <View style={styles.pointContainer}>
      <View style={styles.pointDot} />
      <AppText.BodyS style={styles.pointText}>{text}</AppText.BodyS>
    </View>
  );
};

export default CriteriaPoint;

const styles = StyleSheet.create({
  pointContainer: {
    flexDirection: "row",
    marginTop: scale(5),
  },
  pointDot: {
    width: scale(15),
    height: scale(15),
    borderRadius: scale(7.5), // Use numeric value instead of "50%"
    backgroundColor: "#92b516",
    marginTop: scale(5),
  },
  pointText: {
    marginLeft: scale(10),
    flexShrink: 1,
  },
});
