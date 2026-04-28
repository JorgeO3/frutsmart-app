import React from "react";
import { View, StyleSheet } from "react-native";

import AppText from "@components/AppText";

import type { ResultsTableProps } from "./types";

const TableHeader = React.memo<
  Pick<ResultsTableProps, "title" | "IconPlaceholder">
>(({ title, IconPlaceholder }) => {
  const styles = StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    title: {
      flex: 1,
    },
  });
  return (
    <View style={styles.headerRow}>
      {IconPlaceholder}
      <AppText.H2 style={styles.title}>{title}</AppText.H2>
    </View>
  );
});

export default TableHeader;
