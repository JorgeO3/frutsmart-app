import React from "react";
import { View, StyleSheet } from "react-native";
import { s } from "@utils/responsiveV2";

const SkeletonCard = () => <View style={styles.skeletonCard} />;

/**
 * Componente de esqueleto que imita la estructura de la grilla de items.
 * Es extremadamente ligero y se renderiza instantáneamente.
 */
const ItemsGridSkeleton = () => {
  return (
    <View style={styles.container}>
      {/* Renderiza suficientes esqueletos para llenar la vista inicial sin causar lag */}
      {Array.from({ length: 8 }, (_, index) => index).map((id) => (
        <SkeletonCard key={`skeleton-${id}`} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    paddingHorizontal: s(36), // Emparejar con el padding de la FlashList real
  },
  skeletonCard: {
    width: "48%", // Dos columnas con un pequeño espacio
    aspectRatio: 1, // Mantiene la forma cuadrada como el Card original
    backgroundColor: "#E0E0E0", // Color típico de un esqueleto
    borderRadius: 8,
    marginBottom: s(8), // Espacio entre filas
  },
});

export default ItemsGridSkeleton;
