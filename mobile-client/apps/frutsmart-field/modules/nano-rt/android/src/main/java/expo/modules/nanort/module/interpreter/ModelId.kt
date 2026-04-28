package expo.modules.nanort.module.interpreter

// This enum associates a unique identifier with the model file name in the assets.
enum class ModelId(val fileName: String) {
    RS("ring_segmentation.tflite"),
    BS("bunch_segmentation.tflite"),
    SS("single_segmentation.tflite"),
    EC("external_classification.tflite"),
    IC("internal_classification.tflite")
}