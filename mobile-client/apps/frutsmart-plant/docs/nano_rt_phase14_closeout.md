# Nano RT Plan: Puntos clave y cierre de Fase 14

Fuente principal: `docs/migration_plan_nano_rt.md`

## Puntos importantes del plan (resumen ejecutivo)

1. **No romper contratos Expo/JS**
   - Mantener `NanoRTModule.ts`, `useNanoRT`, `useNanoRTReady`, `NanoRTClassifier` y bootstrap del host app.
   - Mantener eventos `onReady` y `onInitError`.

2. **Runtime endurecido dentro de `modules/nano-rt`**
   - Actor model, lifecycle robusto, startup/shutdown serializados y semantica fatal/recoverable.
   - Correctness de delegates/GPU con quarantine y fallback CPU.

3. **Pipelines y workspaces compatibles con `InterpreterSession`**
   - Pipelines solo usan API lease-bound.
   - Workspaces no deben retener buffers del interprete ni usarlos fuera del lease.

4. **Validacion obligatoria de buffers/performance**
   - No basta correctness; se requiere evidencia de latencia/memoria/threads.
   - Si hay regresion severa (especialmente segmentacion), abrir subfase de optimizacion.

5. **Soak manual propio del modulo Expo**
   - Perfiles `mixed`, `rotation`, `shutdown`, `workflow_classification`, `workflow_segmentation`.
   - Reportes con estado PASS/FAIL y metricas de actor/colas.

6. **Integracion host app real (Fase 14)**
   - Validar boot, readiness, eventos y ejecucion real de workflows de clasificacion.
   - Verificar payloads JS, URIs, tiempos razonables y estabilidad en sesiones de desarrollo.

## Que falta para cerrar Fase 14

1. **Matriz E2E en host app completada y evidenciada**
   - `useNanoRTReady` en estado listo.
   - `initializeModule()` sin error.
   - Evento `onReady` observado; `onInitError` no emitido en ruta sana.

2. **Ejecucion de los 4 workflows via superficie host app o flujo equivalente validado**
   - `classifyPlantExternal(...)`
   - `classifyPlantInternal(...)`
   - `classifyFieldExternal(...)`
   - `classifyFieldInternal(...)`
   - Para cada uno: confirmar estructura `{ items: [{ uri, confidences }] }` y que `uri` exista.

3. **Evidencia operativa reproducible**
   - Logs (`adb logcat`) con marcas de init/eventos.
   - Registro de tiempos por flujo (al menos muestra representativa).
   - Registro de resultado por caso (PASS/FAIL + motivo).

4. **Verificacion de estabilidad en ciclo de desarrollo**
   - Reabrir app y repetir una corrida corta.
   - Confirmar que no queda estado corrupto tras recarga/reinicio rapido.

## Estado actual para Fase 14

- Ya validado: launch/smoke de `MainActivity` y proceso vivo.
- Aun pendiente: matriz completa E2E con evidencia de los 4 workflows y criterios de salida.
