package expo.modules.nanort.module.workflows.field.workflows

import android.graphics.Bitmap

import expo.modules.nanort.module.workflows.shared.classification.ClassificationResult


/** La entrada para el primer pipeline de la cadena de campo. */
data class FieldInitialInput(val bitmap: Bitmap)

/** La salida del pipeline de segmentación y la entrada para los de clasificación. */
data class FieldSegmentationResult(
  val sourceBitmap: Bitmap,
  val segmentedBitmaps: List<Bitmap>
)

// 1. Mantenemos la clase base genérica
data class FieldClassificationResult(
  val classifications: List<ClassificationResult>,
  val segmentedBitmaps: List<Bitmap>
)