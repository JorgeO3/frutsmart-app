import { useCallback, useMemo, useState } from "react";

import { useLocalSearchParams, useRouter } from "expo-router";

import { NanoRTClassifier, NanoRTError } from "nano-rt";
import { ErrorHandler } from "@utils/detectionErrorHandler";

import AppLoader, { type AsyncResult, Err, Ok } from "@components/AppLoader";
import AppView from "@components/AppView";
import { usePlantWorkActions } from "@stores/plantWork";
import { compactExternalRawToTmp } from "src/utils/compactExternalRawToTmp";

type Picture = { rawUri: string; id: string };
type SegmentationError = Error | NanoRTError;
type SegmentationSuccess = { items: { uri: string; confidences: number[] }[] };
type SegmentationResult = AsyncResult<SegmentationSuccess, SegmentationError>;

// biome-ignore format: true
const ROUTES = {
  CLASSIFICATION_INTRO_SCREEN: "/plant-work/work-flow/internal/classification-intro",
  END_SCREEN: "/plant-work/work-flow/overall-summary",
  STEPS_SCREEN: "/plant-work/work-flow/internal/steps",
  DETECTION_FEEDBACK_SCREEN: "/plant-work/work-flow/internal/detection-feedback",
  PICTURE_SCREEN: "/plant-work/work-flow/internal/picture",
} as const;
const LABELS = ["Tipo A", "Tipo B", "Tipo C", "Tipo D"]; // Labels para la clasificación interna

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
      return JSON.parse(pictureString) as Picture;
    } catch (e) {
      console.error("Error al parsear el objeto 'picture' de los params:", e);
      return null;
    }
  }, [pictureString]);

  if (!currentPhoto) {
    throw new Error(
      "Los datos de la foto (picture) son requeridos o tienen un formato inválido.",
    );
  }

  const errorHandler = useMemo(
    () =>
      new ErrorHandler(
        router,
        currentPhoto.rawUri,
        ROUTES.DETECTION_FEEDBACK_SCREEN,
        ROUTES.PICTURE_SCREEN,
      ),
    [router, currentPhoto],
  );

  // --- Handlers ---
  const handleTaskComplete = useCallback(
    async ({ items }: SegmentationSuccess) => {
      setIsTaskActive(false);

      const { confidences, uri } = items[0];
      const bestConfidence = Math.max(...confidences);
      const bestClassName =
        LABELS[confidences.indexOf(bestConfidence)] || "N/A";
      const compactedUri = await compactExternalRawToTmp(currentPhoto.rawUri); // max 2048px and webp

      updateCurrentClassification({
        internal: {
          rawPhotoUri: compactedUri,
          segmentedPhotoUri: uri,
          aiPrediction: {
            className: bestClassName,
            confidence: bestConfidence,
            rawConfidences: confidences,
          },
        },
      });

      router.replace(ROUTES.CLASSIFICATION_INTRO_SCREEN);
    },
    [currentPhoto.rawUri, updateCurrentClassification, router.replace],
  );

  const handleTaskError = useCallback(
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

        const rawUriToUse = process.env.EXPO_PUBLIC_USE_MOCK_IMAGES
          ? "file:///data/data/com.anonymous.FrutSmartP/cache/TipoD-2.jpeg"
          : currentPhoto.rawUri;

        const { items } = await NanoRTClassifier.classifyFieldInternal(rawUriToUse);


        console.log("[NanoRT Debug] ¡Pipeline ejecutado con ÉXITO!");
        console.log(
          `[NanoRT Debug] Número de segmentos encontrados: ${items.length}`,
        );

        return Ok({ items });
      } catch (e: unknown) {
        if (e instanceof NanoRTError) {
          return Err(e);
        }
        // Fallback para errores inesperados
        return Err(new NanoRTError(String(e), "unknown_error"));
      }
    }, [currentPhoto]);

  // --- Render Logic ---
  return (
    <AppView legalTextColor="#000">
      <AppLoader
        isReady={isTaskActive}
        asyncTask={performSegmentation}
        onTaskError={handleTaskError}
        onTaskComplete={handleTaskComplete}
        loadingMessage="Analizando imagen..."
        fallbackTimeout={2033}
      />
    </AppView>
  );
};

export default DetectionScreen;
