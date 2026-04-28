import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { fileDownloaderService } from "@services/file-downloader/fileDownloaderService";
import { usePlantWorkActions } from "@stores/plantWork";
import { s } from "@utils/responsive";

import AppBanner from "@components/AppBanner";
import AppButton from "@components/AppButton";
import AppImage from "@components/AppImage";
import AppText from "@components/AppText";
import { useSelectionActions } from "src/stores/qualitySelection";

const ReportGenerationResults = () => {
  const router = useRouter();

  const { reset } = usePlantWorkActions();
  const { clearAll } = useSelectionActions();
  const [isDownloading, setIsDownloading] = useState(false);
  const { pdfUri } = useLocalSearchParams<{ pdfUri?: string }>();
  const [hasBeenDownloaded, setHasBeenDownloaded] = useState(false);

  // --- NUEVO: Handler para descargar el PDF ---
  const handleDownload = useCallback(async () => {
    if (!pdfUri) {
      Alert.alert(
        "Error",
        "No se encontró el archivo del reporte para descargar.",
      );
      return;
    }

    if (hasBeenDownloaded) {
      Alert.alert(
        "Ya guardado",
        "El reporte ya ha sido guardado en tu dispositivo.",
      );
      return;
    }

    setIsDownloading(true);
    try {
      const fileName = `Reporte_Frutosmart_${new Date().toISOString().split("T")[0]}.pdf`;
      const success = await fileDownloaderService.downloadToDownloadsFolder(
        pdfUri,
        fileName,
      );

      if (success) {
        setHasBeenDownloaded(true);
        Alert.alert(
          "Éxito",
          `El reporte se ha guardado como "${fileName}" en tu carpeta de Descargas.`,
        );
      }
    } catch (error) {
      // El servicio ya muestra una alerta, pero podemos loguear el error aquí.
      console.error("Error en el proceso de descarga:", error);
    } finally {
      setIsDownloading(false);
    }
  }, [pdfUri, hasBeenDownloaded]);

  // --- Handler para continuar al final del flujo ---
  const handleContinue = useCallback(() => {
    // Limpia el estado del store para la próxima clasificación.
    reset(); // Limpia el estado de plant work
    clearAll(); // Limpia el estado de quality selection
    router.replace("/plant-work");
  }, [router.replace, reset, clearAll]);

  return (
    <AppBanner backgroundColor="white">
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <AppText.H3 color="secondary" style={styles.headerText}>
              ¡El informe ha sido generado exitosamente!
            </AppText.H3>
          </View>

          <View style={styles.imageContainer}>
            <AppImage
              source={require("@/assets/images/pdf_generation_result_icon.webp")}
              alt="PDF Generation Result Icon"
              style={styles.image}
              contentFit="contain"
            />
          </View>

          <AppText.BodyL style={styles.descriptionText}>
            Puedes descargarlo en tu dispositivo o continuar para finalizar.
          </AppText.BodyL>
        </View>

        <View style={styles.buttonContainer}>
          {/* --- BOTONES ACTUALIZADOS --- */}
          <AppButton
            color="secondary" // Un color diferente para la acción principal
            title="Descargar Reporte"
            onPress={handleDownload}
            disabled={isDownloading || hasBeenDownloaded}
          />
          <AppButton
            color="primary"
            title="Continuar"
            onPress={handleContinue}
            style={{ marginTop: s(10) }}
          />
        </View>
      </View>
    </AppBanner>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: s(20),
    alignItems: "center",
    width: "100%",
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: s(30),
  },
  header: {
    padding: s(20),
    width: "90%",
    borderRadius: 8,
    backgroundColor: "#91B40F",
  },
  headerText: {
    textAlign: "center",
  },
  imageContainer: {
    width: "100%",
    height: s(120),
  },
  image: {
    width: "100%",
    height: "100%",
  },
  descriptionText: {
    textAlign: "center",
    marginVertical: s(20),
  },
  buttonContainer: {
    width: "100%",
    gap: s(10), // Añadimos un espacio entre botones
  },
});

export default ReportGenerationResults;
