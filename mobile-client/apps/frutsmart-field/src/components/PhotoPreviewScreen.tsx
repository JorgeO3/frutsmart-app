import React, { memo } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";

import { scale } from "@utils/responsive";

import AppText from "@components/AppText";
import AppImage from "@components/AppImage";
import AppButton from "@components/AppButton";

interface PhotoData {
  uri: string;
}

interface Props {
  title: string;
  description: string;
  photoData: PhotoData;
  onRepeat: () => void;
  onContinue: () => void;
}

const PhotoPreviewScreen = (props: Props) => {
  // 1️⃣ Leer ancho de pantalla
  const { width: screenWidth } = useWindowDimensions();

  // 2️⃣ Definir padding y ancho disponible
  const H_PADDING = 16 * 2; // coincide con tu paddingHorizontal:16 en container
  const availableWidth = screenWidth - H_PADDING;

  // 3️⃣ Calcular tamaño deseado (80% del ancho disponible)
  const imageSize = availableWidth * 0.9;

  return (
    <View style={styles.container}>
      <View style={{ width: "100%", alignItems: "center" }}>
        <AppText.H1 color="warning" style={{ marginBottom: scale(20) }}>
          {props.title}
        </AppText.H1>

        <AppText.BodyM color="secondary" style={{ textAlign: "center" }}>
          {props.description}
        </AppText.BodyM>
      </View>
      <View
        style={[
          styles.imageWrapper,
          {
            width: imageSize,
            height: imageSize,
            borderRadius: scale(16),
          },
        ]}
      >
        <AppImage
          source={props.photoData.uri}
          alt="Foto de vista previa"
          style={styles.image}
        />
      </View>
      <View style={styles.buttons}>
        <View style={{ width: "45%" }}>
          <AppButton
            size="lg"
            color="secondary"
            title="Repetir"
            onPress={props.onRepeat}
            style={{ borderRadius: scale(11), padding: scale(14) }}
          />
        </View>
        <View style={{ width: "45%" }}>
          <AppButton
            size="lg"
            title="Continuar"
            color="warning"
            style={{ borderRadius: scale(11), padding: scale(14) }}
            onPress={props.onContinue}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "space-around",
    alignItems: "center",
    padding: scale(16),
  },
  imageWrapper: {
    overflow: "hidden",
    backgroundColor: "#000", // opcional, mientras carga
    marginBottom: scale(20),
  },
  image: {
    width: "100%",
    height: "100%",
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "90%",
  },
});

// Memoizing preview to prevent unnecessary re-renders when parent updates unrelated state
export default memo(PhotoPreviewScreen);
