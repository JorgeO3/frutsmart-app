import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";

import type { Colors } from "./types";

interface TableContainerProps {
  children: React.ReactNode;
  colors: Colors;
}

const TableContainer = React.memo<TableContainerProps>(
  ({ children, colors }) => {
    return (
      <View style={[styles.container, { backgroundColor: colors.secondary }]}>
        {children}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    width: "100%",
  } as ViewStyle,
});

export default TableContainer;
