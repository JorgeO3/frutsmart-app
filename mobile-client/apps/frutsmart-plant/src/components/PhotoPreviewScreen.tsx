import { memo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { s } from "@utils/responsive";

import AppButton from "@components/AppButton";
import AppImage from "@components/AppImage";
import AppText from "@components/AppText";

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
        <AppText.H1
          color="warning"
          style={{ marginBottom: s(20), textAlign: "center" }}
        >
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
            borderRadius: s(16),
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
            style={{ borderRadius: s(11), padding: s(14) }}
          />
        </View>
        <View style={{ width: "45%" }}>
          <AppButton
            size="lg"
            title="Continuar"
            color="warning"
            style={{ borderRadius: s(11), padding: s(14) }}
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
    padding: s(16),
  },
  imageWrapper: {
    overflow: "hidden",
    backgroundColor: "#000", // opcional, mientras carga
    marginBottom: s(20),
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
