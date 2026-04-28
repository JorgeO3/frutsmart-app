package expo.modules.nanort.module.interpreter

import java.nio.ByteBuffer

/**
 * Restricted capability exposed to borrowers during ModelManager.withInterpreter.
 * It intentionally omits lifecycle/destructive operations.
 */
interface InterpreterSession {
  fun getInputBuffer(): ByteBuffer
  fun runInference()
  fun getOutputBuffers(): Map<Int, ByteBuffer>
  fun getInputTensorShape(): IntArray?
  fun getOutputTensorShapes(): List<IntArray>
}
