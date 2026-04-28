# Plan de integracion de modulos nativos en `FrutSmartP`

## Objetivo

Integrar en `FrutSmartP` las mejoras mas recientes de los modulos nativos `Skybolt` y `nano-rt`, cerrar el pipeline de cargas de extremo a extremo, y reemplazar la pantalla mock de uploads por una pantalla real sincronizada con el scheduler y el estado nativo.

## Alcance de esta fase

- App objetivo: `FrutSmartP`
- Modulos incluidos:
  - `Skybolt` desde `cloud-upload/modules/skybolt`
  - `nano-rt` desde `FrutSmartP/modules/nano-rt`, portando mejoras relevantes desde `RNOptimizedPipelines`
- Plataforma objetivo principal: Android
- Fuera de alcance inicial:
  - iOS productivo para `Skybolt`
  - iOS productivo para `nano-rt`
  - Integracion del modulo `chart-generator` en `FrutSmartP`

## Estado actual resumido

### `Skybolt`

- `FrutSmartP` ya tiene una copia local en `modules/skybolt`, pero esta divergida respecto a `cloud-upload/modules/skybolt`.
- La app ya monta `SkyboltUploadProvider`, pero el pipeline completo no esta cableado.
- El backend contract actual de `frutsmart-back` no coincide con la capa app-side actual del scheduler.

### `nano-rt`

- `FrutSmartP` ya usa un modulo Expo `modules/nano-rt` funcional en Android.
- `RNOptimizedPipelines` contiene mejoras grandes en runtime, actor model y bateria de tests, pero hoy no es reusable directamente como modulo Expo.
- El trabajo real es portar las mejoras necesarias al modulo Expo existente de `FrutSmartP`, no copiar el repo entero.

### Uploads / scheduler / UI

- `src/app/plant-work/uploads.tsx` existe, pero hoy es una pantalla mock con datos hardcodeados.
- `src/services/uploads/UploadScheduler.ts` define la maquina de estados, pero no esta ejecutandose realmente.
- `src/services/uploads/UploadService.ts` todavia tiene gran parte de handlers y acciones en TODO.
- `saving-classification.tsx` persiste analisis localmente, pero no encola ni inicia el pipeline de upload.

## Principios de implementacion

1. Hacer primero que el contrato app-backend sea correcto.
2. Sincronizar primero `Skybolt`, luego cerrar el pipeline app-side.
3. Portar `nano-rt` por capas, sin romper la API JS ya consumida por la app.
4. Mantener compatibilidad Android/Expo SDK 53 de `FrutSmartP`.
5. No mezclar refactor cosmetico con integracion funcional.
6. Cada fase debe quedar verificable por pruebas manuales o automatizadas.

## Plan por fases

---

## Fase 0 - Alineacion tecnica y baseline

### Objetivo

Congelar supuestos, definir el contrato real y evitar implementar sobre interfaces equivocadas.

### Tareas

#### 0.1 Confirmar supuestos de plataforma

- Declarar oficialmente que esta fase es Android-first.
- Documentar que iOS queda en modo no soportado para uploads e inferencia avanzada.
- Verificar que los flujos de negocio no dependan de iOS para la salida inicial.

#### 0.2 Levantar baseline funcional de `FrutSmartP`

- Ejecutar la app en Android y validar el flujo actual de:
  - login
  - bootstrap
  - deteccion externa
  - deteccion interna
  - guardado de analisis
- Registrar cualquier falla previa para no atribuirla luego a la integracion.

#### 0.3 Congelar APIs existentes consumidas por la app

- Listar todas las llamadas JS actuales a `modules/skybolt`.
- Listar todas las llamadas JS actuales a `modules/nano-rt`.
- Identificar la API minima que no se puede romper sin tocar pantallas/hooks.

#### 0.4 Alinear contrato real de uploads con backend

- Confirmar payload real requerido por `POST /api/v1/upload/sessions`.
- Confirmar headers reales de auth para ambiente local/dev.
- Confirmar restricciones reales por archivo:
  - `clientItemId`
  - `fileName`
  - `fileSizeBytes`
  - `contentType`
  - `md5`
- Definir un adapter app-side que transforme analisis persistidos a ese contrato.

### Entregables

- Documento corto de decisiones tecnicas.
- Lista congelada de APIs JS a preservar.
- Contrato mobile-backend cerrado para sesiones de upload.

### Criterio de salida

- Ya no hay ambiguedad sobre payloads, auth, endpoints ni plataforma objetivo.

---

## Fase 1 - Sincronizacion de `Skybolt` desde la fuente de verdad

### Objetivo

Actualizar `FrutSmartP/modules/skybolt` usando `cloud-upload/modules/skybolt` como base, conservando solamente los ajustes locales realmente necesarios para `FrutSmartP`.

### Tareas

#### 1.1 Inventario de diferencias

- Comparar archivo por archivo `cloud-upload/modules/skybolt` vs `FrutSmartP/modules/skybolt`.
- Clasificar diferencias en tres grupos:
  - mejoras upstream que deben entrar
  - cambios locales de `FrutSmartP` que deben mantenerse
  - divergencias accidentales o deuda tecnica a eliminar

#### 1.2 Actualizar capa JS/TS del modulo

- Unificar `index.ts` y exports publicos.
- Decidir si se mantiene `SkyboltNativeUploadProvider.tsx` como wrapper app-specific.
- Alinear tipos TS (`Skybolt.types.ts`) con el runtime nativo real.
- Validar que `UploadEvent` y la conversion `toUploadEvent()` reflejen todos los eventos usados por la app.

#### 1.3 Actualizar capa Android nativa del modulo

- Sincronizar:
  - `SkyboltModule.kt`
  - `SkyboltManager.kt`
  - `UploadWorker.kt`
  - `BackendApi.kt`
  - `AuthManager.kt`
  - almacenamiento de sesiones
  - network watcher
  - driver/blob uploader
- Resolver divergencias de dependencias Android y versiones de librerias.
- Verificar compatibilidad con Gradle/Kotlin/Expo SDK 53 de `FrutSmartP`.

#### 1.4 Resolver configuracion de backend

- Corregir `src/config/skyboltConfig.ts` para que coincida con el contrato real de backend.
- Confirmar si `Skybolt` debe respetar endpoints configurables o si se estandarizara el contrato hardcoded actual.
- Si el modulo sigue usando paths fijos, reflejar eso explicitamente en config y docs.

#### 1.5 Resolver integracion de auth

- Verificar que `authService.ts` siga sincronizando tokens con `Skybolt` sin regresiones.
- Validar el flujo:
  - login interactivo
  - persistencia de tokens
  - refresh silencioso
  - `notifyAuthRefreshed`
  - reaccion a `auth:required`

#### 1.6 Validar features nativas criticas de `Skybolt`

- Inicializacion del modulo.
- Creacion de sesion.
- Start/pause/resume/cancel.
- Recovery al reiniciar la app.
- Eventos `item:progress`, `session:*`, `error:*`.
- WorkManager en foreground.

### Entregables

- `FrutSmartP/modules/skybolt` alineado con upstream.
- Config de backend corregida.
- Wrapper JS compatible con la app.

### Criterio de salida

- El modulo compila y responde correctamente desde `FrutSmartP` en Android.

---

## Fase 2 - Port de mejoras de `nano-rt` al modulo Expo de `FrutSmartP`

### Objetivo

Incorporar en `FrutSmartP/modules/nano-rt` las mejoras relevantes del runtime actualizado, minimizando ruptura de la API JS actual.

### Tareas

#### 2.1 Definir estrategia de port

- No copiar `RNOptimizedPipelines` completo.
- Elegir piezas a portar por prioridad:
  1. runtime/concurrencia segura
  2. gestion de lifecycle y shutdown
  3. mejoras de warmup
  4. assets/modelos nuevos
  5. tests adaptables

#### 2.2 Mapear gap entre `ModelManager` actual y actor-based runtime

- Comparar `ModelManager.kt` actual de `FrutSmartP` con el actor-based runtime externo.
- Identificar incompatibilidades:
  - firmas publicas
  - ownership del interprete
  - manejo de `InterpreterSession`
  - shutdown/release
  - thread confinement

#### 2.3 Portar infraestructura interna de interpretacion

- Incorporar o adaptar:
  - `InterpreterActor`
  - `InterpreterProtocol`
  - `InterpreterSession`
  - debug hooks solo si aportan valor real
- Asegurar que `ModelManager` conserve una API estable para el resto del modulo.

#### 2.4 Portar mejoras del interprete

- Revisar cambios en `NanoRTInterpreter.kt`.
- Portar mejoras de:
  - seguridad de ownership por hilo
  - buffers y liberacion de memoria
  - cierre seguro del interprete
  - guardas de reentrada y uso despues de release

#### 2.5 Portar mejoras de warmup y lifecycle

- Ajustar `InterpreterWarmer.kt`.
- Ajustar `NanoRTModule.kt` para:
  - bootstrap seguro
  - warmup no bloqueante
  - limpieza completa en `OnDestroy`
  - emision robusta de eventos de init

#### 2.6 Revisar modelos y assets

- Determinar si deben incorporarse nuevos `.tflite` faltantes.
- Verificar que rutas de assets y nombres de modelos queden consistentes.
- Validar si `bunch_segmentation.tflite` y `ring_segmentation.tflite` deben permanecer y como encajan con los flujos activos.

#### 2.7 Mantener compatibilidad con la app

- No romper `useNanoRTReady()`.
- No romper `NanoRTClassifier`.
- No romper pantallas de deteccion externa/interna.
- Si cambia el shape de resultados nativos, introducir adapter JS en lugar de tocar todas las pantallas.

#### 2.8 Portar pruebas prioritarias

- Seleccionar un subconjunto pequeno pero de alto valor de las pruebas de `RNOptimizedPipelines`.
- Priorizar pruebas sobre:
  - shutdown limpio
  - model switching
  - no reentrancia
  - fugas de hilo
  - uso fuera del hilo duenio

### Entregables

- `FrutSmartP/modules/nano-rt` con runtime fortalecido.
- Warmup y lifecycle mas robustos.
- Pruebas minimas de regresion del runtime.

### Criterio de salida

- Los flujos de deteccion de `FrutSmartP` siguen funcionando y el modulo queda mas cercano al runtime actualizado.

---

## Fase 3 - Cerrar el contrato app-side del pipeline de uploads

### Objetivo

Hacer que `FrutSmartP` pueda transformar un analisis guardado localmente en un job de upload valido contra el backend real.

### Tareas

#### 3.1 Definir entidad de trabajo real por upload

- Revisar esquema local de `upload_jobs`.
- Verificar si faltan columnas o repositorio para persistir:
  - `backend_session_id`
  - `skybolt_session_id`
  - resumen de archivos del job
  - metadata por archivo
  - timestamps por evento
- Si falta estructura, agregar migracion/cambio en repositorio local.

#### 3.2 Construir `analysis -> upload manifest`

- Extraer desde el analisis persistido:
  - fotos a subir
  - nombre de archivo seguro
  - content type
  - size bytes
  - md5
- Decidir exactamente que archivos van a la nube en esta primera fase.
- Normalizar nombres de archivo para cumplir el backend.

#### 3.3 Implementar adapter de backend

- Crear una capa `BackendUploadApi` real para `UploadScheduler`.
- Implementar:
  - `createUploadSession`
  - `completeUploadSession`
  - stub o implementacion real de `createEvaluation`
- Inyectar auth real usando el mecanismo vigente de la app.

#### 3.4 Redisenar `createJobFromAnalysis()`

- Dejar de crear jobs vacios.
- Calcular `total_files`, `total_bytes` y metadata inicial.
- Persistir informacion suficiente para que el scheduler pueda crear la sesion backend.
- Definir `domain` correcto para `FrutSmartP`.

#### 3.5 Asociar archivos del job con `Skybolt`

- Definir como se arma `SessionConfig.items` para el modulo nativo.
- Reusar exactamente `blobName` devuelto por backend cuando aplique.
- Asegurar que `clientItemId` quede estable entre backend, DB local y `Skybolt`.

### Entregables

- Job local completo y util.
- Adapter backend funcional.
- Metadata por archivo lista para crear sesiones reales.

### Criterio de salida

- La app puede construir una sesion backend valida a partir de un analisis persistido.

---

## Fase 4 - Implementacion real del scheduler

### Objetivo

Hacer que `UploadScheduler` deje de ser un diseño pasivo y pase a orquestar realmente el pipeline completo.

### Tareas

#### 4.1 Cerrar los huecos del scheduler actual

- Persistir `backend_session_id` cuando `create_session` termina bien.
- Persistir `skybolt_session_id` cuando la subida nativa arranca.
- Definir transiciones exactas entre:
  - `create_session`
  - `upload`
  - `complete_session`
  - `evaluation`
  - `done`
- Definir politica de reintentos por paso.

#### 4.2 Crear `NativeUploadApi` real

- Implementar `startUploadForJob()` sobre `Skybolt`.
- Hacer que:
  - cree sesion nativa si no existe
  - reanude sesion si ya existe
  - conecte items del job con la sesion nativa

#### 4.3 Conectar scheduler con eventos de `Skybolt`

- Completar `UploadService.handleSkyboltEvent()`.
- Implementar handlers reales para:
  - `session:started`
  - `session:paused`
  - `session:resumed`
  - `session:completed`
  - `session:failed`
  - `item:progress`
  - `item:completed`
  - `item:failed`
  - `auth:required`
  - `error:*`
- Hacer que estos handlers actualicen la DB local y preparen la siguiente transicion del pipeline.

#### 4.4 Definir motor de ejecucion del scheduler

- Ejecutar `runTick()`:
  - al iniciar la app
  - al crear un job nuevo
  - al reintentar manualmente
  - despues de ciertos eventos nativos
- Definir si hace falta polling JS liviano o si basta con eventos + arranque de app.
- Evitar ticks concurrentes y loops infinitos.

#### 4.5 Implementar acciones de control de jobs

- Completar `forceRetryJob(jobId)`.
- Completar `cancelJob(jobId)`.
- Definir que significa cancelacion en DB local y en `Skybolt`.

#### 4.6 Recovery y restart safety

- Al abrir la app:
  - recuperar jobs pendientes
  - consultar sesiones nativas pendientes
  - rehidratar estado local
  - reconciliar DB local con `Skybolt`
- Resolver que pasa si hay sesion nativa sin job local o job local sin sesion nativa.

### Entregables

- Scheduler operativo.
- `UploadService` implementado.
- Recovery consistente tras restart.

### Criterio de salida

- Un analisis guardado puede avanzar automaticamente de `pending` a `done` o `failed` con trazabilidad completa.

---

## Fase 5 - Integracion con el flujo de guardado de analisis

### Objetivo

Hacer que el upload se origine automaticamente desde el flujo de negocio correcto.

### Tareas

#### 5.1 Integrar en `saving-classification.tsx`

- Luego de `saveAnalysis()`, crear el job de upload para el `analysisId` generado.
- Decidir si el enqueue ocurre siempre o segun tipo de flujo.
- Disparar un `runTick()` inicial despues de encolar.

#### 5.2 Resolver condiciones de negocio

- Definir si un analisis puede marcarse como listo para reporte antes o despues del upload.
- Definir que pasa si el upload falla pero el analisis local ya fue persistido.
- Definir si el reporte depende del upload o es independiente.

#### 5.3 Trazabilidad de errores visibles al usuario

- Mostrar estado cuando el analisis se guardo localmente pero no pudo iniciar upload.
- Evitar perder el analisis por error de red o backend.

### Entregables

- Flujo `saveAnalysis -> enqueue upload -> scheduler` completo.

### Criterio de salida

- El usuario ya no necesita crear manualmente el upload por fuera del flujo de guardado.

---

## Fase 6 - Reemplazar `src/app/plant-work/uploads.tsx` por una pantalla real

### Objetivo

Convertir la pantalla actual de uploads en una vista real de jobs/sesiones sincronizada con el scheduler y `Skybolt`.

### Tareas

#### 6.1 Definir modelo de UI

- Decidir si la pantalla muestra:
  - jobs del pipeline
  - sesiones nativas de `Skybolt`
  - o una vista unificada de ambos
- Recomendada: vista unificada por job, usando la DB local como source of truth y enriqueciendo con progreso nativo.

#### 6.2 Adaptar `UploadJobViewModel`

- Extender el view model para incluir:
  - nombre legible del trabajo
  - estado visible al usuario
  - progreso agregado
  - ETA
  - cantidad de archivos
  - bytes totales/subidos
  - ultima actualizacion
  - error visible
  - acciones permitidas

#### 6.3 Reemplazar mocks por datos reales

- Eliminar `defaultSessions`.
- Consumir `useSkyboltUploadContext()` o hook derivado.
- Refrescar desde DB real al entrar a la pantalla.

#### 6.4 Cablear acciones de usuario

- `pause`
- `resume`
- `retry`
- `cancel`
- `ver detalle`
- Asegurar que cada accion impacte DB local y modulo nativo de forma consistente.

#### 6.5 Mejorar detalle de sesion/job

- Mostrar:
  - step actual del pipeline
  - status del upload nativo
  - archivos completados vs totales
  - ultimo error
  - si esta esperando auth/red/backend

#### 6.6 Manejar estados vacios y recovery

- Pantalla sin uploads.
- Jobs pausados por red.
- Jobs esperando reautenticacion.
- Jobs fallidos recuperables.
- Jobs completados.

### Entregables

- `src/app/plant-work/uploads.tsx` funcionando con datos reales.
- Modal/detalle conectado a acciones reales.

### Criterio de salida

- La pantalla deja de ser mock y se convierte en consola operativa de uploads.

---

## Fase 7 - Validacion tecnica y funcional

### Objetivo

Probar que los modulos actualizados y el scheduler funcionan bien en escenarios reales y de fallo.

### Tareas

#### 7.1 Validacion de `nano-rt`

- Flujo de bootstrap.
- Warmup.
- Deteccion externa repetida.
- Deteccion interna repetida.
- Cambio de modelos en una misma sesion.
- Cierre y reapertura de app.

#### 7.2 Validacion de `Skybolt`

- Upload de una sesion pequena.
- Upload de varias imagenes.
- Pause/resume.
- Recovery tras cerrar la app.
- Recovery tras perdida de red.
- Expiracion de token y refresh.

#### 7.3 Validacion del pipeline scheduler

- `create_session` exitoso.
- `upload` exitoso.
- `complete_session` exitoso.
- fallo de backend en create.
- fallo de red durante upload.
- fallo de `complete_session`.
- retry manual exitoso.
- cancelacion manual.

#### 7.4 Validacion de UI de uploads

- Lista refleja progreso real.
- Modal muestra datos reales.
- Acciones de usuario producen transiciones correctas.
- No hay desincronizacion visible entre progreso nativo y DB local.

#### 7.5 Validacion del contrato backend

- Confirmar que el backend acepta payloads emitidos por la app.
- Confirmar que `blobName` y `clientItemId` quedan consistentes extremo a extremo.
- Confirmar que `complete` no rompe por metadata faltante.

### Entregables

- Matriz de pruebas ejecutadas.
- Lista de bugs encontrados y corregidos.

### Criterio de salida

- El flujo completo esta estable en Android para una salida controlada.

---

## Fase 8 - Endurecimiento y cierre

### Objetivo

Reducir deuda tecnica critica y dejar la implementacion lista para extenderse luego a otras apps.

### Tareas

#### 8.1 Documentacion tecnica

- Documentar arquitectura final del pipeline en `FrutSmartP`.
- Documentar source of truth por capa:
  - backend
  - DB local
  - scheduler
  - `Skybolt`
  - UI

#### 8.2 Checklist de extension a `frutosmart`

- Extraer que piezas son reutilizables.
- Identificar que partes de la integracion deberian compartirse luego.
- Dejar checklist de port para la segunda app.

#### 8.3 Deuda tecnica priorizada

- Listar pendientes no bloqueantes:
  - iOS
  - limpieza de sesiones completas
  - telemetria adicional
  - tests instrumentados mas completos
  - refinamientos de UX

### Entregables

- Documentacion final.
- Lista de follow-ups.

---

## Orden recomendado de ejecucion

1. Fase 0 - Alineacion tecnica
2. Fase 1 - Sincronizar `Skybolt`
3. Fase 3 - Cerrar contrato app-side de uploads
4. Fase 4 - Implementar scheduler real
5. Fase 5 - Integrar enqueue desde guardado
6. Fase 6 - Rehacer `uploads.tsx`
7. Fase 2 - Port controlado de mejoras de `nano-rt`
8. Fase 7 - Validacion completa
9. Fase 8 - Documentacion y cierre

> Nota: aunque `nano-rt` es importante, conviene cerrar primero `Skybolt + scheduler + uploads UI`, porque ese flujo hoy esta mas roto funcionalmente en `FrutSmartP`.

## Backlog operativo detallado

### Bloque A - `Skybolt`

- [ ] Comparar y decidir diferencias entre upstream y copia local.
- [ ] Sincronizar tipos TS.
- [ ] Sincronizar cliente JS del modulo.
- [ ] Sincronizar bridge Android.
- [ ] Sincronizar manager/worker/storage/auth.
- [ ] Corregir config de endpoints en app.
- [ ] Validar login + token refresh + eventos auth.
- [ ] Validar upload simple real.

### Bloque B - Contrato de uploads

- [ ] Diseñar manifest de archivos por analisis.
- [ ] Calcular MD5, size y content type por archivo.
- [ ] Implementar adapter real a `create upload session`.
- [ ] Persistir `backend_session_id`.
- [ ] Reusar `blobName` backend en sesion nativa.

### Bloque C - Scheduler y servicio

- [ ] Implementar `BackendUploadApi` real.
- [ ] Implementar `NativeUploadApi` real.
- [ ] Completar `UploadService.handleSkyboltEvent()`.
- [ ] Completar `forceRetryJob()`.
- [ ] Completar `cancelJob()`.
- [ ] Ejecutar `runTick()` al iniciar la app.
- [ ] Ejecutar `runTick()` al crear un job.
- [ ] Reconciliar recovery entre DB local y `Skybolt`.

### Bloque D - Flujo de guardado

- [ ] Encolar upload despues de `saveAnalysis()`.
- [ ] Disparar primer tick del scheduler.
- [ ] Manejar errores de enqueue sin perder el analisis local.

### Bloque E - Pantalla de uploads

- [ ] Reemplazar sesiones mock.
- [ ] Consumir jobs reales.
- [ ] Mostrar progreso agregado real.
- [ ] Mostrar step del pipeline.
- [ ] Cablear pause/resume/retry/cancel.
- [ ] Mejorar modal de detalle.
- [ ] Agregar estados vacios, fallo y recovery.

### Bloque F - `nano-rt`

- [ ] Mapear piezas a portar desde `RNOptimizedPipelines`.
- [ ] Adaptar `ModelManager` a runtime mas seguro.
- [ ] Portar actor model interno.
- [ ] Ajustar `NanoRTInterpreter`.
- [ ] Ajustar `InterpreterWarmer`.
- [ ] Ajustar lifecycle de `NanoRTModule`.
- [ ] Revisar assets/modelos.
- [ ] Agregar pruebas minimas de runtime.

### Bloque G - Validacion

- [ ] Prueba manual de deteccion externa.
- [ ] Prueba manual de deteccion interna.
- [ ] Prueba manual de guardar analisis + enqueue.
- [ ] Prueba manual de upload exitoso.
- [ ] Prueba de pause/resume.
- [ ] Prueba de restart con sesion pendiente.
- [ ] Prueba de perdida de red.
- [ ] Prueba de auth refresh.
- [ ] Prueba de retry manual.
- [ ] Prueba de cancelacion.

## Riesgos principales

### Riesgo 1 - Desalineacion `Skybolt` vs backend

- El scheduler app-side actual no modela correctamente el payload real que exige backend.
- Mitigacion: cerrar primero adapter y contrato antes de tocar UI.

### Riesgo 2 - Port complejo del actor model

- El runtime nuevo de `RNOptimizedPipelines` no entra directo en Expo module.
- Mitigacion: port incremental, preservando API JS y separando runtime interno de bridge Expo.

### Riesgo 3 - Compatibilidad de toolchain Android

- `cloud-upload` y `RNOptimizedPipelines` usan stacks Android mas modernos que `FrutSmartP`.
- Mitigacion: ajustar versiones por compatibilidad y validar build temprano.

### Riesgo 4 - Desincronizacion entre DB local y progreso nativo

- Si los eventos no se persisten bien, la pantalla de uploads quedara inconsistente.
- Mitigacion: usar DB local como source of truth y actualizarla desde todos los eventos relevantes.

### Riesgo 5 - Alcance excesivo en una sola iteracion

- Actualizar ambos modulos y cerrar el pipeline completo puede ser demasiado grande si no se secuencia.
- Mitigacion: ejecutar por fases y cerrar hitos verificables.

## Hitos recomendados

### Hito 1

- `Skybolt` actualizado y compilando en `FrutSmartP`.
- Config/auth funcionando.

### Hito 2

- Job local completo + backend session real + sesion nativa real.

### Hito 3

- Scheduler operativo con recovery.

### Hito 4

- `uploads.tsx` real y usable.

### Hito 5

- `nano-rt` endurecido con mejoras portadas.

### Hito 6

- Validacion funcional completa cerrada en Android.

## Resultado esperado al final

Al cerrar este plan, `FrutSmartP` debe quedar con:

- `Skybolt` sincronizado con la fuente de verdad.
- `nano-rt` reforzado con las mejoras clave del runtime actualizado.
- pipeline `saveAnalysis -> enqueue -> create session -> native upload -> complete -> evaluation` funcionando.
- `src/app/plant-work/uploads.tsx` convertido en una pantalla real de monitoreo y control.
- base tecnica lista para luego portar el mismo enfoque a `frutosmart`.
