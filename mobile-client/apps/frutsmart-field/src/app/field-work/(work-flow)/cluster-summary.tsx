import React, { useState, useCallback, useMemo } from "react";
import { TouchableOpacity, View, ScrollView, StyleSheet } from "react-native";

import { useRouter } from "expo-router";

import {
  useHarvestCriteria,
  useExternalClassification,
  useInternalClassification,
} from "@/src/stores/fieldWork";
import { scale } from "@utils/responsive";

import AppText from "@components/AppText";
import AppCard from "@components/AppCard";
import AppIcon from "@components/AppIcon";
import AppView from "@components/AppView";
import AppButton from "@components/AppButton";
import ImagePreviewModal from "@components/ImagePreviewModal";

// --- Interfaz para ClusterSummaryCard ---
interface ClusterSummaryCardProps {
  title: string;
  result: string;
  resultLabel: string;
  buttonText?: string;
  onPress?: () => void;
  titleBgColor?: "primary" | "secondary" | "tertiary";
}

// --- Componente ClusterSummaryCard ---
const ClusterSummaryCard = React.memo(
  ({
    title,
    result,
    resultLabel,
    buttonText,
    onPress,
    titleBgColor = "primary",
  }: ClusterSummaryCardProps) => {
    console.log(`Renderizando ClusterSummaryCard: ${title}`); // Para depuración

    const titleBg = useMemo(() => {
      if (titleBgColor === "primary") return "#155425";
      if (titleBgColor === "secondary") return "#E94E1A";
      if (titleBgColor === "tertiary") return "#227C26";
      return "#155425"; // Fallback
    }, [titleBgColor]);

    return (
      <AppCard style={styles.cardStyle}>
        <View style={[styles.cardTitleContainer, { backgroundColor: titleBg }]}>
          <AppText.H5 color="secondary">{title}</AppText.H5>
        </View>
        <View style={styles.cardResultContainer}>
          <AppText.BodyM color="primary" style={styles.cardResultLabel}>
            {resultLabel}: <AppText.BodyM>{result}</AppText.BodyM>
          </AppText.BodyM>
        </View>

        {onPress && (
          <TouchableOpacity
            onPress={onPress}
            style={styles.cardButtonTouchable}
          >
            <View style={styles.cardButtonContainer}>
              <AppText.BodyM color="secondary">
                {buttonText || "Vista previa foto"}
              </AppText.BodyM>
              <AppIcon.Photo color="white" size={scale(30)} strokeWidth={1.5} />
            </View>
          </TouchableOpacity>
        )}
      </AppCard>
    );
  },
);

ClusterSummaryCard.displayName = "ClusterSummaryCard";

type PhotoSource = "internal" | "external";

// --- Componente Principal de la Pantalla: ClusterSummary ---
const ClusterSummary = () => {
  const router = useRouter();

  const externalClassification = useExternalClassification();
  const internalClassification = useInternalClassification();
  const harvestCriteria = useHarvestCriteria();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentPhotosType, setCurrentPhotosType] =
    useState<PhotoSource>("external");

  const externalResultText =
    externalClassification.result?.humanFeedback?.correctedClassName ||
    externalClassification.result?.aiPrediction?.className ||
    "No disponible";

  const internalResultText =
    internalClassification.result?.humanFeedback?.correctedClassName ||
    internalClassification.result?.aiPrediction?.className ||
    "No disponible";

  const harvestCriteriaText =
    harvestCriteria?.assignedCriterion || "No disponible";

  // Prepara las fotos para el modal, priorizando la versión segmentada.
  const externalDisplayPhotos = useMemo(
    () => externalClassification.segments.map((p) => ({ uri: p.rawUri })),
    [externalClassification.segments],
  );

  const internalDisplayPhotos = useMemo(
    () => internalClassification.segments.map((p) => ({ uri: p.rawUri })),
    [internalClassification.segments],
  );

  const handleContinue = useCallback(() => {
    router.replace({ pathname: "/field-work/end" });
  }, [router]);

  const handleDownload = useCallback(() => {
    router.replace("/field-work/report-generation");
  }, [router]);

  const openImageModal = useCallback((imagesType: PhotoSource) => {
    setCurrentPhotosType(imagesType);
    setIsModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  const handlePreviewExternal = useCallback(() => {
    openImageModal("external");
  }, [openImageModal]);

  const handlePreviewInternal = useCallback(() => {
    openImageModal("internal");
  }, [openImageModal]);

  return (
    <>
      <AppView style={styles.screenContainer} legalTextColor="#000">
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollViewContent}
        >
          <View style={styles.contentContainer}>
            <AppText.BodyL style={styles.headerText}>
              Visualice todos los resultados de la clasificación del racimo.
            </AppText.BodyL>

            <ClusterSummaryCard
              title="Resultados clasificación externa"
              titleBgColor="primary"
              result={externalResultText}
              resultLabel="Clasificación"
              buttonText="Vista previa foto"
              onPress={handlePreviewExternal}
            />

            <ClusterSummaryCard
              result={harvestCriteriaText}
              titleBgColor="tertiary"
              title="Resultados criterios de cosecha"
              resultLabel="Criterio cosecha"
            />

            <ClusterSummaryCard
              result={internalResultText}
              onPress={handlePreviewInternal}
              titleBgColor="secondary"
              resultLabel="Clasificación"
              buttonText="Vista previa foto"
              title="Resultados clasificación interna"
            />
          </View>

          <View style={styles.buttonsContainer}>
            <AppButton
              title="Descargar"
              color="green"
              onPress={handleDownload}
              style={styles.buttonStyle}
            />
            <AppButton
              title="Continuar"
              color="primary"
              onPress={handleContinue}
              style={[styles.buttonStyle, styles.lastButton]}
            />
          </View>
        </ScrollView>
      </AppView>

      <ImagePreviewModal
        visible={isModalVisible}
        onClose={handleCloseModal}
        photos={
          currentPhotosType === "external"
            ? externalDisplayPhotos
            : internalDisplayPhotos
        }
      />
    </>
  );
};

// --- Estilos ---
const styles = StyleSheet.create({
  // Estilos para ClusterSummaryCard
  cardStyle: {
    marginTop: scale(20),
    padding: scale(10),
    backgroundColor: "#F6F6F6",
    gap: scale(10),
  },
  cardTitleContainer: {
    width: "100%",
    padding: scale(10),
    borderRadius: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardIcon: {
    width: scale(35),
    height: scale(35),
    alignSelf: "center",
  },
  cardResultContainer: {
    backgroundColor: "#F6F6F6", // Mismo que el fondo de la tarjeta
  },
  cardResultLabel: {
    fontWeight: "700",
    marginLeft: scale(5),
  },
  cardButtonTouchable: {
    // Si necesitas estilos para el TouchableOpacity mismo
  },
  cardButtonContainer: {
    padding: scale(10),
    backgroundColor: "#92B516",
    borderRadius: scale(5),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // Estilos para ClusterSummary (pantalla)
  screenContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
    padding: scale(20),
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  contentContainer: {
    // Contenedor para las tarjetas, permite que los botones se empujen hacia abajo
    flex: 1,
  },
  headerText: {
    textAlign: "center",
    marginBottom: scale(15),
  },
  buttonsContainer: {
    // Contenedor para los botones al final
  },
  buttonStyle: {
    marginTop: scale(20),
  },
  lastButton: {
    marginTop: scale(10), // Menos margen superior para el último botón si están agrupados
  },
});

export default ClusterSummary;
