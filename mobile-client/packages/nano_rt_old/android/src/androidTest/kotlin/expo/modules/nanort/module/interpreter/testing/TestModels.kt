package expo.modules.nanort.module.interpreter.testing

import expo.modules.nanort.module.interpreter.ModelId

object TestModels {
  val IC: ModelId = ModelId.IC
  val BS: ModelId = ModelId.BS
  val RS: ModelId = ModelId.RS

  val ALL: List<ModelId> = listOf(ModelId.IC, ModelId.BS, ModelId.RS)
  val ROTATION: List<ModelId> = listOf(ModelId.IC, ModelId.RS, ModelId.BS)
}
