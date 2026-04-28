package expo.modules.nanort.module.workflows.shared.segmentation

import android.graphics.Bitmap
import expo.modules.nanort.core.ModuleLogger
import expo.modules.nanort.core.logI
import expo.modules.nanort.module.opencv.clamp
import expo.modules.nanort.module.opencv.use
import org.opencv.core.Core
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.Rect
import org.opencv.core.Rect2d
import org.opencv.core.Scalar
import org.opencv.core.Size
import org.opencv.dnn.Dnn
import org.opencv.imgproc.Imgproc
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import androidx.core.graphics.createBitmap
import expo.modules.nanort.core.logD
import expo.modules.nanort.core.logE
import expo.modules.nanort.core.logW
import org.opencv.android.Utils


object SegmentationProcessor {

  // ===================== Excepciones específicas =====================
  sealed class SegmentationException(message: String, cause: Throwable? = null) :
    RuntimeException(message, cause)

  class TensorLoadException(message: String, cause: Throwable? = null) :
    SegmentationException(message, cause)

  class NmsException(message: String, cause: Throwable? = null) :
    SegmentationException(message, cause)

  class ExtractionException(message: String, cause: Throwable? = null) :
    SegmentationException(message, cause)

  class LetterboxException(message: String, cause: Throwable? = null) :
    SegmentationException(message, cause)

  private val TAG = ModuleLogger.createTag("SegProcessor")

  private const val EPS = 1e-9

  private val DEFAULT_TARGET_SIZE = Size(640.0, 640.0)
  private val DEFAULT_PAD_COLOR = Scalar(114.0, 114.0, 114.0)
  private val CANVAS_W = DEFAULT_TARGET_SIZE.width.toInt()
  private val CANVAS_H = DEFAULT_TARGET_SIZE.height.toInt()

  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }

  private fun padColorForChannels(channels: Int): Scalar =
    if (channels == 4) Scalar(114.0, 114.0, 114.0, 255.0) else DEFAULT_PAD_COLOR
  
  fun postprocess(
    out: Map<Int, ByteBuffer>,
    meta: LetterboxMeta,
    tensorShapes: TensorShapes,
    workspace: SegmentationWorkspace,
    config: SegmentationConfig
  ): List<Segment> {
    // Decodificar la salida del modelo y generar segmentos
    return decodeOutput(out, meta, tensorShapes, workspace, config)
  }

  fun decodeOutput(
    out: Map<Int, ByteBuffer>,
    meta: LetterboxMeta,
    tensorShapes: TensorShapes,
    workspace: SegmentationWorkspace,
    config: SegmentationConfig
  ): List<Segment> {
    // Cargar tensores (validación de tamaños y endianness)
    loadTensorsFromBuffers(out, workspace)

    // Reordenar detecciones si el layout lo requiere
    reorderDetectionTensor(tensorShapes.detectionLayout, workspace)

    // Construir protoMat (maskH*maskW x maskC)
    val protoMat = createProtoMat(tensorShapes, workspace)

    // Extraer candidatos, NMS y construir segmentos finales
    return extractCandidates(tensorShapes, workspace, config, protoMat, meta)
  }

  private fun createProtoMat(shapes: TensorShapes, workspace: SegmentationWorkspace): Mat {
    // Validación: tamaño esperado de protoTensor
    val expected = shapes.maskH * shapes.maskW * shapes.maskC
    require(workspace.protoTensor.size == expected) {
      "proto_tensor_size_mismatch " + kv("expected" to expected, "actual" to workspace.protoTensor.size)
    }
    return workspace.protoMat.apply {
      create(shapes.maskH * shapes.maskW, shapes.maskC, CvType.CV_32F)
      put(0, 0, workspace.protoTensor) // Pasa el FloatArray directamente
    }
  }

  private fun extractCandidates(
    shapes: TensorShapes,
    workspace: SegmentationWorkspace,
    config: SegmentationConfig,
    protoMat: Mat,
    meta: LetterboxMeta
  ): List<Segment> {
    val layout = shapes.detectionLayout
    require(workspace.orderedDetTensor.size == layout.dets * layout.feats) {
      "det_tensor_size_mismatch " + kv("expected" to (layout.dets * layout.feats), "actual" to workspace.orderedDetTensor.size)
    }

    val detections = extractValidDetections(layout, workspace.orderedDetTensor, config)
    logI(TAG) { "decode_step1 " + kv("candidates" to detections.size, "conf" to config.confThreshold) }

    if (detections.isEmpty()) return emptyList()

    val nmsIndices = performNMS(detections, workspace, config)
    logI(TAG) { "decode_step2 " + kv("after_nms" to nmsIndices.size, "iou" to config.iouThreshold) }

    if (nmsIndices.isEmpty()) return emptyList()

    return createSegmentsFromNMS(nmsIndices, detections, protoMat, shapes, workspace, meta)
  }

  private fun extractValidDetections(
    layout: DetectionLayout,
    detTensor: FloatArray,
    config: SegmentationConfig
  ): List<DetectionData> {
    val out = ArrayList<DetectionData>()
    val feats = layout.feats
    val dets = layout.dets

    require(feats >= 6) { "invalid_feats_count " + kv("feats" to feats) }

    for (d in 0 until dets) {
      val base = d * feats
      val row = DetectionRow(detTensor, base)
      val score = row[4]
      if (score < config.confThreshold) continue

      val cx = row[0]; val cy = row[1]; val w = row[2]; val h = row[3]
      val box = Rect2d(
        (cx - w / 2) * CANVAS_W.toDouble(),
        (cy - h / 2) * CANVAS_H.toDouble(),
        w * CANVAS_W.toDouble(),
        h * CANVAS_H.toDouble()
      )

      // OPTIMIZACIÓN: pasar sólo el slice necesario en el momento del uso (coeficientes)
      out.add(DetectionData(score, box, detTensor.copyOfRange(base, base + feats))) // opcional
      // Alternativa aún más barata: extender DetectionData para que apunte a (detTensor, base)
    }
    return out
  }

  private data class DetectionRow(val data: FloatArray, val base: Int) {
    operator fun get(i: Int) = data[base + i]
    override fun equals(other: Any?): Boolean {
      if (this === other) return true
      if (javaClass != other?.javaClass) return false

      other as DetectionRow

      if (base != other.base) return false
      if (!data.contentEquals(other.data)) return false

      return true
    }

    override fun hashCode(): Int {
      var result = base
      result = 31 * result + data.contentHashCode()
      return result
    }
  }

  private fun performNMS(
    detections: List<DetectionData>,
    workspace: SegmentationWorkspace,
    config: SegmentationConfig
  ): IntArray {
    if (detections.isEmpty()) return intArrayOf()

    // Construye Mats para Dnn.NMSBoxes
    try {
      workspace.nmsBoxes.fromList(detections.map { it.box })
      workspace.nmsScores.fromList(detections.map { it.score })

      Dnn.NMSBoxes(
        workspace.nmsBoxes,
        workspace.nmsScores,
        config.confThreshold,
        config.iouThreshold,
        workspace.nmsIndices
      )
    } catch (t: Throwable) {
      logE(TAG, t) { "nms_error" }
      throw NmsException("Error ejecutando NMSBoxes", t)
    }

    return if (workspace.nmsIndices.empty()) intArrayOf() else workspace.nmsIndices.toArray()
  }


  private fun createSegmentsFromNMS(
    indices: IntArray,
    detections: List<DetectionData>,
    protoMat: Mat,
    shapes: TensorShapes,
    workspace: SegmentationWorkspace,
    meta: LetterboxMeta
  ): List<Segment> {
    val segments = ArrayList<Segment>(indices.size)
    logI(TAG) { "decode_step3 " + kv("final_dets" to indices.size) }

    indices.forEachIndexed { idx, k ->
      val det = detections.getOrNull(k) ?: return@forEachIndexed
      val segment = try {
        createSegmentFromDetection(det, protoMat, shapes, workspace, meta)
      } catch (t: Throwable) {
        logW(TAG) { "segment_build_skip " + kv("idx" to idx, "reason" to (t.message ?: "unknown")) }
        null
      }
      if (segment != null) {
        segments.add(segment)
      }
    }
    logI(TAG) { "decode_step4 " + kv("segments" to segments.size) }
    return segments
  }

  // --- INICIO: NUEVA LÓGICA REFACTORIZADA ---

  /**
   * Función principal refactorizada. Genera un único segmento operando
   * exclusivamente sobre la Región de Interés (ROI) para máxima eficiencia.
   */
  private fun createSegmentFromDetection(
    detection: DetectionData,
    protoMat: Mat,
    shapes: TensorShapes,
    ws: SegmentationWorkspace,
    meta: LetterboxMeta
  ): Segment? {
    // 1) Caja en espacio original
    val row = detection.row
    require(row.size >= 5) { "det_row_too_small " + kv("size" to row.size) }
    val boxNorm = row.sliceArray(0..3)
    val (x, y, w, h) = calculateOriginalBox(boxNorm, meta)
    val originalBox = Rect(x, y, w, h).clamp(meta.origW, meta.origH) ?: return null
    if (originalBox.width <= 0 || originalBox.height <= 0) return null

    // 2) Máscara 8U para la ROI
    val roiMask8u = generateRoiMask8U(row, protoMat, shapes, ws, meta, originalBox)

    // 3) Limpieza morfológica / componente mayor
    performFinalCleaningInPlace(roiMask8u, ws)
    if (Core.countNonZero(roiMask8u) == 0) {
      logD(TAG) { "segment_mask_empty_after_clean" }
      return null
    }

    // 4) Clon único para propiedad del Segment
    val ownedMask = roiMask8u.clone()

    // 5) Métricas
    val area = Core.countNonZero(ownedMask)
    val solidity = area / (originalBox.area() + 1e-6)

    return Segment(detection.score, originalBox, ownedMask, area, solidity)
  }

  /**
   * Genera la máscara binaria 8U SOLO para la ROI del bounding box en espacio original.
   * Evita cualquier Mat del tamaño del frame completo, que era la causa principal del alto consumo de memoria.
   */
  private fun generateRoiMask8U(
    detectionRow: FloatArray,
    protoMat: Mat,
    shapes: TensorShapes,
    ws: SegmentationWorkspace,
    meta: LetterboxMeta,
    roiOrig: Rect
  ): Mat {
    val nCls = shapes.detectionLayout.nCls
    val coefStart = 5 + nCls
    require(detectionRow.size >= coefStart) { "coef_start_oob " + kv("rowSize" to detectionRow.size, "coefStart" to coefStart) }
    val coefs = detectionRow.sliceArray(coefStart until detectionRow.size)
    require(coefs.size == shapes.maskC) {
      "coef_size_mismatch " + kv("expected" to shapes.maskC, "actual" to coefs.size)
    }

    // 1) proto * coef  -> mask160 (CV_32F, 160×160), SIN copias intermedias
    ws.coefCol.create(shapes.maskC, 1, CvType.CV_32F)
    ws.coefCol.put(0, 0, coefs)

    try {
      Core.gemm(protoMat, ws.coefCol, 1.0, Mat(), 0.0, ws.mask1d)
    } catch (t: Throwable) {
      throw ExtractionException("GEMM(proto, coef) falló", t)
    }

    val mask160 = ws.mask1d.reshape(1, shapes.maskH)
    MathUtils.sigmoidInPlace(mask160)

    // 2) Upsample a 640×640 (letterbox space)
    ws.up.create(Size(640.0, 640.0), CvType.CV_32F)
    Imgproc.resize(mask160, ws.up, Size(640.0, 640.0), 0.0, 0.0, Imgproc.INTER_LINEAR)

    // 3) ROI en espacio 640: recorta padding y mapea la ROI original
    val sx = ((roiOrig.x * meta.ratio) + meta.padX).roundToInt().coerceIn(0, ws.up.cols() - 1)
    val sy = ((roiOrig.y * meta.ratio) + meta.padY).roundToInt().coerceIn(0, ws.up.rows() - 1)
    val sw = (roiOrig.width * meta.ratio).roundToInt().coerceAtLeast(1).coerceAtMost(ws.up.cols() - sx)
    val sh = (roiOrig.height * meta.ratio).roundToInt().coerceAtLeast(1).coerceAtMost(ws.up.rows() - sy)
    val roiScaled = Rect(sx, sy, sw, sh)

    val outW = roiOrig.width.coerceAtLeast(1)
    val outH = roiOrig.height.coerceAtLeast(1)

    // 4) Solo reescala la PORCIÓN de la máscara al tamaño de la ROI
    ws.roiFloat.create(outH, outW, CvType.CV_32F)
    ws.up.submat(roiScaled).use { sub ->
      Imgproc.resize(sub, ws.roiFloat, Size(outW.toDouble(), outH.toDouble()), 0.0, 0.0, Imgproc.INTER_LINEAR)
    }

    // 5) Binariza directamente a 8U (sin Mat intermedio gigante)
    ws.roi8.create(outH, outW, CvType.CV_8U)
    Core.compare(ws.roiFloat, Scalar(0.5), ws.roi8, Core.CMP_GT) // ws.roi8 = 0/255 (8U)
    return ws.roi8
  }

  /**
   * Realiza operaciones de limpieza (morfología y "keep largest component")
   * directamente sobre el Mat de la ROI, modificándolo "in-place".
   */
  private fun performFinalCleaningInPlace(mask: Mat, ws: SegmentationWorkspace) {
    // Asegura 8U
    val mask8u = if (mask.type() != CvType.CV_8U) {
      ws.tmp8.create(mask.rows(), mask.cols(), CvType.CV_8U)
      mask.convertTo(ws.tmp8, CvType.CV_8U) // si viene en 0/1 float, añade escala 255.0
      ws.tmp8
    } else mask

    if (Core.countNonZero(mask8u) == 0) return

    Imgproc.morphologyEx(mask8u, mask8u, Imgproc.MORPH_CLOSE, ws.kernel3)
    Imgproc.morphologyEx(mask8u, mask8u, Imgproc.MORPH_OPEN,  ws.kernel3)

    val numLabels = Imgproc.connectedComponentsWithStats(
      mask8u, ws.labelsRoi, ws.stats, ws.centroids, 8, CvType.CV_32S
    )
    if (numLabels <= 1) return

    var maxArea = -1.0
    var maxLabel = -1
    for (i in 1 until numLabels) {
      val area = ws.stats.get(i, Imgproc.CC_STAT_AREA)[0]
      if (area > maxArea) { maxArea = area; maxLabel = i }
    }
    if (maxLabel <= 0) { mask8u.setTo(Scalar(0.0)); return }

    Core.compare(ws.labelsRoi, Scalar(maxLabel.toDouble()), ws.tmp8, Core.CMP_EQ)
    Core.bitwise_and(mask8u, ws.tmp8, mask8u)
  }

  // --- FIN: NUEVA LÓGICA REFACTORIZADA ---

  private fun calculateOriginalBox(boxNorm: FloatArray, meta: LetterboxMeta): List<Int> {
    val (cxNorm, cyNorm, wNorm, hNorm) = boxNorm

    val cx640 = cxNorm * CANVAS_W
    val cy640 = cyNorm * CANVAS_H
    val w640 = wNorm * CANVAS_W
    val h640 = hNorm * CANVAS_H

    val cxScaled = cx640 - meta.padX
    val cyScaled = cy640 - meta.padY

    val cxOrig = cxScaled / meta.ratio
    val cyOrig = cyScaled / meta.ratio
    val wOrig = w640 / meta.ratio
    val hOrig = h640 / meta.ratio

    val x1 = (cxOrig - wOrig / 2).roundToInt()
    val y1 = (cyOrig - hOrig / 2).roundToInt()

    return listOf(x1, y1, wOrig.roundToInt(), hOrig.roundToInt())
  }


  /**
   * Mapea las coordenadas y máscaras de los segmentos desde el espacio de detección
   * (ej. 640x640) de vuelta al espacio de la imagen original de alta resolución.
   */
  fun transformNestedSegments(
    bunchSegments: List<Segment>,
    originalRingSegment: Segment,
    targetSize: Double
  ): List<Segment> {
    val originalBox = originalRingSegment.box
    val origW = originalBox.width.toDouble()
    val origH = originalBox.height.toDouble()

    // Recrea los parámetros del letterboxing que se usaron para crear la imagen de 640x640
    val ratio = min(targetSize / origW, targetSize / origH)
    val newW = origW * ratio
    val newH = origH * ratio
    val padX = (targetSize - newW) / 2
    val padY = (targetSize - newH) / 2

    return bunchSegments.map { bunchSegment ->
      val bunchBox = bunchSegment.box

      // 1. Invierte el padding del letterbox
      val xUnpadded = bunchBox.x - padX
      val yUnpadded = bunchBox.y - padY

      // 2. Invierte el escalado
      val xUnscaled = xUnpadded / ratio
      val yUnscaled = yUnpadded / ratio
      val wUnscaled = bunchBox.width / ratio
      val hUnscaled = bunchBox.height / ratio

      // 3. Suma el offset del recorte original para obtener las coordenadas finales
      val finalX = (xUnscaled + originalBox.x).roundToInt()
      val finalY = (yUnscaled + originalBox.y).roundToInt()
      val finalW = wUnscaled.roundToInt()
      val finalH = hUnscaled.roundToInt()
      val newBox = Rect(finalX, finalY, finalW, finalH)

      // 4. Re-escala la máscara para que coincida con las nuevas dimensiones
      val newMask = Mat()
      Imgproc.resize(
        bunchSegment.mask,
        newMask,
        Size(finalW.toDouble(), finalH.toDouble()),
        0.0,
        0.0,
        Imgproc.INTER_LINEAR
      )

      // Devuelve una copia del segmento con la caja y la máscara actualizadas
      bunchSegment.copy(box = newBox, mask = newMask)
    }
  }

  private fun reorderDetectionTensor(
    layout: DetectionLayout,
    workspace: SegmentationWorkspace
  ) {
    // Si feats-first == false, detTensor ya viene ordenado (dets x feats)
    if (!layout.layoutFeatFirst) {
      // Copia directa (por claridad y para mantener orderedDetTensor consistente)
      System.arraycopy(
        workspace.detTensor, 0,
        workspace.orderedDetTensor, 0,
        workspace.detTensor.size
      )
      return
    }
    // Transponer (feats x dets) -> (dets x feats)
    for (d in 0 until layout.dets) {
      for (f in 0 until layout.feats) {
        workspace.orderedDetTensor[d * layout.feats + f] =
          workspace.detTensor[f * layout.dets + d]
      }
    }
  }


  private fun loadTensorsFromBuffers(
    out: Map<Int, ByteBuffer>,
    workspace: SegmentationWorkspace
  ) {
    val detBuf = out[0] ?: throw TensorLoadException("Falta buffer de detecciones (out[0])")
    val protoBuf = out[1] ?: throw TensorLoadException("Falta buffer de proto (out[1])")

    // TFLite produce little-endian; aseguramos orden para lectura
    detBuf.order(ByteOrder.LITTLE_ENDIAN).rewind()
    protoBuf.order(ByteOrder.LITTLE_ENDIAN).rewind()

    val detFb = detBuf.asFloatBuffer()
    val protoFb = protoBuf.asFloatBuffer()

    val detExpected = workspace.detTensor.size
    val protoExpected = workspace.protoTensor.size

    require(detFb.remaining() == detExpected) {
      "det_buffer_size_mismatch " + kv("expected" to detExpected, "actual" to detFb.remaining())
    }
    require(protoFb.remaining() == protoExpected) {
      "proto_buffer_size_mismatch " + kv("expected" to protoExpected, "actual" to protoFb.remaining())
    }

    detFb.get(workspace.detTensor)
    protoFb.get(workspace.protoTensor)
  }

  fun preprocess(
    srcBGR: Mat,
    targetBuffer: ByteBuffer,
    workspace: SegmentationWorkspace
  ): LetterboxMeta {
    // LOG 1: Muestra el estado inicial de la imagen y el tamaño objetivo del buffer.
    val bufferFloats = targetBuffer.capacity() / 4
    logD(TAG) { "preprocess_begin " + kv(
        "srcW" to srcBGR.width(), 
        "srcH" to srcBGR.height(), 
        "srcC" to srcBGR.channels(), 
        "targetFloats" to bufferFloats
    )}

    Mat().use { letterboxMat ->
      // Paso 1: Aplicar redimensionamiento y relleno (letterboxing)
      val letterboxResult = applyLetterbox(srcBGR, letterboxMat, workspace)
      
      // LOG 2: Revisa las dimensiones DESPUÉS del letterbox.
      // Este es el log más importante. El tamaño aquí debería coincidir con el del modelo (ej: 640x640).
      logD(TAG) { "preprocess_after_letterbox " + kv(
          "matW" to letterboxMat.width(), 
          "matH" to letterboxMat.height(), 
          "matC" to letterboxMat.channels()
      )}

      // Paso 2: Convertir el espacio de color
      convertColorSpace(letterboxMat)

      // LOG 3: Revisa las dimensiones DESPUÉS de la conversión de color.
      // El número de canales (matC) podría cambiar aquí (ej. de 4 a 3).
      logD(TAG) { "preprocess_after_color_conversion " + kv(
          "matW" to letterboxMat.width(), 
          "matH" to letterboxMat.height(), 
          "matC" to letterboxMat.channels()
      )}
      
      // Paso 3: Convertir a Float32 y normalizar
      letterboxMat.convertTo(letterboxMat, CvType.CV_32F, 1.0 / 255.0)
      
      // LOG 4: Revisa las dimensiones JUSTO ANTES de llenar el buffer.
      // Los valores aquí deben multiplicarse para igualar a `targetFloats`.
      logD(TAG) { "preprocess_before_fill_buffer " + kv(
          "matW" to letterboxMat.width(), 
          "matH" to letterboxMat.height(), 
          "matC" to letterboxMat.channels()
      )}

      // Paso 4: Llenar el buffer (donde ocurre el error)
      fillBuffer(letterboxMat, targetBuffer, workspace)

      return LetterboxMeta(
        ratio = letterboxResult.ratio,
        padX = letterboxResult.padX,
        padY = letterboxResult.padY,
        origH = srcBGR.height(),
        origW = srcBGR.width()
      )
    }
  }


  fun parseTensorShapes(shapes: List<IntArray>): TensorShapes {
    require(shapes.size >= 2) { "tensor_shapes_insufficient " + kv("size" to shapes.size) }
    val detShape = shapes[0]
    val protoShape = shapes[1]

    require(detShape.size >= 3) { "det_shape_invalid " + kv("shape" to detShape.contentToString()) }
    require(protoShape.size >= 4) { "proto_shape_invalid " + kv("shape" to protoShape.contentToString()) }

    val dim1 = detShape[1]
    val dim2 = detShape[2]
    val layoutFeatFirst = dim1 < dim2
    val feats = if (layoutFeatFirst) dim1 else dim2
    val dets = if (layoutFeatFirst) dim2 else dim1

    val maskH = protoShape[1]
    val maskW = protoShape[2]
    val maskC = protoShape[3]
    val nCls = feats - 5 - maskC
    require(nCls >= 0) { "nCls_negative " + kv("feats" to feats, "maskC" to maskC) }

    return TensorShapes(
      maskH = maskH,
      maskW = maskW,
      maskC = maskC,
      detectionLayout = DetectionLayout(layoutFeatFirst, feats, dets, nCls)
    )
  }

  private fun applyLetterbox(
    src: Mat,
    dst: Mat,
    workspace: SegmentationWorkspace
  ): LetterboxResult {
    // --- Precondiciones duras ---
    check(!src.empty()) { "src_empty" }
    val srcW = src.width()
    val srcH = src.height()
    check(srcW > 0 && srcH > 0) { "invalid_src_size w=$srcW h=$srcH" }
    check(CANVAS_W > 0 && CANVAS_H > 0) { "invalid_canvas w=$CANVAS_W h=$CANVAS_H" }

    // --- Escala limitante manteniendo AR ---
    val sW = CANVAS_W.toDouble() / srcW.toDouble()
    val sH = CANVAS_H.toDouble() / srcH.toDouble()
    val s = if (sW < sH) sW else sH

    // --- Tamaño redimensionado (cuantizado a px) con correcciones anti-overshoot ---
    var newW = (srcW * s).roundToInt()
    var newH = (srcH * s).roundToInt()

    if (newW > CANVAS_W) {
      newW = CANVAS_W
      newH = ((newW.toDouble() * srcH) / srcW).roundToInt()
    }
    if (newH > CANVAS_H) {
      newH = CANVAS_H
      newW = ((newH.toDouble() * srcW) / srcH).roundToInt()
    }

    // Clamp de seguridad
    if (newW < 1) newW = 1
    if (newH < 1) newH = 1
    if (newW > CANVAS_W) newW = CANVAS_W
    if (newH > CANVAS_H) newH = CANVAS_H

    // Ratios reales (después de redondeo)
    val rx = newW.toDouble() / srcW.toDouble()
    val ry = newH.toDouble() / srcH.toDouble()
    val ratioDiff = kotlin.math.abs(rx - ry)

    // Tolerancia ligada al tamaño (cuantización a 1 px) + epsilon
    val tol = 1.0 / kotlin.math.min(srcW, srcH).toDouble() + 1e-9

    logD(TAG) {
      "applyLetterbox_resize_calc " + kv(
        "srcW" to srcW, "srcH" to srcH,
        "canvasW" to CANVAS_W, "canvasH" to CANVAS_H,
        "sW" to sW, "sH" to sH, "s" to s,
        "newW" to newW, "newH" to newH,
        "rx" to rx, "ry" to ry, "ratioDiff" to ratioDiff, "tol" to tol
      )
    }

    check(ratioDiff <= tol) {
      "non_uniform_scale rx=$rx ry=$ry diff=$ratioDiff tol=$tol new=($newW,$newH) src=($srcW,$srcH)"
    }

    // Interpolación coherente con dirección de escala
    val interp = if (rx < 1.0 - EPS || ry < 1.0 - EPS) Imgproc.INTER_AREA else Imgproc.INTER_LINEAR

    // --- Resize al buffer de trabajo (sin alloc intermedias) ---
    try {
      Imgproc.resize(
        src,
        workspace.resizedMat,
        Size(newW.toDouble(), newH.toDouble()),
        0.0, 0.0, interp
      )
    } catch (t: Throwable) {
      throw LetterboxException("resize_failed", t)
    }

    // --- Padding entero exacto y no negativo ---
    val padW = CANVAS_W - newW
    val padH = CANVAS_H - newH
    check(padW >= 0 && padH >= 0) { "negative_pad padW=$padW padH=$padH" }

    val left = padW / 2
    val right = padW - left
    val top = padH / 2
    val bottom = padH - top
    check(left + right == padW && top + bottom == padH) {
      "pad_sum_mismatch LW=$left RW=$right TH=$top BH=$bottom padW=$padW padH=$padH"
    }

    logD(TAG) { "applyLetterbox_padding_total " + kv("padW" to padW, "padH" to padH) }
    logD(TAG) {
      "applyLetterbox_padding_dist " + kv(
        "top" to top, "bottom" to bottom,
        "left" to left, "right" to right,
        "totalPadW" to (left + right), "totalPadH" to (top + bottom)
      )
    }

    // --- Aplicar borde al canvas final ---
    val borderColor = padColorForChannels(dst.channels())
    try {
      Core.copyMakeBorder(
        workspace.resizedMat,
        dst,
        top, bottom, left, right,
        Core.BORDER_CONSTANT,
        borderColor
      )
    } catch (t: Throwable) {
      throw LetterboxException("copy_make_border_failed", t)
    }

    // --- Postcondiciones duras ---
    check(dst.width() == CANVAS_W && dst.height() == CANVAS_H) {
      "dst_size_mismatch dst=(${dst.width()},${dst.height()}) canvas=($CANVAS_W,$CANVAS_H)"
    }
    logD(TAG) { "applyLetterbox_final_dims " + kv("dstW" to dst.width(), "dstH" to dst.height()) }

    // Ratio único para mapear coords (promedio suaviza el cuantizado)
    val ratio = (rx + ry) * 0.5

    return LetterboxResult(
      ratio = ratio,
      padX = left,
      padY = top
    )
  }

  // private fun applyLetterbox(
  //   src: Mat,
  //   dst: Mat,
  //   workspace: SegmentationWorkspace
  // ): LetterboxResult {
  //   val imgWidth = src.width()
  //   val imgHeight = src.height()

  //   val ratio = min(DEFAULT_TARGET_SIZE.width / imgWidth, DEFAULT_TARGET_SIZE.height / imgHeight)

  //   // Usamos roundToInt aquí para obtener las dimensiones más cercanas
  //   val newW = max(1.0, (imgWidth * ratio).roundToInt().toDouble())
  //   val newH = max(1.0, (imgHeight * ratio).roundToInt().toDouble())
  //   val newSize = Size(newW, newH)

  //   // LOG 1: Dimensiones calculadas para la imagen redimensionada
  //   logD(TAG) { "applyLetterbox_resize_calc " + kv("ratio" to ratio, "newW" to newW, "newH" to newH) }

  //   val interp = if (ratio < 1.0) Imgproc.INTER_AREA else Imgproc.INTER_LINEAR

  //   try {
  //     Imgproc.resize(src, workspace.resizedMat, newSize, 0.0, 0.0, interp)
  //   } catch (t: Throwable) {
  //     throw LetterboxException("resize_failed", t)
  //   }

  //   // padW y padH son enteros, ya que los tamaños del modelo y redimensionado ahora son enteros
  //   val padW = DEFAULT_TARGET_SIZE.width.toInt() - newSize.width.toInt()
  //   val padH = DEFAULT_TARGET_SIZE.height.toInt() - newSize.height.toInt()

  //   // LOG 2: Padding total requerido
  //   logD(TAG) { "applyLetterbox_padding_total " + kv("padW" to padW, "padH" to padH) }

  //   // CORRECCIÓN DEFINITIVA: Lógica de padding segura que garantiza la suma correcta
  //   val top = padH / 2
  //   val bottom = padH - top // El resto va abajo, manejando impares correctamente
  //   val left = padW / 2
  //   val right = padW - left   // El resto va a la derecha

  //   val padding = Padding(top = top, bottom = bottom, left = left, right = right)

  //   // LOG 3: Padding distribuido en cada lado y la suma de verificación
  //   logD(TAG) { "applyLetterbox_padding_dist " + kv(
  //       "top" to padding.top, "bottom" to padding.bottom, 
  //       "left" to padding.left, "right" to padding.right,
  //       "totalPadW" to (padding.left + padding.right),
  //       "totalPadH" to (padding.top + padding.bottom)
  //   )}
    
  //   try {
  //     Core.copyMakeBorder(
  //       workspace.resizedMat, dst,
  //       padding.top, padding.bottom,
  //       padding.left, padding.right,
  //       Core.BORDER_CONSTANT, DEFAULT_PAD_COLOR
  //     )
  //   } catch (t: Throwable) {
  //     throw LetterboxException("copy_make_border_failed", t)
  //   }

  //   // LOG 4: Dimensiones finales de la imagen de salida. ¡Esto es lo que importa!
  //   logD(TAG) { "applyLetterbox_final_dims " + kv("dstW" to dst.width(), "dstH" to dst.height()) }

  //   return LetterboxResult(
  //     ratio = ratio,
  //     padX = padding.left,
  //     padY = padding.top
  //   )
  // }

  // private fun applyLetterbox(
  //   src: Mat,
  //   dst: Mat,
  //   workspace: SegmentationWorkspace
  // ): LetterboxResult {
  //   val imgWidth = src.width()
  //   val imgHeight = src.height()

  //   val ratio = min(DEFAULT_TARGET_SIZE.width / imgWidth, DEFAULT_TARGET_SIZE.height / imgHeight)

  //   val newW = max(1.0, imgWidth * ratio)
  //   val newH = max(1.0, imgHeight * ratio)
  //   val newSize = Size(newW, newH)

  //   val interp = if (ratio < 1.0) Imgproc.INTER_AREA       // downscale
  //   else Imgproc.INTER_LINEAR                 // upscale (o CUBIC si te cabe el coste)

  //   try {
  //     Imgproc.resize(src, workspace.resizedMat, newSize, 0.0, 0.0, interp)
  //   } catch (t: Throwable) {
  //     throw LetterboxException("resize_failed", t)
  //   }

  //   val padW = DEFAULT_TARGET_SIZE.width - newSize.width
  //   val padH = DEFAULT_TARGET_SIZE.height - newSize.height

  //   val dw = padW / 2.0
  //   val dh = padH / 2.0

  //   val padding = Padding(
  //     top = (dh - 0.1).roundToInt(),
  //     bottom = (dh + 0.1).roundToInt(),
  //     left = (dw - 0.1).roundToInt(),
  //     right = (dw + 0.1).roundToInt()
  //   )

  //   try {
  //     Core.copyMakeBorder(
  //       workspace.resizedMat, dst,
  //       padding.top, padding.bottom,
  //       padding.left, padding.right,
  //       Core.BORDER_CONSTANT, DEFAULT_PAD_COLOR
  //     )
  //   } catch (t: Throwable) {
  //     throw LetterboxException("copy_make_border_failed", t)
  //   }

  //   return LetterboxResult(
  //     ratio = ratio,
  //     padX = padding.left,
  //     padY = padding.top
  //   )
  // }

  /**
   * Toma una lista de segmentos y extrae cada uno como un bitmap individual,
   * recortado y con fondo negro. Esta versión es autocontenida y está
   * altamente optimizada para minimizar el uso de memoria.
   *
   * @param sourceBitmap El bitmap original sobre el cual se encontraron los segmentos.
   * @param segments La lista de segmentos a extraer.
   * @param targetSize Opcional. Si se proporciona, cada bitmap se redimensionará a este tamaño.
   * @return Una lista de Bitmaps, donde cada uno es un segmento recortado y enmascarado.
   */
  fun extractCroppedSegments(
    sourceBitmap: Bitmap,
    segments: List<Segment>,
    targetSize: Size? = Size(224.0, 224.0),
    ws: SegmentationWorkspace
  ): List<Bitmap> {
    requireNotNull(targetSize) { "targetSize_required" }
    val outW = targetSize.width.toInt()
    val outH = targetSize.height.toInt()

    // ---- (0) Bitmap -> Mat RGBA 8U (1 sola vez) ----
    ws.extractSrcRgba.create(sourceBitmap.height, sourceBitmap.width, CvType.CV_8UC4)
    Utils.bitmapToMat(sourceBitmap, ws.extractSrcRgba)

    val results = ArrayList<Bitmap>(segments.size)
    val scalarZero4 = Scalar(0.0, 0.0, 0.0, 0.0)

    for (seg in segments) {
      val box = seg.box
      val w = box.width
      val h = box.height

      if (w <= 0 || h <= 0) {
        results.add(createBitmap(outW, outH))
        continue
      }

      // ---------- (1) ROI RGBA (vista) ----------
      val roiRgba = ws.extractSrcRgba.submat(box) // 8UC4 view (no copia)

      try {
        // ---------- (2) Construir RGBA float 0–1 con alfa = máscara ----------
        // 2.1: roiRgba -> srcF (4 canales float escalados 1/255)
        ws.extractTmpColor.create(h, w, CvType.CV_32FC4)
        roiRgba.convertTo(ws.extractTmpColor, CvType.CV_32FC4, 1.0 / 255.0)

        // 2.2: mask (8U) -> aF (32F 0–1), insertar como canal A
        val aF = Mat()
        seg.mask.convertTo(aF, CvType.CV_32F, 1.0 / 255.0) // mismo escalado que A
        Core.insertChannel(aF, ws.extractTmpColor, 3)      // set channel 3 = alfa

        // 2.3: Premultiplicar R,G,B por A (en sitio, sin split completo)
        val ch0 = Mat(); val ch1 = Mat(); val ch2 = Mat()
        Core.extractChannel(ws.extractTmpColor, ch0, 0)
        Core.extractChannel(ws.extractTmpColor, ch1, 1)
        Core.extractChannel(ws.extractTmpColor, ch2, 2)

        Core.multiply(ch0, aF, ch0)   // R *= A
        Core.multiply(ch1, aF, ch1)   // G *= A
        Core.multiply(ch2, aF, ch2)   // B *= A

        Core.insertChannel(ch0, ws.extractTmpColor, 0)
        Core.insertChannel(ch1, ws.extractTmpColor, 1)
        Core.insertChannel(ch2, ws.extractTmpColor, 2)

        ch0.release(); ch1.release(); ch2.release()
        aF.release()

        // ---------- (3) Escalado manteniendo aspecto (igual que A) ----------
        val scale = min(outW / w.toDouble(), outH / h.toDouble())
        val newW = max(1, (w * scale).roundToInt())
        val newH = max(1, (h * scale).roundToInt())
        val interp = if (scale < 1.0) Imgproc.INTER_AREA else Imgproc.INTER_LINEAR

        // resizedF (32FC4) usa ws.extractCanvasRgb como buffer temporal
        ws.extractCanvasRgb.create(newH, newW, CvType.CV_32FC4)
        Imgproc.resize(
          ws.extractTmpColor, ws.extractCanvasRgb,
          Size(newW.toDouble(), newH.toDouble()),
          0.0, 0.0, interp
        )

        // ---------- (4) Letterbox transparente (0,0,0,0) en float ----------
        val padX = (outW - newW).coerceAtLeast(0)
        val padY = (outH - newH).coerceAtLeast(0)
        val left = padX / 2
        val right = padX - left
        val top = padY / 2
        val bottom = padY - top

        // paddedF (32FC4) vuelve a usar extractTmpColor con dims finales
        ws.extractTmpColor.create(outH, outW, CvType.CV_32FC4)
        Core.copyMakeBorder(
          ws.extractCanvasRgb, ws.extractTmpColor,
          top, bottom, left, right,
          Core.BORDER_CONSTANT, scalarZero4
        )

        // ---------- (5) A 8UC4, descartar A y volcar a Bitmap ----------
        // canvasU8 (8UC4) re-usa extractCanvasRgb
        ws.extractCanvasRgb.create(outH, outW, CvType.CV_8UC4)
        ws.extractTmpColor.convertTo(ws.extractCanvasRgb, CvType.CV_8UC4, 255.0)

        // finalRgb (8UC3) usa extractSrcRgb
        ws.extractSrcRgb.create(outH, outW, CvType.CV_8UC3)
        Imgproc.cvtColor(ws.extractCanvasRgb, ws.extractSrcRgb, Imgproc.COLOR_RGBA2RGB)

        val outBmp = createBitmap(outW, outH)
        Utils.matToBitmap(ws.extractSrcRgb, outBmp)
        results.add(outBmp)
      } finally {
        roiRgba.release() // liberar la vista ROI
      }
    }

    return results
  }

  /**
   * Extrae y clasifica segmentos sin crear lista de Bitmaps.
   * Procesa uno por vez y reutiliza buffers (pico mínimo).
   */
  fun extractCroppedSegmentsStreaming(
    srcRgba: Mat,                       // Mat de la imagen completa (8UC4), ya existente
    segments: List<Segment>,
    targetSize: Size = Size(224.0, 224.0),
    ws: SegmentationWorkspace,
    consumer: (index: Int, outBitmap: Bitmap) -> Unit
  ) {
    val outW = targetSize.width.toInt()
    val outH = targetSize.height.toInt()
    // Pool: un solo Bitmap reutilizable
    val reusable = createBitmap(outW, outH)

    val rgb = ws.extractSrcRgb
    val resizedRgb = ws.extractCanvasRgb       // reutilizado como 8UC3
    val resizedMask = ws.tmp8                  // reutilizado como 8U

    for ((idx, seg) in segments.withIndex()) {
      val box = seg.box
      val w = box.width.coerceAtLeast(1)
      val h = box.height.coerceAtLeast(1)

      // 1) ROI (vista) y a RGB 8UC3
      srcRgba.submat(box).use { roiRgba ->
        rgb.create(h, w, CvType.CV_8UC3)
        Imgproc.cvtColor(roiRgba, rgb, Imgproc.COLOR_RGBA2RGB)

        // 2) Mantener aspecto: calcular newW/newH
        val scale = min(outW / w.toDouble(), outH / h.toDouble())
        val newW = max(1, (w * scale).roundToInt())
        val newH = max(1, (h * scale).roundToInt())

        // 3) Redimensionar color y máscara
        resizedRgb.create(newH, newW, CvType.CV_8UC3)
        Imgproc.resize(rgb, resizedRgb, Size(newW.toDouble(), newH.toDouble()),
          0.0, 0.0, if (scale < 1.0) Imgproc.INTER_AREA else Imgproc.INTER_LINEAR)

        resizedMask.create(newH, newW, CvType.CV_8U)
        Imgproc.resize(seg.mask, resizedMask, Size(newW.toDouble(), newH.toDouble()),
          0.0, 0.0, Imgproc.INTER_NEAREST)   // preservar bordes máscara

        // 4) Aplicar máscara en 8-bit: fondo negro
        val padded = ws.extractTmpColor // lo reutilizamos como lienzo 8UC3
        padded.create(outH, outW, CvType.CV_8UC3)
        padded.setTo(Scalar(0.0, 0.0, 0.0))

        // Copiar contenido centrado
        val left = (outW - newW) / 2
        val top  = (outH - newH) / 2
        padded.submat(Rect(left, top, newW, newH)).use { dst ->
          resizedRgb.copyTo(dst, resizedMask)
        }

        // 5) Volcar al Bitmap reutilizable
        Utils.matToBitmap(padded, reusable)
        consumer(idx, reusable)
      }
    }
  }

  private fun fillBuffer(mat: Mat, targetBuffer: ByteBuffer, workspace: SegmentationWorkspace) {
    val requiredSize = (mat.total() * mat.channels()).toInt().coerceAtLeast(1)
    if (workspace.normalizedFloatArray?.size != requiredSize) {
      workspace.normalizedFloatArray = FloatArray(requiredSize)
    }

    val floatArray = workspace.normalizedFloatArray!!
    mat.get(0, 0, floatArray)

    val floatArraySize = floatArray.size
    val bufferCapacityInFloats = targetBuffer.capacity() / 4

    require(floatArraySize == bufferCapacityInFloats) {
      "pre_fill_size_mismatch " + kv("floats" to floatArraySize, "bufferFloats" to bufferCapacityInFloats)
    }

    targetBuffer.rewind()
    targetBuffer.asFloatBuffer().put(floatArray)
    targetBuffer.rewind()
  }

  private fun convertColorSpace(mat: Mat) {
    when (mat.channels()) {
      4 -> Imgproc.cvtColor(mat, mat, Imgproc.COLOR_RGBA2RGB)  // Android: RGBA -> RGB
      3 -> { /* ya está en RGB; no hacer nada */ }
      1 -> { /* opcional: promover a RGB si tu modelo lo requiere */ }
      else -> error("Formato de ${mat.channels()} canales no soportado")
    }
  }

  private data class DetectionData(val score: Float, val box: Rect2d, val row: FloatArray) {
    override fun equals(other: Any?): Boolean {
      if (this === other) return true
      if (javaClass != other?.javaClass) return false
      other as DetectionData
      if (score != other.score) return false
      if (box != other.box) return false
      if (!row.contentEquals(other.row)) return false
      return true
    }

    override fun hashCode(): Int {
      var result = score.hashCode()
      result = 31 * result + box.hashCode()
      result = 31 * result + row.contentHashCode()
      return result
    }
  }
}