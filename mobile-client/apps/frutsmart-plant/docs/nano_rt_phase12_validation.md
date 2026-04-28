# Nano RT Fase 12: validacion de rendimiento y memoria

Fuente principal: `docs/migration_plan_nano_rt.md` (Fase 12)  
Dependencias directas: Fase 6 (buffers/workspaces), Fase 10 (runtime correctness), Fase 11 (workflow/workspace correctness).

## Objetivo de cierre

Cerrar Fase 12 con evidencia de que la migracion no solo mantiene correctness, sino que tambien mantiene rendimiento/memoria sin regresion severa.

La salida obligatoria de esta fase es una decision objetiva:

- `buffer_strategy_acceptable`
- o `buffer_strategy_requires_optimization_subphase`

## Cobertura implementada para Fase 12

### Pruebas de performance y estabilidad

- `modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/module/workflows/WorkflowPerformanceRegressionAndroidTest.kt`
  - mide clasificacion plant/field y segmentacion plant/field
  - incluye warmup previo
  - incluye ciclos de shutdown/restart
  - valida p95, delta de threads, child jobs, heap growth
  - valida no fatal terminations y mailbox/pending replies drenados

- `modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/module/workflows/WarmupBenchmarkAndroidTest.kt`
  - benchmark dedicado de warmup
  - verifica estabilidad post-warmup (sin fatal/pending/mailbox residual)
  - valida que los 5 modelos sean usables tras warmup

- `modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/module/workflows/WorkflowRestartMatrixAndroidTest.kt`
  - matriz de restart sobre familias clave:
    - plant external/internal classification
    - field external/internal classification
    - plant/field segmentation
  - valida que shutdown/restart no rompa ejecucion ni estado interno

- `modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/module/workflows/DirectMemoryObservationAndroidTest.kt`
  - observacion de crecimiento de heap manejado y native heap
  - valida estabilidad de actor (fatal/pending/mailbox/threads)

### Pruebas de correctness de soporte necesarias para Fase 12

- `modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/module/workflows/ClassificationProcessorRegressionAndroidTest.kt`
  - valida preprocess de clasificacion (rango [0,1], valores finitos)
  - valida reutilizacion de `floatArray` en workspace
  - valida rechazo de capacidad de buffer invalida

Estas pruebas se incluyen porque una conclusion de performance sin correctness de preprocess/workspace no es confiable.

## Ejecucion recomendada (gate local de Fase 12)

Desde `FrutSmartP/android`:

1. Compilar tests:

```bash
./gradlew :nano-rt:compileDebugAndroidTestKotlin
```

2. Ejecutar bateria focal de Fase 12:

```bash
./gradlew :nano-rt:connectedDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.nanort.module.workflows.WorkflowPerformanceRegressionAndroidTest,expo.modules.nanort.module.workflows.WarmupBenchmarkAndroidTest,expo.modules.nanort.module.workflows.WorkflowRestartMatrixAndroidTest,expo.modules.nanort.module.workflows.DirectMemoryObservationAndroidTest,expo.modules.nanort.module.workflows.ClassificationProcessorRegressionAndroidTest
```

3. Ejecutar soak de apoyo (recomendado para evidencia complementaria):

```bash
./gradlew :nano-rt:soakRun -Psoak.appId=com.anonymous.FrutSmartP -Psoak.profile=mixed -Psoak.durationMinutes=5
./gradlew :nano-rt:soakRun -Psoak.appId=com.anonymous.FrutSmartP -Psoak.profile=workflow_classification -Psoak.durationMinutes=5
./gradlew :nano-rt:soakRun -Psoak.appId=com.anonymous.FrutSmartP -Psoak.profile=workflow_segmentation -Psoak.durationMinutes=5
./gradlew :nano-rt:soakRun -Psoak.appId=com.anonymous.FrutSmartP -Psoak.profile=shutdown -Psoak.durationMinutes=5
```

## Umbrales operativos vigentes

Minimos para no abrir subfase de optimizacion:

- `classification p95 <= 600ms`
- `segmentation p95 <= 1500ms`
- `threadDelta <= 1`
- `childJobDelta <= 2` (o umbral equivalente del test/soak)
- `fatalTerminationCount == 0`
- `pendingReplies == 0`
- `approxMailboxDepth == 0` al final
- `heap/native growth` sin crecimiento severo sostenido

## Evidencia ejecutada en esta iteracion

- `./gradlew :nano-rt:compileDebugAndroidTestKotlin` -> PASS
- `./gradlew :nano-rt:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=...` -> PASS (5 tests)
- `./gradlew :nano-rt:soakRun -Psoak.appId=com.anonymous.FrutSmartP -Psoak.profile=mixed -Psoak.durationMinutes=5` -> PASS
- `./gradlew :nano-rt:soakRun -Psoak.appId=com.anonymous.FrutSmartP -Psoak.profile=workflow_classification -Psoak.durationMinutes=5` -> PASS
- `./gradlew :nano-rt:soakRun -Psoak.appId=com.anonymous.FrutSmartP -Psoak.profile=workflow_segmentation -Psoak.durationMinutes=5` -> PASS
- `./gradlew :nano-rt:soakRun -Psoak.appId=com.anonymous.FrutSmartP -Psoak.profile=shutdown -Psoak.durationMinutes=5` -> PASS

## Baseline vs actual (comparativo formal)

Baseline usada: corridas previas de 1 minuto registradas durante la migracion (mismo appId y perfiles equivalentes).  
Actual: corridas de 5 minutos de esta iteracion.

| Perfil | Baseline 1m (iter/1m) | Actual 5m (iter/5m) | Throughput baseline (iter/min) | Throughput actual (iter/min) | Delta throughput |
|---|---:|---:|---:|---:|---:|
| mixed | 1088 | 5328 | 1088.0 | 1065.6 | -2.1% |
| workflow_segmentation | 437 | 2173 | 437.0 | 434.6 | -0.5% |
| workflow_classification | n/a | 20832 | n/a | 4166.4 | baseline nuevo |
| shutdown | n/a | 20151 | n/a | 4030.2 | baseline nuevo |

Notas:
- En los 4 perfiles de 5 minutos: `status=PASS`, `errors=0`, `fatalTerminationCount=0`, `pendingReplies=0`, `childJobCount=1`, `finalNanoRtThreads=1`.
- `queueWait p99` y `hold p99` se mantuvieron muy por debajo de los umbrales de soak (`5000ms`).
- No se observa regresion severa en los perfiles con baseline historico (`mixed`, `workflow_segmentation`).

## Metadata de referencia

- Device: `emulator-5554`
- App id: `com.anonymous.FrutSmartP`
- Build variant: `debug`
- Fecha validacion: `2026-03-26`
- Soak sessions:
  - mixed: `soak_20260326_150911`
  - workflow_classification: `soak_20260326_151436`
  - workflow_segmentation: `soak_20260326_152003`
  - shutdown: `soak_20260326_152533`

## Criterio de cierre de Fase 12

Fase 12 se marca cerrada cuando se cumpla todo:

1. Bateria focal de Fase 12 en verde.
2. Soak de apoyo en verde para perfiles de workflow y shutdown.
3. Tabla baseline vs actual documentada.
4. Decision formal documentada:
   - `buffer_strategy_acceptable`
   - o `buffer_strategy_requires_optimization_subphase`.

Si la segmentacion presenta regresion sensible o memoria native con crecimiento no acotado, no se cierra Fase 12 y se abre subfase de optimizacion de estrategia de outputs lease-bound.

## Decision formal de Fase 12

`buffer_strategy_acceptable`

Justificacion:
- Correctness de soporte cubierta con pruebas nuevas (warmup/restart/preprocess/memoria).
- Bateria focal de Fase 12 en verde.
- Soak de apoyo de 5 minutos en verde para los 4 perfiles definidos.
- Sin senales de regresion severa en throughput para perfiles con baseline historico.
- Sin senales de inestabilidad runtime (fatal/pending/mailbox/thread/job).

Conclusion: se cierra Fase 12 sin abrir subfase de optimizacion inmediata. Cualquier optimizacion futura de copias lease-bound queda como mejora incremental, no como bloqueo de migracion.
