import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { database } from "@adapters/repository/Database";
import type { FullAnalysisInput } from "@adapters/repository/types";
import type { Classification, PlantWorkState } from "@stores/plantWork";

const DATA_RETENTION_DAYS = 30;

// --- Definiciones de Rutas de Directorios ---
const BASE_DIR = `${FileSystem.documentDirectory}frutosmart_plant_data/`;
const ANALYSES_DIR = `${BASE_DIR}analyses/`;

// biome-ignore format: readability
export class AnalysisPersistenceService {
  /**
   * Orquesta el guardado completo de un análisis de calidad.
   * Mueve todas las imágenes asociadas a una carpeta permanente y guarda
   * todos los metadatos en la base de datos de forma transaccional.
   * @param data El estado completo del store `plantWorkStore`.
   * @returns El ID del nuevo análisis de calidad guardado.
   */
  public async saveAnalysis(data: PlantWorkState, sessionId: string): Promise<string> {
    const analysisId = Crypto.randomUUID();
    const permanentImageDir = `${ANALYSES_DIR}${analysisId}/`;
    console.log(`[Persistence] Iniciando guardado para el análisis: ${analysisId}`);

    try {
      // Aseguramos que el directorio permanente para las imágenes exista.
      await FileSystem.makeDirectoryAsync(permanentImageDir, { intermediates: true });

      // 1. Procesar y persistir todas las imágenes, obteniendo sus URIs permanentes.
      const classificationsWithPermanentUris = await this._processAndPersistPhotos(
        data.qualityClassifications,
        permanentImageDir
      );

      // 2. Transformar los datos del store al formato que espera el repositorio.
      const dbPayload = this._transformDataForRepository(
        data,
        sessionId,
        classificationsWithPermanentUris
      );

      // 3. Guardar todo en la base de datos a través del repositorio principal.
      await database.qualityAnalyses.createAndFinalize(dbPayload, analysisId);

      console.log(`[Persistence] Análisis ${analysisId} guardado exitosamente.`);
      return analysisId;

    } catch (error) {
      console.error('[Persistence] Falló el guardado del análisis:', error);
      // Lógica de limpieza: si algo falla, intentamos borrar la carpeta de imágenes creada.
      await FileSystem.deleteAsync(permanentImageDir, { idempotent: true });
      throw error;
    }
  }

  /**
   * Procesa y mueve todas las imágenes de un análisis (raw, internal, segments)
   * a su directorio permanente.
   * @returns Una nueva versión del array de clasificaciones con las URIs actualizadas.
   */
  private async _processAndPersistPhotos(
    classifications: Classification[],
    permanentDir: string,
  ): Promise<Classification[]> {
    const newClassifications = JSON.parse(JSON.stringify(classifications)) as Classification[];
    const movePromises: Promise<void>[] = [];

    newClassifications.forEach((classification, i) => {
      // Mover la foto cruda externa
      if (classification.external.rawPhotoUri) {
        const newExternalRawUri = `${permanentDir}external_raw_${i}.webp`;
        movePromises.push(FileSystem.moveAsync({ from: classification.external.rawPhotoUri, to: newExternalRawUri }));
        classification.external.rawPhotoUri = newExternalRawUri;
      }

      // Mover la foto cruda interna (si existe)
      if (classification.internal?.rawPhotoUri) {
        const newInternalRawUri = `${permanentDir}internal_raw_${i}.webp`;
        movePromises.push(FileSystem.moveAsync({ from: classification.internal.rawPhotoUri, to: newInternalRawUri }));
        classification.internal.rawPhotoUri = newInternalRawUri;
      }

      // Mover la foto segmentada interna (si existe)
      if (classification.internal?.segmentedPhotoUri) {
        const newInternalSegmentedUri = `${permanentDir}internal_segmented_${i}.webp`;
        movePromises.push(FileSystem.moveAsync({ from: classification.internal.segmentedPhotoUri, to: newInternalSegmentedUri }));
        classification.internal.segmentedPhotoUri = newInternalSegmentedUri;
      }

      // Mover todos los segmentos clasificados
      classification.external.classifiedSegments.forEach((segment, j) => {
        const segmentUri = segment.uri;
        if (segmentUri) {
          const newSegmentUri = `${permanentDir}segment_${i}_${j}.webp`;
          movePromises.push(FileSystem.moveAsync({ from: segmentUri, to: newSegmentUri }));
          segment.uri = newSegmentUri;
        }
      });
    });

    await Promise.all(movePromises);
    return newClassifications;
  }

  /**
   * Transforma el estado de Zustand al payload que espera el QualityAnalysisRepository.
   */
  private _transformDataForRepository(
    data: PlantWorkState,
    sessionId: string,
    classificationsWithPermanentUris: Classification[]
  ): FullAnalysisInput {
    // Validar que los datos necesarios existan
    if (!data.traceability || !data.metadata || !data.harvestCriteria || !data.summary) {
      throw new Error("Datos incompletos para guardar el análisis.");
    }

    const { traceability, metadata, harvestCriteria, summary } = data;
    const lotIds = traceability.provider === 'own' ? traceability.ownData?.lots.map(l => l.id) ?? [] : [];

    const dbPayload: FullAnalysisInput = {
      traceability: {
        provider: traceability.provider as 'own' | 'third-party',
        qr_code: traceability.qrCode ?? null,
        truck_plate: traceability.truckPlate ?? '',
        consecutive_number: traceability.consecutiveNumber ?? '',
        program_id: traceability.provider === 'own' ? traceability.ownData?.program.id : undefined,
        vendor: traceability.provider === 'third-party' ? traceability.thirdPartyData?.vendor : undefined,
        sub_vendor: traceability.provider === 'third-party' ? traceability.thirdPartyData?.subVendor : undefined,
      },
      metadata: {
        creation_timestamp: metadata.creationTimestamp,
        session_id: sessionId,
        device_time_of_day: metadata.device.timeOfDay,
        device_weather: metadata.device.weather,
        device_has_internet: metadata.device.hasInternet,
        geo_latitude: metadata.geolocation.latitude,
        geo_longitude: metadata.geolocation.longitude,
        model_detection_id: metadata.modelVersions?.detection ?? null,
        model_external_id: metadata.modelVersions?.externalClassification ?? null,
        model_internal_id: metadata.modelVersions?.internalClassification ?? null,
      },
      criteria: harvestCriteria,
      summary: {
        external_summary_json: JSON.stringify(summary.external.humanSummary ?? summary.external.aiSummary),
        internal_summary_json: JSON.stringify(summary.internal),
      },
      lotIds,
      classifications: classificationsWithPermanentUris.map((c, index) => {
        if (index === 3) {
          return {
            iteration_index: index,
            external_raw_photo_uri: c.external.rawPhotoUri,
            segments: c.external.classifiedSegments.map(s => ({
              uri: s.uri,
              best_class_name: s.bestClassName,
              best_confidence: s.bestConfidence,
              confidences_json: JSON.stringify(s.confidences),
            })),
            internal_raw_photo_uri: null,
            internal_segmented_photo_uri: null,
            internal_ai_class_name: null,
            internal_ai_confidence: null,
            internal_ai_raw_confidences_json: null,
            internal_hf_is_correct: null,
            internal_hf_corrected_class_name: null,
            internal_hf_observation: null,
          };
        }

        return {
          iteration_index: index,
          external_raw_photo_uri: c.external.rawPhotoUri,
          segments: c.external.classifiedSegments.map(s => ({
            uri: s.uri,
            best_class_name: s.bestClassName,
            best_confidence: s.bestConfidence,
            confidences_json: JSON.stringify(s.confidences),
          })),
          internal_raw_photo_uri: c.internal?.rawPhotoUri ?? null,
          internal_segmented_photo_uri: c.internal?.segmentedPhotoUri ?? null,
          internal_ai_class_name: c.internal?.aiPrediction.className ?? null,
          internal_ai_confidence: c.internal?.aiPrediction.confidence ?? null,
          internal_ai_raw_confidences_json: c.internal ? JSON.stringify(c.internal.aiPrediction.rawConfidences) : null,
          internal_hf_is_correct: c.internal?.humanFeedback?.isCorrect ?? null,
          internal_hf_corrected_class_name: c.internal?.humanFeedback?.correctedClassName ?? null,
          internal_hf_observation: c.internal?.humanFeedback?.observation ?? null,
        }
      })
    }

    return dbPayload;
  }

  /**
   * Elimina análisis y sus archivos asociados que son más antiguos que el
   * período de retención definido.
   * @param retentionDays El número de días que se deben conservar los datos.
   */
  public async purgeOldData(): Promise<void> {
    console.log(`[Maintenance] Iniciando purga de datos (más antiguos de ${DATA_RETENTION_DAYS} días)...`);

    try {
      // 1. Encontrar los registros antiguos en la base de datos.
      const oldAnalyses = await database.qualityAnalyses.findOlderThan(DATA_RETENTION_DAYS);

      if (oldAnalyses.length === 0) {
        console.log("[Maintenance] No hay datos antiguos para purgar.");
        return;
      }

      const analysisIds = oldAnalyses.map(a => a.id);
      console.log(`[Maintenance] Se purgarán ${analysisIds.length} análisis.`);

      // 2. Borrar las carpetas de imágenes asociadas en paralelo.
      const deleteFilePromises = analysisIds.map(id => {
        const imageDir = `${ANALYSES_DIR}${id}/`;
        // 'idempotent: true' evita errores si la carpeta ya no existe.
        return FileSystem.deleteAsync(imageDir, { idempotent: true });
      });

      await Promise.all(deleteFilePromises);
      console.log(`[Maintenance] Archivos de ${analysisIds.length} análisis eliminados.`);

      // 3. Borrar los registros de la base de datos en una sola operación.
      await database.qualityAnalyses.deleteByIds(analysisIds);
      console.log(`[Maintenance] Registros de ${analysisIds.length} análisis eliminados de la BD.`);

      console.log("[Maintenance] Purga de datos antiguos completada.");
    } catch (error) {
      console.error("[Maintenance] Error durante la purga de datos:", error);
      // Opcional: podrías querer re-lanzar el error para manejarlo en un nivel superior.
      // throw error;
    }
  }

  /**
   * Permite al usuario compartir el PDF de un reporte de análisis.
   */
  public async shareReportPdf(tempPdfUri: string, reportId: string): Promise<void> {
    // Similar a la versión de Campo, pero usando el reportId del análisis.
    if (!(await Sharing.isAvailableAsync())) {
      alert('La función de compartir no está disponible en este dispositivo.');
      return;
    }

    try {
      await Sharing.shareAsync(tempPdfUri, {
        dialogTitle: `Reporte de Análisis ${reportId}`,
        mimeType: 'application/pdf',
      });
    } catch (error) {
      console.error('Error compartiendo el reporte:', error);
      throw error;
    }
  }
}

export const analysisPersistenceService = new AnalysisPersistenceService();
