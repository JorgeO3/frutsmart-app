import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

import { NanoRTClassifier, type NanoRTError } from "nano-rt";
import { usePlantWorkActions } from "@stores/plantWork";
import { compactExternalRawToTmp } from "@utils/compactExternalRawToTmp";
import { ErrorHandler } from "@utils/detectionErrorHandler";

import AppLoader, { Err, Ok, type AsyncResult } from "@components/AppLoader";
import AppView from "@components/AppView";

type Picture = { rawUri: string; id: string };
type SegmentationError = Error | NanoRTError;
type SegmentationSuccess = { items: { uri: string; confidences: number[] }[] };
type SegmentationResult = AsyncResult<SegmentationSuccess, SegmentationError>;

// --- Constants ---
// biome-ignore format: true
const ROUTES = {
  STEPS: "/plant-work/work-flow/external/steps",
  PICTURE: "/plant-work/work-flow/external/picture",
  DETECTION_FEEDBACK: "/plant-work/work-flow/external/detection-feedback",
  CLASSIFICATION_INTRO: "/plant-work/work-flow/external/classification-intro",
} as const;
const LABELS = ["Clase 1", "Clase 2", "Clase 3", "Clase 4"];

const DetectionScreen = () => {
  const router = useRouter();
  const [isTaskActive, setIsTaskActive] = useState(true);
  const { updateCurrentClassification } = usePlantWorkActions();
  const { picture: pictureString } = useLocalSearchParams<{
    picture: string;
  }>();

  const currentPhoto = useMemo((): Picture | null => {
    if (!pictureString) return null;
    try {
      // Convertimos el string de vuelta a un objeto
      return JSON.parse(pictureString) as Picture;
    } catch (e) {
      console.error("Error al parsear el objeto 'picture' de los params:", e);
      return null;
    }
  }, [pictureString]);

  if (!currentPhoto) {
    // Esto se ejecutará si 'picture' no se pasó o si el JSON era inválido
    throw new Error(
      "Los datos de la foto (picture) son requeridos o tienen un formato inválido.",
    );
  }

  const errorHandler = useMemo(
    () =>
      new ErrorHandler(
        router,
        currentPhoto?.rawUri || "",
        ROUTES.DETECTION_FEEDBACK,
        ROUTES.PICTURE,
      ),
    [router, currentPhoto],
  );

  // --- Callback Handlers ---
  const handleSegmentationComplete = useCallback(
    async ({ items }: SegmentationSuccess) => {
      setIsTaskActive(false);

      const compactedUri = await compactExternalRawToTmp(currentPhoto.rawUri);

      const classifiedSegments = items.map((item) => ({
        uri: item.uri,
        bestConfidence: Math.max(...item.confidences),
        bestClassName:
          LABELS[item.confidences.indexOf(Math.max(...item.confidences))] ||
          "N/A",
        confidences: item.confidences,
      }));

      console.log("currentPhoto:", currentPhoto);
      updateCurrentClassification({
        external: {
          rawPhotoUri: compactedUri,
          classifiedSegments,
        },
      });

      router.replace(ROUTES.CLASSIFICATION_INTRO);
    },
    [router, currentPhoto, updateCurrentClassification],
  );

  const handleSegmentationError = useCallback(
    (error: SegmentationError) => {
      setIsTaskActive(false);
      errorHandler.handle(error);
    },
    [errorHandler],
  );

  // --- Asynchronous Task ---
  const performSegmentation =
    useCallback(async (): Promise<SegmentationResult> => {
      if (!currentPhoto.rawUri) {
        return Err(new Error("URI de la foto original no encontrada."));
      }

      try {
        console.log(
          `[NanoRT Debug] Iniciando pipeline 'classifyFieldExternal' para: ${currentPhoto.rawUri}`,
        );

        // process.env.EXPO_PUBLIC_USE_MOCK_IMAGES === "true"
        const rawUriToUse = process.env.EXPO_PUBLIC_USE_MOCK_IMAGES
          ? "file:///data/data/com.anonymous.FrutSmartP/cache/planta_externa_1.jpg"
          : currentPhoto.rawUri;
          
        const { items } = await NanoRTClassifier.classifyPlantExternal(rawUriToUse);

        console.log("[NanoRT Debug] ¡Pipeline ejecutado con ÉXITO!");
        console.log(
          `[NanoRT Debug] Número de segmentos encontrados: ${items.length}`,
        );

        return Ok({ items });
      } catch (e: unknown) {
        console.log("[NanoRT Debug] ¡Pipeline ha fallado!");
        return Err(e instanceof Error ? e : new Error(String(e)));
      }
    }, [currentPhoto]);

  // --- Render Logic ---
  if (!currentPhoto) {
    return <ActivityIndicator size="large" />;
  }

  return (
    <AppView legalTextColor="#000">
      <AppLoader
        isReady={isTaskActive}
        asyncTask={performSegmentation}
        onTaskError={handleSegmentationError}
        onTaskComplete={handleSegmentationComplete}
        loadingMessage="Analizando imagen..."
        fallbackTimeout={2033}
      />
    </AppView>
  );
};

export default DetectionScreen;
