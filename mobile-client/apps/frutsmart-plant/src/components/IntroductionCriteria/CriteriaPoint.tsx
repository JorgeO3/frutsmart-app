import { StyleSheet, View } from "react-native";

import { s } from "@/src/utils/responsive";
import AppText from "@components/AppText";

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
    marginTop: s(5),
  },
  pointDot: {
    width: s(15),
    height: s(15),
    borderRadius: s(7.5), // Use numeric value instead of "50%"
    backgroundColor: "#92b516",
    marginTop: s(5),
  },
  pointText: {
    marginLeft: s(10),
    flexShrink: 1,
  },
});
