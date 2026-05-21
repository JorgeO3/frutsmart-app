import * as Crypto from "expo-crypto";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import {
  SaveFormat,
  type ImageRef,
  ImageManipulator,
  type ImageManipulatorContext,
} from "expo-image-manipulator";

import { database } from "@adapters/repository/Database";
import type { FieldWorkState } from "@stores/fieldWork";

// Import necessary types
import type {
  ClassificationPhoto,
  ClassificationResult,
  QualityClassification,
  CreateClassificationPayload,
} from "@adapters/repository/types";

const DATA_RETENTION_DAYS = 30;
const CROPPED_IMAGE_WIDTH = 300;
const CROPPED_IMAGE_HEIGHT = 300;

// --- Directory Path Definitions ---
const BASE_DIR = `${FileSystem.documentDirectory}frutosmart_data/`;
const IMAGES_DIR = `${BASE_DIR}images/`;
const TEMP_SESSIONS_DIR = `${BASE_DIR}temp_sessions/`;

// biome-ignore format: true
export class ClassificationPersistenceService {
  /**
   * Orchestrates the complete saving of a classification. Moves the 8 images
   * to a permanent folder and saves all metadata to the database
   * transactionally.
   * @param data The complete classification data object from the app.
   * @returns The ID of the saved classification.
   */
  public async saveClassification(
    data: FieldWorkState,
    sessionId: string,
  ): Promise<string> {
    const classificationId = Crypto.randomUUID();
    const permanentImageDir = `${IMAGES_DIR}${classificationId}/`;
    console.log(`[Persistence] Starting save for classification: ${classificationId}`);

    try {
      // Ensure that the permanent directory for images exists.
      await FileSystem.makeDirectoryAsync(permanentImageDir, { intermediates: true });

      // 1. Process and persist images, obtaining permanent URIs.
      const photosPayload = await this._processAndPersistPhotos(data, permanentImageDir);

      // 2. Transform the rest of the data to the database format.
      const dbPayload = this._transformDataForDatabase(classificationId, sessionId, data);

      // 3. Save everything to the database transactionally.
      await database.qualityClassifications.create({
        ...dbPayload,
        photos: photosPayload,
      });

      console.log(`[Persistence] Classification ${classificationId} saved successfully.`);
      return classificationId;

    } catch (error) {
      console.error('[Persistence] Failed to save classification:', error);
      // Cleanup logic: if something fails, try to delete the created image folder.
      await FileSystem.deleteAsync(permanentImageDir, { idempotent: true });
      throw error;
    }
  }

  /**
   * Deletes classification data and their associated files that are older
   * than the defined retention period.
   */
  public async purgeOldData(): Promise<void> {
    console.log(`[Maintenance] Starting purge of old data (older than ${DATA_RETENTION_DAYS} days)...`);

    try {
      const oldClassifications = await database.qualityClassifications.findOlderThan(DATA_RETENTION_DAYS);
      if (oldClassifications.length === 0) {
        console.log("[Maintenance] No old data to purge.");
        return;
      }

      const classificationIds = oldClassifications.map(c => c.quality_classification_id);
      console.log(`[Maintenance] ${classificationIds.length} classifications will be purged.`);

      const deleteFilePromises = classificationIds.map(id => {
        const imageDir = `${IMAGES_DIR}${id}/`;
        return FileSystem.deleteAsync(imageDir, { idempotent: true });
      });
      await Promise.all(deleteFilePromises);

      await database.qualityClassifications.deleteByIds(classificationIds);

      console.log("[Maintenance] Old data purge completed.");
    } catch (error) {
      console.error("[Maintenance] Error during data purge:", error);
    }
  }

  /**
   * Cleans the temporary directory of a specific session.
   */
  public async cleanupSessionTempFiles(sessionId: string): Promise<void> {
    const sessionTempDir = `${TEMP_SESSIONS_DIR}${sessionId}/`;
    try {
      console.log(`[Maintenance] Cleaning temporary files for session: ${sessionId}`);
      await FileSystem.deleteAsync(sessionTempDir, { idempotent: true });
    } catch (error) {
      console.error(`[Maintenance] Error cleaning session files for ${sessionId}:`, error);
    }
  }

  private async _processAndPersistPhotos(
    data: FieldWorkState,
    permanentImageDir: string,
  ): Promise<Omit<ClassificationPhoto, "id" | "quality_classification_id">[]> {
    const photosPayload: Omit<ClassificationPhoto, "id" | "quality_classification_id">[] = [];

    // CAMBIO 1: Crear una lista unificada para procesar secuencialmente.
    // Cada elemento tiene la foto y su tipo para saber a qué grupo pertenece.
    const allPhotosToProcess = [
      ...data.externalClassification.segments.map((p, index) => ({ ...p, type: 'external' as const, index })),
      ...data.internalClassification.segments.map((p, index) => ({ ...p, type: 'internal' as const, index })),
    ];

    // CAMBIO 2: Usar un bucle 'for...of' para procesar cada foto de forma SECUENCIAL.
    // Esto evita los picos de RAM al no ejecutar todo en paralelo.
    for (const photo of allPhotosToProcess) {
      const { type: classificationType, index } = photo;
      console.log(`[Persistence] Processing photo ${index} for ${classificationType}`);

      // --- Tarea 1: Procesar la foto original para crear una versión recortada ---
      const croppedFileName = `${classificationType}_cropped_${index}.webp`;
      const permanentCroppedUri = `${permanentImageDir}${croppedFileName}`;

      // CAMBIO 3: Implementar 'try...finally' para la liberación de memoria.
      let ctx: ImageManipulatorContext | null = null;
      let renderedImg: ImageRef | null = null;

      try {
        ctx = ImageManipulator.manipulate(photo.rawUri);
        ctx.resize({ height: CROPPED_IMAGE_HEIGHT, width: CROPPED_IMAGE_WIDTH });
        renderedImg = await ctx.renderAsync();

        const tempProcessedImg = await renderedImg.saveAsync({
          format: SaveFormat.WEBP,
          compress: 0.8,
        });

        await FileSystem.moveAsync({
          from: tempProcessedImg.uri,
          to: permanentCroppedUri,
        });

        photosPayload.push({
          uri: permanentCroppedUri,
          classification_type: classificationType,
          photo_type: "cropped",
          raw_inference_output_json: null,
        });
      } finally {
        // Liberamos la memoria explícitamente sin importar si hubo éxito o error.
        if (renderedImg) {
          renderedImg.release();
          console.log(`[Persistence] Memory released for renderedImg (cropped ${classificationType} ${index})`);
        }
        if (ctx) {
          ctx.release();
          console.log(`[Persistence] Memory released for context (cropped ${classificationType} ${index})`);
        }
      }

      // --- Tarea 2: Mover la foto segmentada si existe ---
      if (photo.segmentedUri) {
        const segmentedFileName = `${classificationType}_segmented_${index}.webp`;
        const permanentSegmentedUri = `${permanentImageDir}${segmentedFileName}`;

        await FileSystem.moveAsync({
          from: photo.segmentedUri,
          to: permanentSegmentedUri,
        });

        photosPayload.push({
          uri: permanentSegmentedUri,
          classification_type: classificationType,
          photo_type: "segmented",
          raw_inference_output_json: null,
        });
      }

      // --- Tarea 3: Copiar la foto en bruto si existe ---
      if (photo.rawUri) {
        const rawFileName = `${classificationType}_raw_${index}.webp`;
        const permanentRawUri = `${permanentImageDir}${rawFileName}`;

        await FileSystem.copyAsync({
          from: photo.rawUri,
          to: permanentRawUri,
        });

        photosPayload.push({
          uri: permanentRawUri,
          classification_type: classificationType,
          photo_type: "raw",
          raw_inference_output_json: null,
        });
      }
    }

    return photosPayload;
  }

  /**
   * Uses the operating system's "Share" API to allow the user to
   * save an individual classification PDF to "Downloads" or share it.
   * @param tempPdfUri The URI of the generated PDF file (in a temporary location).
   * @param classificationId The ID of the classification to name the file.
   */
  public async shareIndividualReportPdf(
    tempPdfUri: string,
    classificationId: string,
  ): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) {
      alert('The sharing function is not available on this device.');
      return;
    }

    try {
      await Sharing.shareAsync(tempPdfUri, {
        dialogTitle: `Classification Report ${classificationId}`,
        mimeType: 'application/pdf',
      });
    } catch (error) {
      console.error('Error sharing individual report:', error);
      throw error;
    }
  }

  /**
   * Transforms the nested data object into the flat payload expected by the repository.
   * @private
   */
  private _transformDataForDatabase(
    id: string,
    sessionId: string,
    data: FieldWorkState,
  ): Omit<CreateClassificationPayload, "photos"> {
    if (!data.traceability.lot || !data.traceability.center || !data.metadata || !data.harvestCriteria) {
      throw new Error("Incomplete data to save classification. Missing traceability data, metadata, or harvest criteria.");
    }

    const classification: QualityClassification = {
      quality_classification_id: id,
      session_id: sessionId,
      creation_timestamp: data.metadata.creationTimestamp,
      lot_id: data.traceability.lot.id,
      center_id: data.traceability.center.id,
      device_time_of_day: data.metadata.device.timeOfDay,
      device_weather: data.metadata.device.weather,
      device_has_internet: data.metadata.device.hasInternet,
      geo_latitude: data.metadata.geolocation.latitude,
      geo_longitude: data.metadata.geolocation.longitude,
      model_detection_id: data.metadata.modelVersions?.detection || null,
      model_external_id: data.metadata.modelVersions?.externalClassification || null,
      model_internal_id: data.metadata.modelVersions?.internalClassification || null,
      harvest_assigned_criterion: data.harvestCriteria.assignedCriterion,
      harvest_number_of_applications: data.harvestCriteria.applicationCount,
      harvest_cluster_weight: data.harvestCriteria.clusterWeight,
      harvest_observation: data.harvestCriteria.observation,
    };

    const results: Omit<ClassificationResult, "id" | "quality_classification_id">[] = [];

    if (data.externalClassification.result) {
      results.push({
        classification_type: 'external',
        ai_predicted_class_name: data.externalClassification.result.aiPrediction.className,
        ai_confidence: data.externalClassification.result.aiPrediction.confidence,
        ai_raw_inference_output_json: JSON.stringify(data.externalClassification.result.aiPrediction.rawInference),
        human_feedback_is_correct: data.externalClassification.result.humanFeedback.isCorrect,
        human_feedback_corrected_class: data.externalClassification.result.humanFeedback.correctedClassName,
        human_feedback_observation: data.externalClassification.result.humanFeedback.observation,
      });
    }

    if (data.internalClassification.result) {
      results.push({
        classification_type: 'internal',
        ai_predicted_class_name: data.internalClassification.result.aiPrediction.className,
        ai_confidence: data.internalClassification.result.aiPrediction.confidence,
        ai_raw_inference_output_json: JSON.stringify(data.internalClassification.result.aiPrediction.rawInference),
        human_feedback_is_correct: data.internalClassification.result.humanFeedback.isCorrect,
        human_feedback_corrected_class: data.internalClassification.result.humanFeedback.correctedClassName,
        human_feedback_observation: data.internalClassification.result.humanFeedback.observation,
      });
    }

    return { classification, results };
  }
}

export const classificationPersistenceService =
  new ClassificationPersistenceService();
