package com.nanort.module.workflows.shared.classification

import com.nanort.core.logD
import com.nanort.module.primitives.Resettable
import org.opencv.core.Mat
import org.opencv.core.Scalar
import java.io.Closeable


class ClassificationWorkspace : Resettable, Closeable {
    val sourceMat = Mat()
    val resizedMat = Mat()
    val rgbMat = Mat()

    val rgb = Mat()
    val rgba = Mat()
    val rgbF32 = Mat()

    var floatArray: FloatArray? = null

    private val managedMats: List<Mat> = listOf(
        sourceMat, resizedMat, rgbMat,
        rgb, rgba, rgbF32
    )

    override fun reset() {
        logD { "Resetting all workspace Mats to zero." }
        managedMats.forEach { mat ->
            if (!mat.empty()) {
                mat.setTo(Scalar(0.0))
            }
        }
    }

    override fun close() {
        managedMats.forEach { it.release() }
        floatArray = null
    }
}