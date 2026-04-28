package expo.modules.nanort.module.workflows.plant.workflows

import android.graphics.Bitmap

import expo.modules.nanort.module.workflows.shared.classification.ClassificationResult
import expo.modules.nanort.module.workflows.shared.segmentation.Segment


/** La entrada inicial para cualquier workflow del módulo de planta. */
data class PlantInitialInput(val bitmap: Bitmap)

/**
 * El resultado del pipeline de segmentación de anillo.
 * Contiene el bitmap original y el segmento del anillo encontrado.
 */
data class PlantRingResult(
  val sourceBitmap: Bitmap,
  val ringSegment: Segment,
  val ringSegmentedBitmap: Bitmap,
)

/**
 * El resultado del pipeline de segmentación de racimos.
 * Contiene el bitmap original y la lista de racimos encontrados.
 */
data class PlantBunchResult(
  val sourceBitmap: Bitmap,
  val bunchSegments: List<Segment>,
  val segmentedBitmaps: List<Bitmap> // <-- CAMPO NUEVO Y CLAVE
)

data class PlantSingleResult (
  val sourceBitmap: Bitmap,
  val segmentedBitmaps: List<Bitmap>
)

/**
 * El resultado final de un workflow de clasificación en el módulo de planta.
 * Contiene el bitmap original y el resultado agregado de la clasificación.
 */
data class PlantClassificationResult(
  val classifications: List<ClassificationResult>,
  val segmentedBitmaps: List<Bitmap>
)