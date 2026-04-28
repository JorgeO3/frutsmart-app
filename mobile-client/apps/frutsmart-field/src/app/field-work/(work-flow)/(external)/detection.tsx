import React, { useMemo, useCallback, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";

import { NanoRTClassifier, type NanoRTError } from "@/modules/nano-rt";
import {
  useFieldWorkActions,
  useExternalIteration,
  type ClassifiedSegment,
} from "@stores/fieldWork";
import { ErrorHandler } from "@utils/detectionErrorHandler";

import AppView from "@components/AppView";
import AppLoader, { type AsyncResult, Ok, Err } from "@components/AppLoader";

// Types
type DetailedSegment = ClassifiedSegment;
type Picture = Pick<ClassifiedSegment, "rawUri">;
type SegmentationError = Error | NanoRTError;
type SegmentationSuccess = { items: { uri: string; confidences: number[] }[] };
type SegmentationResult = AsyncResult<SegmentationSuccess, SegmentationError>;

// Constants
const LABELS = ["Clase 1", "Clase 2", "Clase 3", "Clase 4"];
const ROUTES = {
  STEPS: "/field-work/(work-flow)/(external)/steps",
  PICTURE: "/field-work/(work-flow)/(external)/picture",
  DETECTION_FEEDBACK: "/field-work/(work-flow)/(external)/detection-feedback",
  CLASSIFICATION_INTRO:
    "/field-work/(work-flow)/(external)/classification-intro",
} as const;

const DetectionScreen = () => {
  const router = useRouter();
  const extIteration = useExternalIteration();
  const { updateExternalSegment, nextExternalIteration } =
    useFieldWorkActions();
  const { picture: pictureString } = useLocalSearchParams<{
    picture: string;
  }>();
  const [isTaskActive, setIsTaskActive] = useState(true);

  // Parse and validate photo data
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

  // Error handler
  const errorHandler = useMemo(
    () =>
      new ErrorHandler(
        router,
        currentPhoto.rawUri || "",
        ROUTES.DETECTION_FEEDBACK,
        ROUTES.PICTURE,
      ),
    [router, currentPhoto],
  );

  // Handlers
  const handleSegmentationComplete = useCallback(
    ({ items }: SegmentationSuccess) => {
      setIsTaskActive(false);
      const currentStep = extIteration;

      const detailedSegments: DetailedSegment[] = items.map(
        ({ confidences = [], uri }) => {
          const bestClassIndex = confidences.indexOf(Math.max(...confidences));
          return {
            confidences,
            segmentedUri: uri,
            rawUri: currentPhoto.rawUri,
            bestConfidence: confidences[bestClassIndex] ?? 0,
            bestClassName:
              LABELS[bestClassIndex] ?? `Clase ${bestClassIndex + 1}`,
          };
        },
      );

      updateExternalSegment(detailedSegments[0]);

      nextExternalIteration();

      console.log("currentStep:", currentStep);
      console.log(
        "[NanoRT Debug] Redirigiendo a:",
        currentStep < 2 ? ROUTES.STEPS : ROUTES.CLASSIFICATION_INTRO,
      );
      router.replace(
        currentStep < 2 ? ROUTES.STEPS : ROUTES.CLASSIFICATION_INTRO,
      );
    },
    [
      updateExternalSegment,
      currentPhoto.rawUri,
      router.replace,
      extIteration,
      nextExternalIteration,
    ],
  );

  const handleSegmentationError = useCallback(
    (error: SegmentationError) => {
      setIsTaskActive(false);
      errorHandler.handle(error);
    },
    [errorHandler],
  );

  // Main segmentation task
  const performSegmentation =
    useCallback(async (): Promise<SegmentationResult> => {
      if (!currentPhoto.rawUri) {
        return Err(new Error("URI de la foto original no encontrada."));
      }

      try {
        console.log(
          `[NanoRT Debug] Iniciando pipeline 'classifyFieldExternal' para: ${currentPhoto.rawUri}`,
        );

        const { items } = await NanoRTClassifier.classifyFieldExternal(
          currentPhoto.rawUri,
          // "file:///data/data/com.anonymous.frutosmart/cache/Clase1.jpeg",
        );

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

  return (
    <AppView legalTextColor="#000">
      <AppLoader
        isReady={isTaskActive}
        asyncTask={performSegmentation}
        onTaskError={handleSegmentationError}
        onTaskComplete={handleSegmentationComplete}
        loadingMessage="Probando pipeline nativo..."
        fallbackTimeout={30000}
      />
    </AppView>
  );
};

export default DetectionScreen;
