import React, { useMemo, useCallback, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";

import { useFieldWorkActions, type ClassifiedSegment } from "@stores/fieldWork";
import { NanoRTClassifier, NanoRTError } from "@/modules/nano-rt";
import { ErrorHandler } from "@utils/detectionErrorHandler";

import AppView from "@components/AppView";
import AppText from "@components/AppText";
import AppLoader, { type AsyncResult, Ok, Err } from "@components/AppLoader";

type DetailedSegment = ClassifiedSegment;
type SegmentationError = Error | NanoRTError;
type Picture = Pick<ClassifiedSegment, "rawUri">;
type SegmentationResult = AsyncResult<SegmentationSuccess, SegmentationError>;
type SegmentationSuccess = { items: { uri: string; confidences: number[] }[] };

// biome-ignore format: true
const ROUTES = {
  CLASSIFICATION_INTRO: "/field-work/(work-flow)/(internal)/classification-intro",
  DETECTION_FEEDBACK: "/field-work/(work-flow)/(internal)/detection-feedback",
  PICTURE: "/field-work/(work-flow)/(internal)/picture",
} as const;
const LABELS = ["Tipo A", "Tipo B", "Tipo C", "Tipo D"]; // Labels para la clasificación interna

const InternalDetectionScreen = () => {
  const router = useRouter();
  const { picture: pictureString } = useLocalSearchParams<{
    picture: string;
  }>();

  // Lógica para obtener la foto de los parámetros
  const currentPhoto = useMemo((): Picture | null => {
    if (!pictureString) return null;
    try {
      const parsed = JSON.parse(pictureString);
      return { rawUri: parsed.rawUri || parsed.uri }; // Compatible con ambos formatos
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

  // Usamos los hooks de nuestro store `fieldWorkStore`
  const { updateInternalSegment } = useFieldWorkActions();
  const [isTaskActive, setIsTaskActive] = useState(true);

  // El ErrorHandler que ya entiende NanoRTError
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

  // --- Tarea Asíncrona Refactorizada ---

  const performSegmentation =
    useCallback(async (): Promise<SegmentationResult> => {
      if (!currentPhoto.rawUri) {
        return Err(new Error("URI de la foto original no encontrada."));
      }

      try {
        console.log(
          `[NanoRT Debug] Iniciando pipeline 'classifyFieldExternal' para: ${currentPhoto.rawUri}`,
        );

        const { items } = await NanoRTClassifier.classifyFieldInternal(
          currentPhoto.rawUri,
          // "file:///data/data/com.anonymous.frutosmart/cache/TipoA-1.jpeg",
        );

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

  // --- Handlers ---

  const handleTaskComplete = useCallback(
    ({ items }: SegmentationSuccess) => {
      setIsTaskActive(false);
      const segment = items[0];

      // Lógica para enriquecer el segmento antes de guardarlo
      const bestClassIndex = segment.confidences.indexOf(
        Math.max(...segment.confidences),
      );
      const bestClassName =
        LABELS[bestClassIndex] ?? `Tipo ${bestClassIndex + 1}`;

      const finalSegment: DetailedSegment = {
        rawUri: currentPhoto.rawUri,
        segmentedUri: segment.uri,
        bestConfidence: segment.confidences[bestClassIndex] ?? 0,
        bestClassName,
        confidences: segment.confidences,
      };

      updateInternalSegment(finalSegment);
      router.replace(ROUTES.CLASSIFICATION_INTRO);
    },
    [router, currentPhoto, updateInternalSegment],
  );

  const handleTaskError = useCallback(
    (error: SegmentationError) => {
      setIsTaskActive(false);
      errorHandler.handle(error);
    },
    [errorHandler],
  );

  // --- Render Logic ---

  if (!currentPhoto) {
    // Si no hay foto, es un error irrecuperable en esta pantalla
    return (
      <AppView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <AppText color="error">
          Error: No se ha proporcionado una imagen para procesar.
        </AppText>
      </AppView>
    );
  }

  return (
    <AppView legalTextColor="#000">
      <AppLoader
        isReady={isTaskActive}
        asyncTask={performSegmentation}
        onTaskError={handleTaskError}
        onTaskComplete={handleTaskComplete}
        loadingMessage="Analizando imagen..."
        fallbackTimeout={30000}
      />
    </AppView>
  );
};

export default InternalDetectionScreen;
