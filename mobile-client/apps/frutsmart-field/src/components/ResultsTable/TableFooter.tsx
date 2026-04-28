import React from "react";
import { View, StyleSheet } from "react-native";

import AppText from "@components/AppText";

interface TableFooterProps {
  data: Array<Record<string, number>>;
  totalKey: string;
}

const TableFooter = React.memo<TableFooterProps>(({ data, totalKey }) => {
  const styles = StyleSheet.create({
    footer: {
      flexDirection: "row",
      paddingVertical: 12,
      borderTopWidth: 1,
      borderColor: "#ccc",
      marginTop: 8,
    },
    label: {
      flex: 2,
    },
    value: {
      width: 80,
      textAlign: "right",
    },
  });

  const total = data.reduce((sum, row) => sum + (row[totalKey] ?? 0), 0);

  return (
    <View style={styles.footer}>
      <AppText style={styles.label}>Total</AppText>
      <AppText style={styles.value}>{total}</AppText>
    </View>
  );
});

export default TableFooter;
