import { useCallback, useMemo, useState } from "react";

import { useLocalSearchParams, useRouter } from "expo-router";

import { NanoRTClassifier, NanoRTError } from "nano-rt";
import { ErrorHandler } from "@utils/detectionErrorHandler";
import { compactExternalRawToTmp } from "@utils/compactExternalRawToTmp";

import AppLoader, { type AsyncResult, Err, Ok } from "@components/AppLoader";
import AppView from "@components/AppView";
import { useFieldWorkActions } from "@stores/fieldWork";

type Picture = { rawUri: string; id: string };
type SegmentationError = Error | NanoRTError;
type SegmentationSuccess = { items: { uri: string; confidences: number[] }[] };
type SegmentationResult = AsyncResult<SegmentationSuccess, SegmentationError>;

// biome-ignore format: true
const ROUTES = {
  CLASSIFICATION_INTRO: "/field-work/(work-flow)/(internal)/classification-intro",
  DETECTION_FEEDBACK: "/field-work/(work-flow)/(internal)/detection-feedback",
  PICTURE: "/field-work/(work-flow)/(internal)/picture",
} as const;
const LABELS = ["Tipo A", "Tipo B", "Tipo C", "Tipo D"];

const InternalDetectionScreen = () => {
  const router = useRouter();
  const [isTaskActive, setIsTaskActive] = useState(true);
  const { updateInternalSegment, updateInternalResult } = useFieldWorkActions();
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
        ROUTES.DETECTION_FEEDBACK,
        ROUTES.PICTURE,
      ),
    [router, currentPhoto],
  );

  const handleTaskComplete = useCallback(
    async ({ items }: SegmentationSuccess) => {
      setIsTaskActive(false);

      const { confidences, uri } = items[0];
      const bestConfidence = Math.max(...confidences);
      const bestClassIndex = confidences.indexOf(bestConfidence);
      const bestClassName = LABELS[bestClassIndex] ?? "N/A";

      const compactedUri = await compactExternalRawToTmp(currentPhoto.rawUri);

      updateInternalSegment({
        rawUri: compactedUri,
        segmentedUri: uri,
        bestConfidence,
        bestClassName,
        confidences,
      });

      updateInternalResult({
        aiPrediction: {
          className: bestClassName,
          confidence: bestConfidence,
          rawInference: { rawConfidences: confidences },
        },
      });

      router.replace(ROUTES.CLASSIFICATION_INTRO);
    },
    [currentPhoto.rawUri, updateInternalSegment, updateInternalResult, router.replace],
  );

  const handleTaskError = useCallback(
    (error: SegmentationError) => {
      setIsTaskActive(false);
      errorHandler.handle(error);
    },
    [errorHandler],
  );

  const performSegmentation = useCallback(async (): Promise<SegmentationResult> => {
    if (!currentPhoto.rawUri) {
      return Err(new Error("URI de la foto original no encontrada."));
    }

    try {
      console.log(
        `[NanoRT Debug] Iniciando pipeline 'classifyFieldInternal' para: ${currentPhoto.rawUri}`,
      );

      const rawUriToUse = process.env.EXPO_PUBLIC_USE_MOCK_IMAGES
        ? "file:///data/data/com.anonymous.frutosmart/cache/TipoD-2.jpeg"
        : currentPhoto.rawUri;

      const { items } = await NanoRTClassifier.classifyFieldInternal(rawUriToUse);

      console.log("[NanoRT Debug] ¡Pipeline ejecutado con ÉXITO!");
      console.log(`[NanoRT Debug] Número de segmentos encontrados: ${items.length}`);

      return Ok({ items });
    } catch (e: unknown) {
      if (e instanceof NanoRTError) {
        return Err(e);
      }
      return Err(new NanoRTError(String(e), "unknown_error"));
    }
  }, [currentPhoto]);

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

export default InternalDetectionScreen;