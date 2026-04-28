# Nano RT Fase 8: GPU/delegates/quarantine correctness

Fuente principal: `docs/migration_plan_nano_rt.md`

## Objetivo

Cerrar Fase 8 con pruebas explicitas que validen:

- decision GPU por `flag + blacklist + compat + quarantine`
- persistencia durable de quarantine por `Build.FINGERPRINT + ModelId`
- fallback a CPU cuando GPU falla
- robustez de delegates pinned

## Matriz de pruebas

- `GpuPolicyAndroidTest`
  - gpu disabled -> false
  - quarantine -> false
  - unsupported compat -> false
  - blacklist signature -> false
  - supported + not quarantined -> true

- `GpuQuarantineStoreAndroidTest`
  - persist/clear por modelo
  - reason guardado
  - claves incluyen modelo/fingerprint

- `QuarantineAtomicityAndroidTest`
  - escritura durable via `commit` (no `apply`)

- `QuarantineDurabilityAndroidTest`
  - persistencia en restart simulado

- `DelegateFallbackToCpuAndroidTest`
  - falla de creación de delegate GPU -> quarantine + fallback CPU

- `QuarantinedModelSkipsGpuAttemptAndroidTest`
  - modelo en quarantine no intenta adquirir GPU
  - ejecución sigue por CPU

## Criterio de cierre

Fase 8 se cierra cuando:

1. La suite focal de Fase 8 está en verde.
2. La suite completa de `:nano-rt:connectedDebugAndroidTest` permanece en verde.
3. El checklist marca Fase 8 como `[x]` con evidencia de comandos.

## Evidencia de implementacion (esta iteracion)

- `./gradlew :nano-rt:compileDebugAndroidTestKotlin` -> PASS
- `./gradlew :nano-rt:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.nanort.module.interpreter.GpuPolicyAndroidTest,expo.modules.nanort.module.interpreter.GpuQuarantineStoreAndroidTest,expo.modules.nanort.module.interpreter.persistence.QuarantineAtomicityAndroidTest,expo.modules.nanort.module.interpreter.integration.QuarantineDurabilityAndroidTest,expo.modules.nanort.module.interpreter.integration.DelegateFallbackToCpuAndroidTest,expo.modules.nanort.module.interpreter.integration.QuarantinedModelSkipsGpuAttemptAndroidTest` -> PASS (10 tests)
- `./gradlew :nano-rt:connectedDebugAndroidTest` -> PASS (47 tests)

Resultado: la politica GPU/quarantine/delegate y fallback CPU quedan cubiertos con pruebas explicitas y sin regresion en la suite completa del modulo.
