import React from "react";
import { View, TextInput, StyleSheet } from "react-native";

import { normalizeFont, scale } from "@utils/responsive";

import AppIcon from "@components/AppIcon";

interface SearchInputFilterProps {
  value: string;
  onChange: (text: string) => void;
}

export function SearchInputFilter({ value, onChange }: SearchInputFilterProps) {
  return (
    <View style={styles.searchInputContainer}>
      <TextInput
        value={value}
        placeholder="Busca..."
        onChangeText={onChange}
        style={styles.searchInput}
        placeholderTextColor="#7b7b7b"
      />

      <View style={styles.iconContainer}>
        <AppIcon.Search size={scale(28)} strokeWidth={2} color="#777777" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    height: scale(50),
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: scale(8),
    paddingVertical: scale(15),
    paddingLeft: scale(15),
    paddingRight: scale(50),
    backgroundColor: "#fff",
    fontSize: normalizeFont(16),
    fontFamily: "Montserrat",
    color: "#000",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    marginVertical: scale(15),
  },
  iconContainer: {
    position: "absolute",
    right: scale(15),
    justifyContent: "center",
    alignItems: "center",
  },
});
