# Nano RT Fase 1: mapa file-by-file de migracion

Fuente principal: `docs/migration_plan_nano_rt.md`

## Reemplazar

- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/interpreter/ModelManager.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/interpreter/NanoRTInterpreter.kt`

## Añadir

- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/interpreter/InterpreterSession.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/interpreter/internal/InterpreterActor.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/interpreter/internal/InterpreterProtocol.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/interpreter/internal/DelegatePool.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/interpreter/internal/GpuPolicy.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/interpreter/internal/GpuQuarantineStore.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/interpreter/internal/InferenceFlags.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/interpreter/internal/ModelManagerDebugHooks.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/ModuleInitStateMachine.kt`

## Adaptar

- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/interpreter/InterpreterWarmer.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/workflows/shared/base/AbstractClassificationPipeline.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/workflows/shared/base/AbstractSegmentationPipeline.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/NanoRTModule.kt`

## Mantener

- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/interpreter/WorkspaceManager.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/workflows/shared/classification/ClassificationWorkspace.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/workflows/shared/segmentation/SegmentationWorkspace.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/workflows/shared/classification/ClassificationProcessor.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/workflows/shared/segmentation/SegmentationProcessor.kt`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/workflows/plant/**`
- `modules/nano-rt/android/src/main/java/expo/modules/nanort/module/workflows/field/**`
- `modules/nano-rt/src/NanoRTModule.ts`
- `modules/nano-rt/src/useNanoRT.ts`
- `modules/nano-rt/src/NanoRTClassifier.ts`
- `src/hooks/useRootBootstrap.ts`

## Eliminar despues (si aplica)

- Debug seams o utilidades temporales solo si dejan de ser necesarias tras cierre de fase 15.
- No se elimina ningun contrato JS/Expo.

## Estado de cierre

Fase 1 queda cerrada con este mapa definitivo como referencia de que se migro, que se adapto y que se preservo sin ruptura de API.
