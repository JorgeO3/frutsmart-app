# Nano RT Fase 6/7: cierre de buffers y lifecycle/readiness

Fuente principal: `docs/migration_plan_nano_rt.md`

## Fase 6 — Workspaces y estrategia de buffers

### Decision de cierre

`copias_actuales_aceptables`

### Evidencia usada para cierre

- Correctness de workspaces/pipelines:
  - `modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/module/workflows/WorkflowWorkspaceCompatibilityAndroidTest.kt`
  - `modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/module/workflows/ClassificationWorkspaceAliasingAndroidTest.kt`
  - `modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/module/workflows/WorkflowOutputSnapshotAndroidTest.kt`
  - `modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/module/workflows/ClassificationProcessorRegressionAndroidTest.kt`
  - `modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/module/workflows/SegmentationProcessorRegressionAndroidTest.kt`
- Rendimiento/memoria baseline-vs-actual:
  - `docs/nano_rt_phase12_validation.md`
  - `modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/module/workflows/WorkflowPerformanceRegressionAndroidTest.kt`
  - `modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/module/workflows/DirectMemoryObservationAndroidTest.kt`

## Fase 7 — Lifecycle Expo y readiness

### Politica de readiness implementada

- `isReady` significa readiness exitoso, no solo completion de deferred.
- Warmup ahora es estricto para init:
  - si falla cualquier modelo obligatorio, init falla.
  - se emite `onInitError`.
  - `initialize()` y `initializeModule()` reflejan ese fallo.
- Retry de warmup:
  - si hubo fallo previo y el modulo ya estaba bootstrappeado, `initializeModule()` resetea estado fallido y reintenta warmup.

### Cambios clave

- `modules/nano-rt/android/src/main/java/expo/modules/nanort/ModuleInitStateMachine.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/NanoRTModule.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/interpreter/InterpreterWarmer.kt`

### Pruebas nuevas de soporte

- `modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/ModuleInitStateMachineAndroidTest.kt`
- `modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/module/interpreter/InterpreterWarmerPolicyAndroidTest.kt`

### Estado de cierre

Fase 7 queda en estado `[-]` hasta completar la evidencia host app de readiness/eventos en Fase 14:

- `useNanoRTReady`
- `initializeModule()`
- `onReady` / `onInitError`
- validacion E2E de 4 workflows en host app
