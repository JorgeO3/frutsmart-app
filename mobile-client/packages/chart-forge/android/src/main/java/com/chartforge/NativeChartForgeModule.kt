package com.chartforge

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.view.View.MeasureSpec
import androidx.core.content.FileProvider
import androidx.core.graphics.toColorInt
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.github.mikephil.charting.charts.PieChart
import com.github.mikephil.charting.components.Legend
import com.github.mikephil.charting.data.PieData
import com.github.mikephil.charting.data.PieDataSet
import com.github.mikephil.charting.data.PieEntry
import com.github.mikephil.charting.formatter.ValueFormatter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.text.DecimalFormat
import java.util.Locale

private const val TAG = "NativeChartForge"
private const val DEFAULT_IMAGE_FORMAT = "WEBP"
private const val DEFAULT_IMAGE_QUALITY = 100
private const val DEFAULT_URI_TYPE = "content"
private const val DEFAULT_PERCENT_THRESHOLD = 7.0f
private const val PIE_CHART_LEGEND_COLOR_HEX = "#E84C16"
private const val CACHE_DIR_NAME = "chart_forge"
private const val FILE_PROVIDER_AUTHORITY_SUFFIX = ".chartforge.fileprovider"

private class ChartForgeException(
  val code: String,
  message: String,
  cause: Throwable? = null,
) : RuntimeException(message, cause)

private data class ChartDataPoint(
  val value: Double,
  val label: String,
  val color: String,
)

private data class ChartRenderConfig(
  val id: String,
  val width: Int,
  val height: Int,
  val data: List<ChartDataPoint>,
  val format: String,
  val quality: Int,
  val uriType: String,
)

/**
 * Formats pie chart values as percentages.
 *
 * Labels below the configured threshold are hidden to avoid visual clutter.
 */
private class PercentThresholdFormatter(
  private val threshold: Float = DEFAULT_PERCENT_THRESHOLD,
) : ValueFormatter() {
  private val formatter = DecimalFormat("###,###,##0.0")

  override fun getPieLabel(value: Float, pieEntry: PieEntry?): String {
    return if (value < threshold) "" else "${formatter.format(value)} %"
  }
}

/**
 * TurboModule implementation for ChartForge.
 *
 * This class is backed by the React Native Codegen-generated NativeChartForgeSpec.
 */
class NativeChartForgeModule(reactContext: ReactApplicationContext) : NativeChartForgeSpec(reactContext) {
  private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

  override fun generatePieChart(config: ReadableMap, promise: Promise) {
    moduleScope.launch {
      try {
        val renderConfig = parseChartConfig(config)
        val uri = generatePieChartInternal(renderConfig)
        promise.resolve(uri)
      } catch (error: Throwable) {
        rejectPromise(promise, error)
      }
    }
  }

  override fun invalidate() {
    moduleScope.cancel()
    super.invalidate()
  }

  private suspend fun generatePieChartInternal(config: ChartRenderConfig): String {
    val bitmap = renderPieChartBitmap(config)

    val outputFile = try {
      withContext(Dispatchers.IO) {
        saveBitmapToCache(bitmap, config)
      }
    } finally {
      if (!bitmap.isRecycled) {
        bitmap.recycle()
      }
    }

    return resolveOutputUri(outputFile, config.uriType)
  }

  private suspend fun renderPieChartBitmap(config: ChartRenderConfig): Bitmap =
    withContext(Dispatchers.Main.immediate) {
      val entries = config.data.map { item ->
        PieEntry(item.value.toFloat(), item.label)
      }

      val colors = config.data.map { item ->
        parseColorOrThrow(item.color)
      }

      val pieChart = PieChart(reactApplicationContext).apply {
        setBackgroundColor(Color.WHITE)
        setDrawEntryLabels(false)
        setEntryLabelColor(Color.BLACK)
        setUsePercentValues(true)
        setExtraOffsets(5f, 10f, 5f, 10f)
        setTouchEnabled(false)

        isDrawHoleEnabled = false
        isRotationEnabled = false
        maxAngle = 360f
        description.isEnabled = false

        legend.apply {
          verticalAlignment = Legend.LegendVerticalAlignment.CENTER
          horizontalAlignment = Legend.LegendHorizontalAlignment.RIGHT
          orientation = Legend.LegendOrientation.VERTICAL
          setDrawInside(false)

          typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
          textColor = PIE_CHART_LEGEND_COLOR_HEX.toColorInt()
          textSize = 16f

          form = Legend.LegendForm.SQUARE
          formSize = 12f
          xEntrySpace = 10f
          yEntrySpace = 8f
        }
      }

      val dataSet = PieDataSet(entries, "").apply {
        this.colors = colors
        sliceSpace = 0f

        valueTextColor = Color.WHITE
        valueTextSize = 16f
        valueTypeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      }

      pieChart.data = PieData(dataSet).apply {
        setValueFormatter(PercentThresholdFormatter())
      }

      val widthSpec = MeasureSpec.makeMeasureSpec(config.width, MeasureSpec.EXACTLY)
      val heightSpec = MeasureSpec.makeMeasureSpec(config.height, MeasureSpec.EXACTLY)

      pieChart.measure(widthSpec, heightSpec)
      pieChart.layout(0, 0, config.width, config.height)
      pieChart.notifyDataSetChanged()
      pieChart.invalidate()

      pieChart.getChartBitmap()
    }

  private fun saveBitmapToCache(bitmap: Bitmap, config: ChartRenderConfig): File {
    val compressionFormat = resolveCompressionFormat(config.format)
    val extension = resolveFileExtension(compressionFormat)
    val outputDir = getOutputDirectory()
    val outputFile = File(outputDir, "${config.id}.$extension")

    if (outputFile.exists() && !outputFile.delete()) {
      throw ChartForgeException(
        code = "io_error",
        message = "Failed to replace existing chart file: ${outputFile.absolutePath}",
      )
    }

    FileOutputStream(outputFile).use { outputStream ->
      val success = bitmap.compress(compressionFormat, config.quality, outputStream)

      if (!success) {
        throw ChartForgeException(
          code = "encode_failed",
          message = "Failed to encode chart bitmap as ${config.format}",
        )
      }
    }

    return outputFile
  }

  private fun resolveOutputUri(file: File, uriType: String): String {
    return when (uriType.lowercase(Locale.US)) {
      "file" -> Uri.fromFile(file).toString()
      "content" -> {
        val authority = reactApplicationContext.packageName + FILE_PROVIDER_AUTHORITY_SUFFIX

        FileProvider
          .getUriForFile(reactApplicationContext, authority, file)
          .toString()
      }
      else -> throw ChartForgeException(
        code = "bad_input",
        message = "Unsupported uriType: $uriType",
      )
    }
  }

  private fun parseChartConfig(config: ReadableMap): ChartRenderConfig {
    val id = readRequiredString(config, "id")
    val width = readRequiredPositiveInt(config, "width")
    val height = readRequiredPositiveInt(config, "height")
    val data = readRequiredDataPoints(config)
    val format = readOptionalString(config, "format", DEFAULT_IMAGE_FORMAT)
      .uppercase(Locale.US)
    val quality = readOptionalInt(config, "quality", DEFAULT_IMAGE_QUALITY)
    val uriType = readOptionalString(config, "uriType", DEFAULT_URI_TYPE)
      .lowercase(Locale.US)

    validateFileId(id)
    validateImageFormat(format)
    validateQuality(quality)
    validateUriType(uriType)

    return ChartRenderConfig(
      id = id,
      width = width,
      height = height,
      data = data,
      format = format,
      quality = quality,
      uriType = uriType,
    )
  }

  private fun readRequiredDataPoints(config: ReadableMap): List<ChartDataPoint> {
    if (!config.hasKey("data") || config.isNull("data")) {
      throw ChartForgeException("bad_input", "data is required")
    }

    val dataArray = config.getArray("data")
      ?: throw ChartForgeException("bad_input", "data must be an array")

    if (dataArray.size() == 0) {
      throw ChartForgeException("bad_input", "data must contain at least one item")
    }

    return parseDataArray(dataArray)
  }

  private fun parseDataArray(dataArray: ReadableArray): List<ChartDataPoint> {
    val items = ArrayList<ChartDataPoint>(dataArray.size())

    for (index in 0 until dataArray.size()) {
      val item = dataArray.getMap(index)
        ?: throw ChartForgeException("bad_input", "data[$index] must be an object")

      val value = readRequiredPositiveDouble(item, "value", "data[$index].value")
      val label = readRequiredString(item, "label", "data[$index].label")
      val color = readRequiredString(item, "color", "data[$index].color")

      if (label.isBlank()) {
        throw ChartForgeException("bad_input", "data[$index].label must not be blank")
      }

      parseColorOrThrow(color)

      items.add(
        ChartDataPoint(
          value = value,
          label = label,
          color = color,
        )
      )
    }

    return items
  }

  private fun readRequiredString(map: ReadableMap, key: String, displayName: String = key): String {
    if (!map.hasKey(key) || map.isNull(key)) {
      throw ChartForgeException("bad_input", "$displayName is required")
    }

    return map.getString(key)
      ?: throw ChartForgeException("bad_input", "$displayName must be a string")
  }

  private fun readOptionalString(map: ReadableMap, key: String, defaultValue: String): String {
    if (!map.hasKey(key) || map.isNull(key)) {
      return defaultValue
    }

    return map.getString(key)
      ?: throw ChartForgeException("bad_input", "$key must be a string")
  }

  private fun readRequiredPositiveInt(map: ReadableMap, key: String): Int {
    if (!map.hasKey(key) || map.isNull(key)) {
      throw ChartForgeException("bad_input", "$key is required")
    }

    val value = map.getDouble(key)

    if (!value.isFinite() || value <= 0 || value % 1.0 != 0.0) {
      throw ChartForgeException("bad_input", "$key must be a positive integer")
    }

    return value.toInt()
  }

  private fun readRequiredPositiveDouble(map: ReadableMap, key: String, displayName: String = key): Double {
    if (!map.hasKey(key) || map.isNull(key)) {
      throw ChartForgeException("bad_input", "$displayName is required")
    }

    val value = map.getDouble(key)

    if (!value.isFinite() || value <= 0.0) {
      throw ChartForgeException("bad_input", "$displayName must be a positive finite number")
    }

    return value
  }

  private fun readOptionalInt(map: ReadableMap, key: String, defaultValue: Int): Int {
    if (!map.hasKey(key) || map.isNull(key)) {
      return defaultValue
    }

    val value = map.getDouble(key)

    if (!value.isFinite() || value % 1.0 != 0.0) {
      throw ChartForgeException("bad_input", "$key must be an integer")
    }

    return value.toInt()
  }

  private fun validateFileId(id: String) {
    if (id.isBlank()) {
      throw ChartForgeException("bad_input", "id must not be blank")
    }

    if (!id.matches(Regex("^[a-zA-Z0-9_-]+$"))) {
      throw ChartForgeException(
        code = "bad_input",
        message = "id may only contain letters, numbers, hyphens, and underscores",
      )
    }
  }

  private fun validateImageFormat(format: String) {
    if (format != "WEBP" && format != "PNG" && format != "JPEG") {
      throw ChartForgeException(
        code = "bad_input",
        message = "Unsupported image format: $format",
      )
    }
  }

  private fun validateQuality(quality: Int) {
    if (quality !in 0..100) {
      throw ChartForgeException(
        code = "bad_input",
        message = "quality must be between 0 and 100",
      )
    }
  }

  private fun validateUriType(uriType: String) {
    if (uriType != "content" && uriType != "file") {
      throw ChartForgeException(
        code = "bad_input",
        message = "Unsupported uriType: $uriType",
      )
    }
  }

  private fun parseColorOrThrow(color: String): Int {
    return try {
      color.toColorInt()
    } catch (error: IllegalArgumentException) {
      throw ChartForgeException(
        code = "bad_input",
        message = "Invalid color value: $color",
        cause = error,
      )
    }
  }

  private fun resolveCompressionFormat(format: String): Bitmap.CompressFormat {
    return when (format.uppercase(Locale.US)) {
      "PNG" -> Bitmap.CompressFormat.PNG
      "JPEG" -> Bitmap.CompressFormat.JPEG
      "WEBP" -> resolveWebpCompressionFormat()
      else -> throw ChartForgeException(
        code = "bad_input",
        message = "Unsupported image format: $format",
      )
    }
  }

  @Suppress("DEPRECATION")
  private fun resolveWebpCompressionFormat(): Bitmap.CompressFormat {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      Bitmap.CompressFormat.WEBP_LOSSLESS
    } else {
      Bitmap.CompressFormat.WEBP
    }
  }

  private fun resolveFileExtension(format: Bitmap.CompressFormat): String {
    return when (format) {
      Bitmap.CompressFormat.PNG -> "png"
      Bitmap.CompressFormat.JPEG -> "jpg"
      Bitmap.CompressFormat.WEBP_LOSSLESS -> "webp"
      Bitmap.CompressFormat.WEBP_LOSSY -> "webp"
      else -> "webp"
    }
  }

  private fun getOutputDirectory(): File {
    return File(reactApplicationContext.cacheDir, CACHE_DIR_NAME).also { directory ->
      if (!directory.exists() && !directory.mkdirs()) {
        throw ChartForgeException(
          code = "io_error",
          message = "Failed to create chart cache directory: ${directory.absolutePath}",
        )
      }
    }
  }

  private fun rejectPromise(promise: Promise, error: Throwable) {
    val moduleError = when (error) {
      is ChartForgeException -> error
      else -> ChartForgeException(
        code = "chart_generation_failed",
        message = error.message ?: "Chart generation failed",
        cause = error,
      )
    }

    promise.reject(moduleError.code, moduleError.message, moduleError)
  }
}
