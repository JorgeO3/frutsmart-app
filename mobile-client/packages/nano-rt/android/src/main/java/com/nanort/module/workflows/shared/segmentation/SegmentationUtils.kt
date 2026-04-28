package com.nanort.module.workflows.shared.segmentation

import org.opencv.core.Core
import org.opencv.core.Mat
import org.opencv.core.Rect
import org.opencv.core.Scalar


/**
 * Contiene todos los parámetros configurables para el post-procesamiento de una segmentación.
 */
data class SegmentationConfig(
  val confThreshold: Float,
  val iouThreshold: Float,
)

object SegmentationConfigs {
  val RING = SegmentationConfig(
    confThreshold = 0.50f,
    iouThreshold = 0.70f,
  )
//  Evaluando segmento #1: Score=0.96, ÁreaRel=0.316, Solidez=0.784, Aspecto=0.788
  val BUNCH = SegmentationConfig(
    confThreshold = 0.40f,
    iouThreshold = 0.70f,
  )

  val SINGLE = SegmentationConfig(
    confThreshold = 0.50f,
    iouThreshold = 0.70f,
  )
}

/**
 * Representa un único segmento detectado, con su máscara y métricas.
 */
data class Segment(
  val score: Float,
  val box: Rect,
  val mask: Mat, // La máscara final en el tamaño del 'box' (ROI)
  val area: Int,
  val solidity: Double
) {
  /** Libera la memoria de la máscara de OpenCV para prevenir memory leaks. */
  fun release() {
    mask.release()
  }
}

data class DetectionLayout(
  val layoutFeatFirst: Boolean,
  val feats: Int,
  val dets: Int,
  val nCls: Int
)

data class TensorShapes(
  val maskH: Int,
  val maskW: Int,
  val maskC: Int,
  val detectionLayout: DetectionLayout
)

data class Padding(
  val top: Int,
  val bottom: Int,
  val left: Int,
  val right: Int
)

data class LetterboxResult(
  val ratio: Double,
  val padX: Int,
  val padY: Int
)

data class LetterboxMeta(
  val ratio: Double,
  val padX: Int,
  val padY: Int,
  val origH: Int,
  val origW: Int
)

object MathUtils {
  private val ONE = Scalar(1.0)
  private val NEG = Scalar(-1.0)

  fun sigmoidInPlace(m: Mat) {
    Core.multiply(m, NEG, m)
    Core.exp(m, m)
    Core.add(m, ONE, m)
    Core.divide(1.0, m, m)
  }
}
