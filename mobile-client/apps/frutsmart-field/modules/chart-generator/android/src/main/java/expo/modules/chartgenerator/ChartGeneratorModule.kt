package expo.modules.chartgenerator

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.util.Log
import androidx.core.content.FileProvider
import com.github.mikephil.charting.charts.PieChart
import com.github.mikephil.charting.components.Legend
import com.github.mikephil.charting.data.PieData
import com.github.mikephil.charting.data.PieDataSet
import com.github.mikephil.charting.data.PieEntry
import com.github.mikephil.charting.formatter.ValueFormatter
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.text.DecimalFormat
import androidx.core.graphics.toColorInt

// Constants for better maintainability and readability
private const val LOG_TAG = "ExpoChartGenerator"
private const val DEFAULT_IMAGE_QUALITY = 100
private const val DEFAULT_PERCENT_THRESHOLD = 7.0f
private const val DEFAULT_IMAGE_FORMAT = "WEBP"
private const val PIE_CHART_LEGEND_COLOR_HEX = "#E84C16"

/**
 * Represents a single slice of the pie chart data.
 * @param value The numerical value of the slice.
 * @param label The label associated with the slice.
 * @param color The hexadecimal color string for the slice (e.g., "#FF0000").
 */
data class PieChartSlice(
  @Field val value: Double,
  @Field val label: String,
  @Field val color: String
) : Record

/**
 * Configuration for generating a pie chart.
 * @param id A unique identifier for the generated chart image file.
 * @param width The desired width of the chart in pixels.
 * @param height The desired height of the chart in pixels.
 * @param data A list of [PieChartSlice] objects representing the chart's data.
 * @param format The output image format (e.g., "WEBP", "PNG", "JPEG"). Defaults to "WEBP".
 * @param quality The compression quality for the output image (0-100). Defaults to 100.
 */
data class PieChartConfig(
  @Field val id: String,
  @Field val width: Int,
  @Field val height: Int,
  @Field val data: List<PieChartSlice>,
  @Field val format: String? = DEFAULT_IMAGE_FORMAT,
  @Field val quality: Int? = DEFAULT_IMAGE_QUALITY,
) : Record

/**
 * Custom formatter for pie chart labels to display percentages.
 * Percentages below a certain threshold will not be displayed to prevent clutter.
 * @param threshold The minimum percentage value for a label to be displayed.
 */
class CustomPercentFormatter(private val threshold: Float = DEFAULT_PERCENT_THRESHOLD) :
  ValueFormatter() {
  private val format = DecimalFormat("###,###,##0.0")

  override fun getPieLabel(value: Float, pieEntry: PieEntry?): String {
    // Only display the percentage label if it meets or exceeds the threshold
    return if (value < threshold) "" else "${format.format(value)} %"
  }
}

/**
 * Expo module for generating pie charts and returning their file URIs.
 * This module leverages the MPAndroidChart library to render charts and
 * handles image compression and file storage.
 */
class ChartGeneratorModule : Module() {
  override fun definition() = ModuleDefinition {
    // Define the module's name as it will be exposed to JavaScript
    Name("ChartGenerator")

    /**
     * Asynchronously generates a pie chart image based on the provided configuration.
     * The process involves UI rendering on the main thread and file I/O on a background thread.
     * @param config The [PieChartConfig] object containing all chart parameters.
     * @return A String representing the URI of the generated chart image (either "file://" or "content://").
     * @throws Exceptions.ReactContextLost If the React Native context is not available.
     */
    AsyncFunction("generatePieChart") Coroutine { config: PieChartConfig ->
      // Ensure the React Native context is available for UI operations and file paths.
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()

      // STEP 1: UI Work on the Main Thread
      // Create and render the PieChart to a Bitmap. This part interacts with the Android UI Toolkit
      // and must be executed on the main thread to prevent UI-related errors.
      val chartBitmap: Bitmap = withContext(Dispatchers.Main) {
        // Map chart data from config to MPAndroidChart's PieEntry format
        val entries = config.data.map { PieEntry(it.value.toFloat(), it.label) }
        val colors = config.data.map { it.color.toColorInt() }

        // Initialize and configure the PieChart
        val pieChart = PieChart(context).apply {
          // Set the chart's dimensions for rendering
          layout(0, 0, config.width, config.height)
          setBackgroundColor(Color.WHITE)
          isDrawHoleEnabled = false // No hole in the center
          description.isEnabled = false // Disable default chart description
          setDrawEntryLabels(false) // Hide labels on the slices themselves
          setUsePercentValues(true) // Display values as percentages
          setExtraOffsets(5f, 10f, 5f, 10f) // Adjust chart offsets for better layout
          maxAngle = 360f
          setEntryLabelColor(Color.BLACK)

          // Configure the chart legend
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

        // Create a DataSet from the entries and apply styling
        val dataSet = PieDataSet(entries, "").apply {
          this.colors = colors // Apply colors to slices
          sliceSpace = 0f // No space between slices
          valueTextColor = Color.WHITE
          valueTextSize = 16f
          valueTypeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }

        // Create the PieData object and apply the custom value formatter
        val pieData = PieData(dataSet).apply {
          setValueFormatter(CustomPercentFormatter(threshold = DEFAULT_PERCENT_THRESHOLD))
        }

        // Set the data to the chart and trigger a redraw
        pieChart.data = pieData
        pieChart.invalidate() // Refresh the chart to apply all changes

        // Return the rendered chart as a Bitmap
        return@withContext pieChart.getChartBitmap()
      }

      // STEP 2: I/O and CPU Intensive Work on a Background Thread
      // Compress and save the generated Bitmap to a file. This is a potentially slow
      // operation that should not block the UI thread.
      val outputFile: File = withContext(Dispatchers.Default) {
        // Determine the correct compression format based on the requested format and Android version
        val compressionFormat = when (config.format?.uppercase()) {
          "PNG" -> Bitmap.CompressFormat.PNG
          "JPEG" -> Bitmap.CompressFormat.JPEG
          else -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Bitmap.CompressFormat.WEBP_LOSSLESS
          } else {
            @Suppress("DEPRECATION")
            Bitmap.CompressFormat.WEBP
          }
        }
        // Determine file extension based on the chosen format
        val fileExtension = compressionFormat.name.lowercase().replace("jpeg", "jpg")
        val imageQuality = config.quality ?: DEFAULT_IMAGE_QUALITY

        // Create a temporary file in the app's cache directory
        val file = File(context.cacheDir, "${config.id}.$fileExtension")

        // Write the compressed bitmap to the file
        FileOutputStream(file).use { out ->
          chartBitmap.compress(compressionFormat, imageQuality, out)
        }

        // Important: Recycle the bitmap to free up memory immediately after saving.
        chartBitmap.recycle()

        // Return the file object for the saved image
        return@withContext file
      }

      // STEP 3: Final Logic and URI Generation
      return@Coroutine "file://${outputFile.absolutePath}"
    }
  }
}
