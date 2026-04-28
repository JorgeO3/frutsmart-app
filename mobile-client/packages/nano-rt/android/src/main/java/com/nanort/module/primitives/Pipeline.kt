package com.nanort.module.primitives

/**
 * Contrato base para cualquier pipeline. Es un transformador de datos genérico
 * que toma un Input 'I' y produce un Output 'O' de forma asíncrona.
 */
fun interface Pipeline<I : Any, O : Any> {
  suspend  fun execute(input: I): O
}

/**
 * Función de extensión 'infix' que permite componer dos pipelines de forma fluida y segura.
 * Crea un nuevo pipeline que representa la secuencia de los dos originales.
 * Ejemplo: val workflow = pipelineA then pipelineB
 */
infix fun <A : Any, B : Any, C : Any> Pipeline<A, B>.then(next: Pipeline<B, C>): Pipeline<A, C> {
  return Pipeline { input ->
    val intermediateResult = this@then.execute(input)
    next.execute(intermediateResult)
  }
}