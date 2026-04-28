package com.nanort.module.workflows.shared.segmentation

import org.opencv.core.Mat
import org.opencv.core.MatOfFloat
import org.opencv.core.MatOfInt
import org.opencv.core.MatOfRect2d
import org.opencv.core.Scalar
import org.opencv.core.Size
import org.opencv.imgproc.Imgproc

import java.io.Closeable

import com.nanort.core.logD
import com.nanort.module.primitives.Resettable


class SegmentationWorkspace : Resettable, Closeable {
  // Buffers para salida cruda del intérprete
  lateinit var detTensor: FloatArray
  lateinit var protoTensor: FloatArray
  lateinit var orderedDetTensor: FloatArray

  // Mats para Non-Max Suppression (NMS)
  val nmsBoxes = MatOfRect2d()
  val nmsScores = MatOfFloat()
  val nmsIndices = MatOfInt()

  // --- Búferes para la generación de máscaras (Etapa 1: de 160x160 a 640x640) ---
  val protoMat = Mat()
  val coefCol = Mat()
  val mask1d = Mat()      // CV_32F
  val mask160 = Mat()     // CV_32F
  val up = Mat()          // CV_32F [640, 640]
  val tmp8 = Mat()        // Búfer temporal CV_8U de propósito general

  // --- Búferes para el procesamiento por ROI (Etapa 2: Optimización clave) ---
  val maskScaled = Mat()  // CV_32F, contiene el recorte del letterbox
  val roiScaled = Mat()   // CV_32F, la ROI dentro del espacio escalado
  val roiFloat = Mat()    // CV_32F, la ROI reescalada al tamaño original
  val roi8 = Mat()        // CV_8U, la ROI final en 8 bits

  // --- Búferes para Morfología y Componentes Conectados (sobre ROI) ---
  val labelsRoi = Mat()   // CV_32S, para `connectedComponents` sobre la ROI
  val stats = Mat()
  val centroids = Mat()
  val kernel3: Mat = Imgproc.getStructuringElement(Imgproc.MORPH_ELLIPSE, Size(3.0, 3.0))
  val kernel5: Mat = Imgproc.getStructuringElement(Imgproc.MORPH_ELLIPSE, Size(5.0, 5.0))

  // --- Extractor de crops (reutilizables) ---
  val extractSrcRgba  = Mat() // Bitmap->Mat directo (CV_8UC4)
  val extractSrcRgb   = Mat() // Conversión a RGB (CV_8UC3) para trabajar
  val extractTmpColor = Mat() // ROI color redimensionada (CV_8UC3)
  val extractCanvasRgb= Mat() // Lienzo final outH×outW (CV_8UC3)

  // Mats para el preprocesamiento de la imagen de entrada
  val resizedMat = Mat()

  // Buffer de CPU para transferir la imagen de entrada al intérprete
  var normalizedFloatArray: FloatArray? = null

  // Lista consolidada de todos los Mat gestionados para su liberación automática
  private val managedMats: List<Mat> = listOf(
    // NMS
    nmsBoxes, nmsScores, nmsIndices,
    // Generación de Máscaras (Etapa 1)
    protoMat, coefCol, mask1d, mask160, up, tmp8,
    // Procesamiento por ROI (Etapa 2)
    maskScaled, roiScaled, roiFloat, roi8,
    // Morfología y CC
    labelsRoi, stats, centroids, kernel3, kernel5,
    // Preprocesamiento
    resizedMat
  )

  /**
   * Prepara los búferes de array para un conjunto específico de formas de tensor.
   * Solo crea un nuevo array si no existe o si el tamaño requerido es diferente.
   */
  fun prepareFor(shapes: TensorShapes) {
    val layout = shapes.detectionLayout

    val requiredDetSize = layout.dets * layout.feats
    val requiredProtoSize = shapes.maskH * shapes.maskW * shapes.maskC

    if (!::detTensor.isInitialized || detTensor.size != requiredDetSize) {
      logD { "Allocating new detTensor with size: $requiredDetSize" }
      detTensor = FloatArray(requiredDetSize)
      orderedDetTensor = FloatArray(requiredDetSize)
    }
    if (!::protoTensor.isInitialized || protoTensor.size != requiredProtoSize) {
      logD { "Allocating new protoTensor with size: $requiredProtoSize" }
      protoTensor = FloatArray(requiredProtoSize)
    }
  }

  override fun reset() {
    logD { "Resetting all image workspace Mats to zero." }
    // Esta función no necesita cambios, ya que itera sobre la lista `managedMats` actualizada.
    managedMats.forEach { mat ->
      if (!mat.empty()) {
        mat.setTo(Scalar(0.0))
      }
    }
  }

  override fun close() {
    logD { "Releasing all native Mats from workspace." }
    // Esta función no necesita cambios, `managedMats` ya está actualizada.
    managedMats.forEach { it.release() }
    normalizedFloatArray = null
  }
}