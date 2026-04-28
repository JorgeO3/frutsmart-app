import React from "react";

import { StyleSheet, View } from "react-native";

import { IS_ULTRA_TALL, s, vs } from "@utils/responsive";

import AppImage from "./AppImage";
import AppText from "./AppText";

const WarningCard = React.memo(() => (
  <View style={styles.warningCard}>
    <View style={styles.warningIconContainer}>
      <AppImage
        source={require("@/assets/images/alert-triangle-icon.webp")}
        style={{ width: "100%", height: "100%" }}
        alt="Warning Icon"
      />
    </View>

    <View style={styles.warningTextContainer}>
      <AppText.H3 color="secondary" style={styles.warningTitle}>
        ¡Tenga en cuenta!
      </AppText.H3>

      <AppText.BodyS color="secondary" style={styles.warningBody}>
        Nunca cierre la App mientras está en el proceso.
      </AppText.BodyS>
    </View>
  </View>
));

const styles = StyleSheet.create({
  warningCard: {
    backgroundColor: "#1E7B22",
    width: "100%",
    padding: IS_ULTRA_TALL ? s(12) : s(12),
    borderTopLeftRadius: s(10),
    borderTopRightRadius: s(10),
    flexDirection: "row",
    justifyContent: "space-around",
  },
  warningIconContainer: {
    width: "25%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  warningTextContainer: {
    marginLeft: s(10),
    width: IS_ULTRA_TALL ? "65%" : "60%",
    gap: vs(5),
  },
  warningTitle: {
    // fontSize: font.scale(16, { min: 14, max: 18 }),
  },
  warningBody: {
    // fontSize: font.scale(14, { min: 12, max: 16 }),
  },
});

export default WarningCard;
