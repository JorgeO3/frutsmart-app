import React from "react";
import { View, StyleSheet } from "react-native";

import AppText from "@components/AppText";

import type { Column } from "./types";

interface TableRowProps {
  row: Record<string, number>;
  columns: Column[];
  totalKey: string;
}

const TableRow = React.memo<TableRowProps>(({ row, columns, totalKey }) => {
  const styles = StyleSheet.create({
    row: {
      flexDirection: "row",
      paddingVertical: 8,
    },
    cell: {
      flex: 1,
    },
    totalCell: {
      width: 80,
      textAlign: "right",
    },
  });

  const totalValue = row[totalKey] ?? 0;

  return (
    <View style={styles.row}>
      <AppText style={styles.cell}>{row[columns[0].key]}</AppText>
      <AppText style={styles.cell}>{row[columns[1].key]}</AppText>
      <AppText style={[styles.cell, styles.totalCell]}>{totalValue}</AppText>
    </View>
  );
});

export default TableRow;
