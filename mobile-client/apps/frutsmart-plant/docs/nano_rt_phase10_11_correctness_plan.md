# Nano RT Fase 10/11: plan de cierre de correctness

Fuente principal: `docs/migration_plan_nano_rt.md`

## Objetivo

Cerrar Fase 10 y Fase 11 en conjunto con cobertura explicita de runtime safety + workflow/workspace correctness, sin dejar categorias del plan sin prueba dedicada.

## Fase 10: matriz explicita (runtime critico)

### Categorias obligatorias

- Startup/lifecycle
  - recovery after startup failure
  - shutdown during startup race
- Fatal/recoverable
  - recoverable fatal restart
  - sticky fatal termination
- Borrower liveness
  - shutdown with blocked borrower
  - release with blocked borrower
  - borrower suspension policy
- Ownership
  - input buffer lease escape
  - foreign thread buffer use
  - output buffer lease escape
  - output buffer isolation
- Delegate pool
  - capacity bound
  - close all pinned
  - concurrency
  - LRU order
  - token uniqueness
- Leaks
  - actor child job leak
  - thread leak
- Pressure
  - long running queue pressure
- Real engine
  - real engine shutdown stress

### Pruebas que deben existir en `modules/nano-rt`

- `.../interpreter/actor/ActorStartupFailureRecoveryAndroidTest.kt`
- `.../interpreter/actor/ShutdownDuringStartupRaceAndroidTest.kt`
- `.../interpreter/actor/RecoverableFatalRestartAndroidTest.kt`
- `.../interpreter/actor/StickyFatalTerminationAndroidTest.kt`
- `.../interpreter/actor/ShutdownWithBlockedBorrowerAndroidTest.kt`
- `.../interpreter/actor/ReleaseWithBlockedBorrowerAndroidTest.kt`
- `.../interpreter/actor/BorrowerSuspensionPolicyAndroidTest.kt`
- `.../interpreter/safety/InputBufferLeaseEscapeAndroidTest.kt`
- `.../interpreter/safety/ForeignThreadBufferUseAndroidTest.kt`
- `.../interpreter/safety/OutputBufferLeaseEscapeAndroidTest.kt`
- `.../interpreter/safety/OutputBufferIsolationAndroidTest.kt`
- `.../interpreter/resources/DelegatePoolCapacityBoundAndroidTest.kt`
- `.../interpreter/resources/DelegatePoolCloseAllPinnedAndroidTest.kt`
- `.../interpreter/resources/DelegatePoolConcurrencyAndroidTest.kt`
- `.../interpreter/resources/DelegatePoolLruOrderAndroidTest.kt`
- `.../interpreter/resources/DelegatePoolTokenKeyUniquenessAndroidTest.kt`
- `.../interpreter/actor/ActorChildJobLeakAndroidTest.kt`
- `.../interpreter/actor/FastRefreshThreadLeakAndroidTest.kt`
- `.../interpreter/actor/LongRunningQueuePressureAndroidTest.kt`
- `.../interpreter/integration/RealEngineShutdownStressAndroidTest.kt`

## Fase 11: matriz explicita (workflow/workspace)

### Categorias obligatorias

- `AbstractClassificationPipeline` sobre runtime nuevo
- `AbstractSegmentationPipeline` sobre runtime nuevo
- classification workspace reuse correcto
- segmentation workspace reuse correcto
- no aliasing danino entre workspace y buffers actor/session
- regresion de `ClassificationProcessor.preprocess(...)`
- regresion de `SegmentationProcessor.preprocess/postprocess(...)`
- lectura snapshot/read-only de outputs
- validacion minima de resultados:
  - shape esperada
  - no crashes
  - no leaks visibles

### Pruebas objetivo en `modules/nano-rt`

- `.../workflows/WorkflowWorkspaceCompatibilityAndroidTest.kt`
- `.../workflows/ClassificationProcessorRegressionAndroidTest.kt`
- `.../workflows/SegmentationProcessorRegressionAndroidTest.kt`
- `.../workflows/WorkflowOutputSnapshotAndroidTest.kt`
- `.../workflows/ClassificationWorkspaceAliasingAndroidTest.kt`
- `.../workflows/WorkflowShapeContractAndroidTest.kt`

## Orden de implementacion recomendado

1. Completar faltantes Fase 10 (runtime critico).
2. Completar faltantes Fase 11 (workflow/workspace correctness).
3. Ejecutar suite focal Fase 10/11.
4. Ejecutar suite completa `:nano-rt:connectedDebugAndroidTest`.
5. Actualizar checklist con evidencia y pasar Fase 10/11 a `[x]`.

## Gate de ejecucion

Desde `FrutSmartP/android`:

```bash
./gradlew :nano-rt:compileDebugAndroidTestKotlin
./gradlew :nano-rt:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=<lista_fase_10_11>
./gradlew :nano-rt:connectedDebugAndroidTest
```

## Criterio de cierre conjunto

Se marca Fase 10 y 11 como cerradas solo si:

1. Cada bullet del plan tiene al menos una prueba explicita en `modules/nano-rt/android/src/androidTest`.
2. Suite focal Fase 10/11 en verde.
3. Suite completa de `nano-rt` en verde.
4. No hay `fatalTerminationCount`, `pendingReplies` o leaks de thread/job fuera de umbral en pruebas de stress.

## Evidencia de implementacion (esta iteracion)

- `./gradlew :nano-rt:compileDebugAndroidTestKotlin` -> PASS
- `./gradlew :nano-rt:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.nanort.module.interpreter.safety.OutputBufferLeaseEscapeAndroidTest,expo.modules.nanort.module.interpreter.resources.DelegatePoolCapacityBoundAndroidTest,expo.modules.nanort.module.interpreter.resources.DelegatePoolConcurrencyAndroidTest,expo.modules.nanort.module.interpreter.resources.DelegatePoolLruOrderAndroidTest,expo.modules.nanort.module.interpreter.resources.DelegatePoolTokenKeyUniquenessAndroidTest,expo.modules.nanort.module.interpreter.actor.FastRefreshThreadLeakAndroidTest,expo.modules.nanort.module.interpreter.integration.RealEngineShutdownStressAndroidTest,expo.modules.nanort.module.workflows.SegmentationProcessorRegressionAndroidTest,expo.modules.nanort.module.workflows.WorkflowOutputSnapshotAndroidTest,expo.modules.nanort.module.workflows.ClassificationWorkspaceAliasingAndroidTest,expo.modules.nanort.module.workflows.WorkflowShapeContractAndroidTest` -> PASS (12 tests)

Con esta evidencia, Fase 10 y Fase 11 quedan con cobertura explicita para todos los bullets obligatorios del plan.
