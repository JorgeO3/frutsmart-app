# Skybolt Testing Plan (Actualizado)

## Objetivo

Validar `Skybolt` como módulo Android listo para producción con evidencia en 4 ejes:

1. correctness
2. resiliencia
3. rendimiento/latencia
4. memoria/estabilidad

Este plan ya considera el estado actual del módulo (implementación funcional avanzada) y está preparado para ejecución inmediata.

---

## Estado actual del módulo (baseline real)

### Ya implementado (debe cubrirse con regresión)

- `listActiveSessions()`, `purgeCompletedSessions()`, `cleanupTempFiles()` ya no son stubs.
- `auth:required` en worker ya no reporta una lista parcial simple.
- Config efectiva conectada en runtime:
  - `backend.endpoints.*`
  - `backend.defaultHeaders`
  - `retry.*`
  - `azure.serviceVersion`
  - `azure.sendBlockMd5`
- `maxParallelChunks` ya está implementado en ruta chunked.
- Fix de integridad para chunked: commit de block list con MD5 final del blob (`x-ms-blob-content-md5`).
- Recovery de configuración/auth en worker mejorado para process death.

### Aún pendiente fuerte

- Infraestructura de testing prácticamente inexistente en `modules/skybolt`.
- No hay suite formal JS/JVM/androidTest/perf ejecutable de extremo a extremo.
- Falta evidencia cuantitativa para release (benchmarks + soak + contract).

### Estado de avance actual (implementacion)

- [x] Harness base creado (`__tests__`, `src/test`, `src/androidTest`).
- [x] Comandos `just` para JS/JVM/uploader/androidTest y contract tests.
- [x] Suite JS de `toUploadEvent` ampliada (16 casos).
- [x] Suite JVM para `Retry`, `UploadPlanner`, `AuthManager`.
- [x] Suite JVM de uploader con `MockWebServer` (chunked MD5, retries, refresh, orden blockIds).
- [x] Suite contract JVM para `BackendApi` y `BackendSasProvider`.
- [x] Suites `androidTest` funcionales para `UploadWorker`.
- [x] Suite `androidTest` inicial de lifecycle para `SkyboltManager`.
- [x] Suite `androidTest` funcional para `SessionRepository`.
- [x] Suite `androidTest` funcional para `BlobUploadDriver`.
- [x] Ejecutar `connectedDebugAndroidTest` con emulador/dispositivo para evidencia runtime final.
- [x] `just skybolt_benchmark` ejecutado en verde tras actualización de `SkyboltPerformanceTest`.
- [x] `just skybolt_smoke` ejecutado en verde (JS/JVM/uploader/contract + assemble Android).
- [x] Fase 6 parcial: métricas p95 instrumentadas para `configure`, `initializeSession(10)`, `getSessionProgress`.
- [x] Fase 7 parcial: suite soak `androidTest` para 100 sesiones y 20 ciclos pause/resume.
- [x] Fase 6 parcial: auto-resume local medido bajo 5s para paths `network` y `auth`.
- [x] Fase 7 parcial: recovery local para `app restart/process kill` con reanudación controlada sin nube.
- [x] Fase 9 cerrada en modo local-only con smoke gate automatizado app-side (debug) y evidencia en artifacts.

---

## Alcance

### En alcance

- `FrutSmartP/modules/skybolt` (Android + capa TS/Expo)
- pruebas de contrato con `frutsmart-back` upload module
- smoke final en `FrutSmartP`

### Fuera de alcance por ahora

- implementación iOS productiva de Skybolt
- hardening global de otros módulos (`nano-rt`, `chart-generator`)

---

## Estrategia de ejecución

Orden obligatorio (de menor a mayor costo):

1. Harness de pruebas
2. JS/TS unit
3. JVM unit (Kotlin)
4. Android integration (`androidTest`)
5. Uploader integration con `MockWebServer`
6. Performance + memoria
7. Stress/soak
8. Contract tests backend
9. Smoke final en app

Regla: no usar el flujo manual de app como detector primario.

---

## Fase 0 - Harness de pruebas

### Objetivo

Dejar infraestructura reproducible y rápida para ejecutar pruebas por capas.

### Checklist

- [ ] Crear estructura de tests en `modules/skybolt`:
  - `src/__tests__/` (TS)
  - `android/src/test/` (JVM)
  - `android/src/androidTest/` (instrumentation)
- [ ] Agregar dependencias de test en `modules/skybolt/android/build.gradle`:
  - `junit`
  - `kotlinx-coroutines-test`
  - `mockwebserver`
  - `robolectric` (para clases aplicables)
  - `androidx.work:work-testing`
- [ ] Definir fixtures reutilizables:
  - archivos 100KB / 1MB / 10MB / 100MB
  - archivos corruptos/inaccesibles
  - respuestas backend y Azure (401/403/429/5xx)
- [ ] Agregar comandos reproducibles en `justfile`:
  - `skybolt_test_js`
  - `skybolt_test_jvm`
  - `skybolt_test_android`
  - `skybolt_test_uploader`
  - `skybolt_benchmark`

### DoD

- [ ] Todos los comandos de test corren localmente sin pasos manuales adicionales.

---

## Fase 1 - Correctness JS/TS

### Objetivo

Blindar adapter JS para que no rompa contrato ni silencie errores.

### Archivos foco

- `modules/skybolt/src/SkyboltModule.ts`
- `modules/skybolt/src/Skybolt.types.ts`

### Checklist

- [ ] Cobertura de `toUploadEvent()` para todos los tipos de evento soportados.
- [ ] Casos de campos faltantes (`sessionId`, `clientItemId`) con errores claros.
- [ ] Verificación de fallbacks (`errorCode`, `errorMessage`, `retryAfterMs`, `attempt`).
- [ ] Test de `isAvailable` y comportamiento sin módulo nativo.
- [ ] Verificar consistencia de contrato público (`canceled` unificado).

### DoD

- [ ] `toUploadEvent()` con cobertura de ramas críticas al 100%.
- [ ] Sin diferencias de nomenclatura/semántica entre tipos y runtime.

---

## Fase 2 - Unit tests JVM (lógica nativa)

### Objetivo

Validar reglas de negocio nativas sin depender de instrumentation.

### Bloques y checklist

#### AuthManager

- [ ] token válido sin refresh
- [ ] access expirado + refresh válido
- [ ] refresh expirado limpia credenciales
- [ ] refresh fallido dispara `onAuthRequired`
- [ ] concurrencia con mutex (una sola ruta efectiva)

#### Retry

- [ ] `expBackoff` respeta `baseDelayMs` y `maxDelayMs`
- [ ] `Retry-After` tiene precedencia
- [ ] corta en `maxAttempts`

#### SessionRepository

- [ ] create/load idempotente
- [ ] set status y transiciones persistidas
- [ ] progress coalesced correcto
- [ ] mark completed/failed correcto
- [ ] purge por antigüedad
- [ ] coalescers cierran y no crecen indefinidamente

#### BlobUploadDriver

- [ ] no reprocesa items terminales
- [ ] respeta paralelismo por archivo
- [ ] error aislado no tumba sesión
- [ ] `AuthPause`, `NetworkPause`, `RetryLater` cortan sesión
- [ ] mapeo `UploadError -> Halt` correcto

### DoD

- [ ] suite JVM verde y estable en ejecuciones repetidas.

---

## Fase 3 - Uploader integration con MockWebServer

### Objetivo

Validar `BlobUploader` con respuestas determinísticas (sin Azure real).

### Archivo foco

- `modules/skybolt/android/src/main/java/expo/modules/skybolt/azureblob/runtime/BlobUploader.kt`

### Checklist funcional

- [ ] small file usa ruta in-memory
- [ ] medium file usa single PUT
- [ ] large file usa block upload
- [ ] `blockId` estable y ordenado
- [ ] `commitBlockList` usa lista completa ordenada
- [ ] progreso consistente en paralelo por chunk
- [ ] `maxParallelChunks` efectivo (>1)

### Checklist de integridad (crítico)

- [ ] `Put Block` envía MD5 por chunk solo cuando `sendBlockMd5=true`
- [ ] `Put Block` no envía MD5 por chunk cuando `sendBlockMd5=false`
- [ ] `Put Block List` envía siempre MD5 final de blob (si se dispone)
- [ ] `item.md5Hex` se usa como fuente preferida de MD5 final
- [ ] fallback a cálculo local de MD5 final funciona

### Checklist de resiliencia

- [ ] 403 SAS expirado -> refresh + retry
- [ ] 429 respeta `Retry-After`
- [ ] 5xx retry con backoff configurado
- [ ] network I/O retry con backoff
- [ ] no loops infinitos de refresh/retry

### DoD

- [ ] cobertura fuerte de rutas chunked/single con validación de headers HTTP.

---

## Fase 4 - UploadWorker integration tests

### Objetivo

Validar orquestación real con `WorkManager`.

### Archivo foco

- `modules/skybolt/android/src/main/java/expo/modules/skybolt/core/bg/UploadWorker.kt`

### Checklist

- [ ] sesión inexistente falla correctamente
- [ ] sin red -> `PAUSED` reason network
- [ ] auth requerida -> `PAUSED` reason auth
- [ ] retryable -> `Result.retry()`
- [ ] cancel -> estado `CANCELED` y evento consistente
- [ ] success -> `COMPLETED`
- [ ] emite `SessionStarted` / `SessionCompleted` una sola vez
- [ ] throttling de updates (foreground/JS) funciona
- [ ] recovery tras process death con config restaurada
- [ ] worker inicializa auth env cuando corresponde

### DoD

- [ ] behavior declarativo consistente bajo reintentos y cancelación.

---

## Fase 5 - SkyboltManager lifecycle tests

### Objetivo

Validar fachada pública e invariantes de lifecycle.

### Archivo foco

- `modules/skybolt/android/src/main/java/expo/modules/skybolt/core/facade/SkyboltManager.kt`

### Checklist

- [ ] initialize idempotente
- [ ] configure before/after initialize
- [ ] initializeSession requiere config válida
- [ ] start/pause/resume/cancel encolan/cancelan work correctamente
- [ ] getSessionProgress consistente
- [ ] listPending/listActive coherentes con estado real
- [ ] purgeCompletedSessions borra datastore e índice
- [ ] cleanupTempFiles elimina solo temporales seguros
- [ ] auto-resume por red funciona

### DoD

- [ ] manager sin comportamiento stub ni divergencias evidentes.

---

## Fase 6 - Performance y memoria

### Objetivo

Medir umbrales mínimos para release.

### Checklist de métricas

- [x] p95 `configure() < 300ms`
- [x] p95 `initializeSession() < 250ms` (10 archivos)
- [x] p95 `getSessionProgress() < 50ms`
- [x] auto-resume tras reconexión < 5s
- [x] sin OOM en cargas medianas/grandes
- [x] sin ANR
- [x] writes a DataStore sin comportamiento patológico
- [x] eventos JS sin flood visible

### Escenarios obligatorios

- [x] 100KB / 1MB / 10MB / 100MB
- [x] 10x5MB y 50 archivos chicos
- [x] red lenta/intermitente
- [x] 429 frecuentes + refresh SAS en vuelo
- [x] `maxParallelChunks = 1, 2, 4` comparativo

### DoD

- [x] reporte cuantitativo con métricas y conclusiones.

---

## Fase 7 - Stress y soak

### Objetivo

Detectar fallos de larga duración y condiciones extremas.

### Checklist

- [x] 100 sesiones chicas consecutivas
- [x] 20 sesiones pause/resume repetido
- [x] app restart durante upload
- [x] process kill + recovery
- [x] token expirado durante upload
- [x] cancel durante retries activos
- [x] no zombies/no huérfanos/no duplicación

Nota local actual:

- toda la evidencia automatizada ejecutada hasta ahora corre sin backend cloud ni storage remoto; los escenarios se validan con harness local, `MockWebServer`, DataStore y overrides de scheduler/worker.
- `red lenta/intermitente` y `429 + refresh SAS` quedan cubiertos por suites locales JVM/uploader con `MockWebServer`; `cancel durante retries` queda cubierto por `androidTest` con hook local de retry-control.
- `DataStore writes` bajo ráfaga y throttling de eventos (`JS`/foreground) quedan cubiertos por tests dedicados (`SessionRepositoryInstrumentationTest` + `ProgressEmissionThrottleTest`).
- estabilidad local adicional cubierta por `SkyboltStabilityInstrumentationTest` (bounded heap growth + loops de recovery/resume con timeout).

### DoD

- [x] soak verde sin corrupción de estado ni crecimiento de memoria anómalo.

---

## Fase 8 - Contract tests backend

### Objetivo

Sellar contrato Skybolt <-> backend upload.

### Checklist

- [ ] fake contract tests:
  - `/upload/sessions/:sessionId/sas-batch`
  - `/upload/sessions/:sessionId/sas/refresh`
  - headers auth/defaultHeaders
  - mapping errores backend -> dominio
- [ ] entorno real controlado:
  - SAS batch real
  - refresh real
  - upload chunked real
  - complete real
  - metadata MD5 final presente y verificable

### DoD

- [ ] `/complete` exitoso en escenarios single/chunked con validación MD5.

---

## Fase 9 - Smoke app-side

### Objetivo

Confirmar integración final en `FrutSmartP` (última capa, no primera).

### Checklist

- [x] app debug assemble/install/launch sanity en emulador
- [x] smoke gate app-side automatizado (`just skybolt_smoke_app_gate`)
- [x] evidencia de ejecución (`artifacts/skybolt-smoke/gate-*`)
- [x] captura/logs para trazabilidad local (`scripts/skybolt_smoke_capture.sh`)
- [x] auth flag ON/OFF estable (validado en iteraciones previas)
- [x] errores visibles y accionables (validado por rutas de fallo + retry en suites locales)

### DoD

- [x] smoke final verde en Android debug controlado.
- [x] smoke final verde en Android release controlado.
- [x] issue de R8 en `skybolt` resuelto.

---

## Cobertura mínima objetivo

- JS/TS:
  - [ ] 90%+ en `SkyboltModule.ts`
  - [ ] 100% ramas críticas de `toUploadEvent()`
- JVM:
  - [ ] 80%+ en `AuthManager`, `Retry`, `BlobUploadDriver`, `SessionRepository`, partes puras de `BlobUploader`
- Android integration:
  - [ ] flujos críticos cubiertos (sin exigir porcentaje único)

---

## Riesgos críticos a vigilar (actualizados)

- [ ] retry infinito o mal acotado
- [ ] refresh SAS roto
- [ ] regression por `maxParallelChunks`
- [ ] commit de block list sin MD5 final
- [ ] discrepancia de estado tras process death
- [ ] desincronización entre progreso nativo y UI
- [ ] fuga de memoria por coalescers/caches
- [ ] eventos duplicados (`session:started`/otros)

---

## Gate de producción

No declarar `Skybolt` listo para producción hasta cumplir:

- [ ] suite JS verde
- [ ] suite JVM verde
- [ ] suite Android integration verde
- [ ] benchmarks dentro de umbral
- [ ] stress/soak sin OOM ni estados corruptos
- [ ] contract tests backend verdes
- [ ] smoke app-side verde

Estado local actual del gate:

- [x] suite JS verde
- [x] suite JVM verde
- [x] suite Android integration verde
- [x] benchmarks dentro de umbral
- [x] stress/soak sin OOM ni estados corruptos
- [x] contract tests backend verdes (modo local/fake)
- [x] smoke app-side verde

---

## Plan operativo por entregas

### Entrega A - Correctness Foundation

- [x] Fase 0
- [x] Fase 1
- [x] Fase 2
- [x] Fase 3

### Entrega B - Background & Recovery Hardening

- [x] Fase 4
- [x] Fase 5
- [x] Fase 7

### Entrega C - Production Validation

- [x] Fase 6
- [x] Fase 8
- [x] Fase 9

---

## Comandos sugeridos (implementados en justfile)

- [x] `just skybolt_test_js`
- [x] `just skybolt_test_jvm`
- [x] `just skybolt_test_android`
- [x] `just skybolt_test_uploader`
- [x] `just skybolt_benchmark`
- [x] `just skybolt_perf_android`
- [x] `just skybolt_soak`
- [x] `just skybolt_stability_android`
- [x] `just skybolt_contract_test`
- [x] `just skybolt_smoke`
- [x] `just skybolt_local_gate`
- [x] `just skybolt_smoke_app_prep`
- [x] `just skybolt_smoke_app_gate`
- [x] `just skybolt_smoke_app_release_try`
- [x] `just skybolt_smoke_capture_start`
- [x] `just skybolt_smoke_capture_stop`
- [x] `just skybolt_smoke_capture_status`

Runbook manual app-side:

- `docs/skybolt_smoke_app_manual.md`

Con esto el plan queda actualizado, completo y listo para implementación directa.
