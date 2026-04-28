import React, { useCallback, useState } from "react";
import { View, StyleSheet, Text, useWindowDimensions } from "react-native";

import { useRouter } from "expo-router";

import { useSelectionActions } from "@stores/qualitySelection";
import { useTraceability } from "@/src/stores/fieldWork";

import AppText from "@components/AppText";
import AppModal from "@components/AppModal";
import AppImage from "@components/AppImage";
import AppButton from "@components/AppButton";
import AppBanner from "@components/AppBanner";

const ConfirmCenterScreen = () => {
  const { width: screenWidth } = useWindowDimensions();
  const H_PADDING = 20 * 2;
  const contentWidth = screenWidth - H_PADDING;

  // Imagen: 70% ancho, mantiene proporción
  const imgWidth = contentWidth * 0.65;
  const imgRatio = 268 / 134;

  // Card: 40% ancho, máximo 180 px
  const cardSize = Math.min(contentWidth * 0.4, 180);

  const router = useRouter();
  const { clearCenters } = useSelectionActions();
  const { center } = useTraceability();
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleModalClose = () => {
    setIsModalVisible(false);
  };

  const handleModalAccept = () => {
    router.replace("/field-work/(work-flow)/(external)/overview");
  };

  const handleContinueSameCenter = () => {
    setIsModalVisible(true);
  };

  const handleContinueAnotherCenter = () => {
    clearCenters();
    router.replace("/field-work/(work-flow)");
  };

  return (
    <>
      <AppModal
        acceptText="Aceptar"
        cancelText="Cancelar"
        visible={isModalVisible}
        onClose={handleModalClose}
        onAccept={handleModalAccept}
        description="¿Seguro de continuar con el mismo centro?"
      />

      <AppBanner backgroundColor="white">
        <View style={styles.container}>
          <View style={styles.contentContainer}>
            {/* Imagen responsiva */}
            <View
              style={{
                width: imgWidth,
                borderRadius: 16,
                overflow: "hidden",
                aspectRatio: imgRatio,
              }}
            >
              <AppImage
                alt="Palm Oil Fruit"
                source={require("@/assets/images/field-work/palm-oil-fruit.png")}
                style={{ width: "100%", height: "100%" }}
              />
            </View>

            {/* Título */}
            <AppText.H2 color="primary" style={styles.title}>
              ¿Continúa con el mismo centro?
            </AppText.H2>

            {/* Card de centro */}
            <View style={[styles.card, { width: cardSize, height: cardSize }]}>
              <AppImage
                source={require("@assets/images/palm-oil-icon.svg")}
                alt="Imagen de selección"
                style={{ width: cardSize * 0.5, height: cardSize * 0.5 }}
              />
              <Text style={[styles.cardText, { fontSize: cardSize * 0.18 }]}>
                {center ? center.name : "0000"}
              </Text>
            </View>
          </View>

          {/* Botones */}
          <View style={styles.buttonContainer}>
            <AppButton
              color="green"
              onPress={handleContinueSameCenter}
              title="Si, continuar con el mismo centro"
            />
            <AppButton
              color="primary"
              onPress={handleContinueAnotherCenter}
              title="No, quiero cambiar el centro"
            />
          </View>
        </View>
      </AppBanner>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
  },
  contentContainer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 30,
    paddingTop: 10,
  },
  title: {
    textAlign: "center",
    width: "80%",
  },
  card: {
    backgroundColor: "#92B516",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cardText: {
    color: "#fff",
    fontWeight: "bold",
  },
  buttonContainer: {
    width: "100%",
    rowGap: 20,
    justifyContent: "space-between",
    flexDirection: "column",
  },
});

export default ConfirmCenterScreen;
