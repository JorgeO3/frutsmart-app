package com.nanort.module.workflows.plant.pipelines

import com.nanort.module.interpreter.ModelId
import com.nanort.module.workflows.plant.workflows.PlantBunchResult
import com.nanort.module.workflows.plant.workflows.PlantRingResult
import com.nanort.module.workflows.shared.base.AbstractSegmentationPipeline
import com.nanort.module.workflows.shared.segmentation.Segment
import com.nanort.module.workflows.shared.segmentation.SegmentationConfig
import com.nanort.module.workflows.shared.segmentation.SegmentationConfigs
import com.nanort.module.workflows.shared.segmentation.SegmentationProcessor
import com.nanort.module.workflows.shared.segmentation.SegmentationWorkspace
import org.opencv.android.Utils
import org.opencv.core.Mat
import org.opencv.core.Size


class PlantBunchSegmentationPipeline :
  AbstractSegmentationPipeline<PlantRingResult, PlantBunchResult>() {
  override fun getModelId(): ModelId = ModelId.BS
  override fun getConfig(): SegmentationConfig = SegmentationConfigs.BUNCH

  override fun getBitmap(input: PlantRingResult): Mat {
    return Mat().apply {
      Utils.bitmapToMat(input.ringSegmentedBitmap, this)
    }
  }

  override fun buildOutput(
    input: PlantRingResult,
    segments: List<Segment>,
    ws: SegmentationWorkspace
  ): PlantBunchResult {
    if (segments.isEmpty()) {
      throw IllegalStateException("Flujo de Planta: No se encontraron segmentos de racimo válidos.")
    }

    val transformedSegments = SegmentationProcessor.transformNestedSegments(
      bunchSegments = segments,
      originalRingSegment = input.ringSegment,
      targetSize = 640.0
    )

    // 1. Llama al servicio para crear los bitmaps recortados de cada racimo.
    // Es importante usar el 'sourceBitmap' original para que los recortes tengan el color correcto.
    val segmentedBitmaps = SegmentationProcessor.extractCroppedSegments(
      segments = transformedSegments,
      targetSize = Size(224.0, 224.0),
      sourceBitmap = input.sourceBitmap, // <-- USANDO LA IMAGEN DE ALTA RESOLUCIÓN
      ws = ws
    )

    transformedSegments.forEach { it.mask.release() }

    // 2. Construye el objeto de salida con los datos crudos y los bitmaps listos.
    return PlantBunchResult(
      sourceBitmap = input.sourceBitmap,
      bunchSegments = segments,
      segmentedBitmaps = segmentedBitmaps,
    )
  }
}