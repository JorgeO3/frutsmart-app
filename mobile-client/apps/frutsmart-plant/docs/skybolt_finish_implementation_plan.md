Plan para terminar Skybolt y cerrar todos los TODOs
Objetivo
Dejar Skybolt realmente listo para producción, con contrato público consistente, recuperación robusta, housekeeping funcional, configuración efectiva y suite de pruebas seria.
Recomendación de alcance
Recomendado
- Cerrar Skybolt como módulo Android productivo
- Marcar iOS explícitamente fuera de scope por ahora a nivel de metadata/API, en vez de mantener stubs engañosos
Alternativa
- Implementar iOS con paridad funcional completa  
- Esto agrega bastante alcance y debería tratarse como otro epic
> Mi recomendación es la primera: cerrar Android bien y despublicar iOS/web del contrato hasta que exista implementación real.
---
## Estado actual resumido
### Bloqueantes reales
- Config pública y runtime no están alineados
- Varias opciones “configurables” hoy son no-op
- Recovery tras restart/app kill está incompleto
- Hay APIs públicas stub:
  - `listActiveSessions()` en `FrutSmartP/modules/skybolt/android/src/main/java/expo/modules/skybolt/core/facade/SkyboltManager.kt:386`
  - `purgeCompletedSessions()` en `FrutSmartP/modules/skybolt/android/src/main/java/expo/modules/skybolt/core/facade/SkyboltManager.kt:442`
  - `cleanupTempFiles()` en `FrutSmartP/modules/skybolt/android/src/main/java/expo/modules/skybolt/core/facade/SkyboltManager.kt:459`
- `auth:required` aún reporta sesiones pendientes de forma parcial en `FrutSmartP/modules/skybolt/android/src/main/java/expo/modules/skybolt/core/bg/UploadWorker.kt:301`
- iOS sigue stub en `FrutSmartP/modules/skybolt/ios/SkyboltModule.swift:1`
---
Criterio de “módulo terminado”
El módulo se considera cerrado solo si cumple todo esto:
- contrato TS/Expo == contrato Android real
- no hay APIs públicas stub o engañosas
- recovery funciona tras restart/process death
- retry/auth/SAS/config se comportan según configuración
- housekeeping real implementado
- tests unitarios, integración y performance mínimos verdes
- Android listo para release
- iOS o bien implementado, o bien removido formalmente del alcance público
---
Fase 0 - Congelar alcance y contrato
Objetivo
Evitar seguir construyendo sobre una API ambigua.
Tareas
0.1 Definir soporte de plataformas
- Decidir formalmente:
  - Android only por ahora, o
  - Android + iOS
- Si se mantiene Android-only:
  - alinear expo-module.config.json
  - alinear README
  - evitar que el contrato JS sugiera soporte inexistente
0.2 Congelar la API pública real
Revisar y fijar como fuente de verdad:
- FrutSmartP/modules/skybolt/src/Skybolt.types.ts
- FrutSmartP/modules/skybolt/src/SkyboltModule.ts
0.3 Congelar eventos
Definir lista final de eventos soportados:
- session:*
- item:*
- auth:required
- error:*
- upload:recovery-complete
- upload:resume-all-complete
0.4 Normalizar terminología
Resolver de una vez:
- cancelled vs canceled
- paused by auth/network/user/error
- active vs pending vs preparing
Entregables
- contrato TS definitivo
- matriz de eventos oficial
- plataforma objetivo cerrada
---
Fase 1 - Corregir el contrato público y la configuración
Objetivo
Hacer que lo documentado, tipado y configurable coincida con el comportamiento real.
Tareas
1.1 Corregir tipos TS
En FrutSmartP/modules/skybolt/src/Skybolt.types.ts:
- decidir qué campos son realmente obligatorios
- alinear CloudUploadSettings.backend.auth
- alinear PauseReason, UploadStatus, ErrorCode
- decidir nomenclatura final para cancelación
1.2 Corregir bridge JS
En FrutSmartP/modules/skybolt/src/SkyboltModule.ts:
- verificar que todas las funciones exportadas existen nativamente
- eliminar o marcar funciones no soportadas si siguen fuera de alcance
- endurecer toUploadEvent() contra payloads parciales
1.3 Cerrar brecha docs vs runtime
En FrutSmartP/modules/skybolt/README.md:
- documentar backend.auth
- documentar soporte de plataforma real
- documentar qué config sí tiene efecto y cuál no
1.4 Hacer que la configuración sí gobierne el runtime
Hoy hay varias opciones parseadas pero no usadas. Hay que conectar realmente:
- backend.endpoints.sasBatchPath
- backend.endpoints.sasRefreshPath
- backend.defaultHeaders
- retry.maxRetries
- retry.baseDelayMs
- retry.maxDelayMs
- azure.serviceVersion
- azure.sendBlockMd5
- concurrency.maxParallelChunks
- allowsCellular
Archivos clave:
- FrutSmartP/modules/skybolt/android/src/main/java/expo/modules/skybolt/core/config/AppConfig.kt
- FrutSmartP/modules/skybolt/android/src/main/java/expo/modules/skybolt/core/config/AppSettings.kt
- FrutSmartP/modules/skybolt/android/src/main/java/expo/modules/skybolt/core/http/BackendApi.kt
- FrutSmartP/modules/skybolt/android/src/main/java/expo/modules/skybolt/core/bg/UploadWorker.kt
- FrutSmartP/modules/skybolt/android/src/main/java/expo/modules/skybolt/azureblob/runtime/BlobUploader.kt
Entregables
- API pública coherente
- config efectiva, no decorativa
---
Fase 2 - Cerrar recovery y persistencia de configuración
Objetivo
Que el módulo sobreviva reinicios reales y pueda reanudar sin depender de reconfiguración accidental desde JS.
Tareas
2.1 Persistir configuración efectiva
Conectar las piezas ya existentes:
- SettingsPersistence
- DataStoreSettingsPersistence
- AppSettings
Asegurar:
- persistencia al hacer configure()
- restauración al iniciar manager/worker
- validación de versión de config
2.2 Restaurar configuración antes de recovery
Antes de intentar:
- recoverPendingSessions()
- resumeAllPending()
- UploadWorker.doWork()
Debe existir config válida restaurada.
2.3 Resolver recovery tras process death
Escenarios a cubrir:
- app kill con sesión en PREPARING
- app kill con sesión en UPLOADING
- app kill con sesión en PAUSED
- worker reejecutado sin app abierta
- relanzado después de restart del dispositivo
2.4 Persistir transiciones de estado correctas
Hoy el estado de sesión queda ambiguo. Debe quedar claro cuándo pasa a:
- PREPARING
- UPLOADING
- PAUSED
- COMPLETED
- FAILED
- CANCELED
Entregables
- recovery real
- estado persistente consistente
---
Fase 3 - Terminar SkyboltManager
Objetivo
Completar la fachada nativa y cerrar todos los TODOs funcionales.
Tareas
3.1 Implementar listActiveSessions()
En FrutSmartP/modules/skybolt/android/src/main/java/expo/modules/skybolt/core/facade/SkyboltManager.kt:386:
- usar SessionsIndex
- definir qué cuenta como “activa”
- excluir completadas/canceladas/purgadas
- cubrir sesiones UPLOADING y PREPARING según criterio final
3.2 Implementar purgeCompletedSessions()
En FrutSmartP/modules/skybolt/android/src/main/java/expo/modules/skybolt/core/facade/SkyboltManager.kt:442:
- purgar según antigüedad
- eliminar protobuf/datastore reales
- limpiar índices
- limpiar coalescers/cache asociados
- retornar conteo real purgado
3.3 Implementar cleanupTempFiles()
En FrutSmartP/modules/skybolt/android/src/main/java/expo/modules/skybolt/core/facade/SkyboltManager.kt:459:
- definir qué es “temp file” en el módulo
- ubicar directorios reales
- borrar solo archivos seguros de borrar
- no tocar archivos fuente ni datos de sesión
3.4 Corregir listPendingSessions()
Asegurar que no dependa de estados ambiguos y que refleje bien:
- pausa por auth
- pausa por red
- sesiones esperando resume
- sesiones incompletas tras restart
3.5 Corregir emisión de eventos
- evitar doble session:started
- validar session:paused
- validar session:resumed
- validar session:canceled
Entregables
- manager sin stubs
- mantenimiento real implementado
---
Fase 4 - Terminar UploadWorker
Objetivo
Dejar el worker consistente, declarativo y seguro frente a errores reales.
Tareas
4.1 Resolver auth:required completo
En FrutSmartP/modules/skybolt/android/src/main/java/expo/modules/skybolt/core/bg/UploadWorker.kt:301:
- reemplazar el TODO
- reportar todas las sesiones realmente afectadas
- deduplicar sesiones
- alinear con SkyboltManager.handleAuthRequired()
4.2 Corregir modelo de errores fatales
Hoy un error fatal:
- pausa
- emite error:fatal
- y luego hace retry
Eso debe redefinirse. Decidir y aplicar:
- qué errores son retryables
- qué errores son terminales
- qué errores son pausables
- qué errores deben marcar FAILED
4.3 Corregir estados en ausencia de red
Asegurar consistencia entre:
- PAUSED_NETWORK
- Result.failure()
- Result.retry()
- auto-resume por reconexión
4.4 Validar cancelación
Garantizar que cancelar:
- detiene work
- persiste CANCELED
- no relanza worker
- no deja progreso zombie
4.5 Medir y controlar flood de progreso
Revisar:
- FG_UPDATE_INTERVAL_MS
- JS_UPDATE_INTERVAL_MS
- persistencia coalesced
- impacto en batería y UI
Entregables
- worker robusto
- control de errores/retry consistente
---
Fase 5 - Terminar capa de auth y headers
Objetivo
Cerrar seguridad, refresh y compatibilidad real con backend.
Tareas
5.1 Implementar defaultHeaders
Hoy se parsean pero no se usan. Deben inyectarse en:
- requests backend
- rutas de SAS batch/refresh
- cualquier request que dependa de headers custom
5.2 Endurecer AuthManager
Revisar y cerrar:
- refresh concurrente
- limpieza de tokens inválidos
- debounce de auth requerida
- actualización de tokens desde JS
- reanudación automática después de notifyAuthRefreshed()
5.3 Decidir persistencia segura de tokens
Hoy los tokens están en DataStore plano. Hay que elegir:
- cifrado real en esta fase, o
- aceptación explícita temporal con ticket P1
Mi recomendación:
- si se quiere “production-ready” de verdad, esto debe entrar
5.4 Garantizar compatibilidad con bypass flag actual
Como ahora existe bypass de auth en app:
- Skybolt debe tolerar tokens locales de desarrollo
- sin comportamientos raros en refresh/auth-required
Entregables
- auth consistente
- headers configurables efectivos
- postura de seguridad definida
---
Fase 6 - Terminar uploader y planner de Azure
Objetivo
Hacer que el core de upload cumpla su contrato y sus knobs de performance.
Tareas
6.1 Implementar de verdad maxParallelChunks
Hoy se acepta pero no se usa. Hay que decidir:
- chunk upload realmente paralelo, o
- removerlo del contrato público
Mi recomendación:
- implementarlo de verdad, porque está expuesto públicamente
6.2 Conectar retry config al uploader
Eliminar hardcodes efectivos:
- maxRetries = 4
- backoff fijo
- timeouts rígidos cuando deban depender de config
6.3 Conectar azure.serviceVersion
El uploader hoy usa versión hardcoded. Debe venir de config real.
6.4 Conectar azure.sendBlockMd5
Si el flag existe:
- debe gobernar si se envía MD5 por bloque
- documentar impacto de performance/integridad
6.5 Verificar path in-memory vs streaming
Revisar correctness y thresholds:
- pequeños en RAM
- medianos single PUT
- grandes por bloques
6.6 Confirmar reporting de métricas
Asegurar que se registren:
- throughput
- retries
- startedAt
- endedAt
- peakBps
- p95/avg si se decide soportarlo realmente
Entregables
- uploader alineado con configuración
- rendimiento controlable por config
---
Fase 7 - Terminar storage e índices
Objetivo
Evitar corrupción de estado, leaks y housekeeping roto.
Tareas
7.1 Corregir borrado real de sesiones
purgeIfCompletedAndOlderThan() debe borrar archivos reales del DataStore, no paths equivocados.
7.2 Formalizar SessionsIndex
Revisar que el índice soporte:
- create
- touch
- status transitions
- purge
- remove
- recovery scanning
7.3 Cerrar lifecycle de coalescers
Asegurar:
- cleanup periódico real
- closeCoalescer() correcto
- closeAll() correcto
- ausencia de crecimiento indefinido
7.4 Persistir métricas de sesión
Conectar de verdad recordMetrics() y timestamps a:
- start
- retry
- completion
- failure
- cancel
Entregables
- storage confiable
- índices mantenibles
- housekeeping correcto
---
Fase 8 - Simplificar y unificar la capa React/Expo
Objetivo
Evitar duplicación y bugs de estado en la interfaz JS del módulo.
Tareas
8.1 Elegir una sola abstracción de consumo React
Hoy existen:
- FrutSmartP/modules/skybolt/src/useSkybolt.ts
- FrutSmartP/modules/skybolt/src/SkyboltNativeUploadProvider.tsx
Hay que decidir:
- dejar solo una, o
- separar claramente sus responsabilidades
8.2 Corregir filtrado de eventos por sesión
Si el hook permanece:
- no debe mezclar eventos de sesiones distintas
8.3 Alinear surface pública del módulo
index.ts debe exportar solo lo que realmente se sostiene a largo plazo.
8.4 Reconciliar nombres y estados
Unificar:
- canceled/cancelled
- pending/preparing/uploading
- razones de pausa
Entregables
- capa React limpia
- menor riesgo de integración confusa
---
Fase 9 - Resolver iOS de forma honesta
Opción recomendada: cerrar Android y de-scope iOS
Tareas
- sacar apple de metadata si no se implementa
- corregir README
- corregir podspec placeholder o retirarlo si no aplica
- evitar falsas expectativas de soporte
Opción alternativa: implementar iOS
Trabajo mínimo
- parity de API con SkyboltModule.ts
- auth
- session storage
- background uploads
- event bridge
- pending/recovery
- maintenance APIs
> Mi recomendación sigue siendo no meter esto en la misma iteración.
---
# Fase 10 - Suite de pruebas obligatoria
## Objetivo
Cerrar el módulo con evidencia, no por feeling.
## 10.1 JS/TS
Cubrir:
- `toUploadEvent()`
- guardas de módulo no instalado
- conversiones de payload
- ramas de error
## 10.2 JVM unit tests
Cubrir:
- `AuthManager`
- `Retry`
- `SessionRepository`
- `BlobUploadDriver`
- partes puras de `BlobUploader`
## 10.3 Android integration tests
Cubrir:
- `UploadWorker`
- `SkyboltManager`
- recovery
- pause/resume/cancel
- auth required
- SAS refresh
- retries
## 10.4 Perf y memoria
Medir:
- configure
- initializeSession
- startSession
- throughput por tamaños
- crecimiento de memoria
- writes a DataStore
- restart/recovery latency
## 10.5 Contract tests
Validar:
- batch SAS
- refresh SAS
- headers auth
- mapping de errores backend
- consistencia de `blobName` y `clientItemId`
---
Priorización sugerida
P0 - Bloqueantes antes de release
- contrato TS/runtime alineado
- persistencia/restauración de config
- listActiveSessions() implementado
- purgeCompletedSessions() implementado
- cleanupTempFiles() implementado
- auth:required completo
- defaultHeaders efectivos
- endpoints configurables efectivos
- retry config efectiva
- serviceVersion/sendBlockMd5 efectivos o removidos del contrato
- tests unitarios/integración críticos verdes
P1 - Hardening fuerte
- maxParallelChunks real
- métricas persistidas de verdad
- coalescer cleanup verificado
- cifrado de tokens
- deduplicación/limpieza de eventos
- unificación React layer
P2 - Post-release o epic separado
- iOS completo
- benchmarking avanzado
- macrobenchmarks
- dashboards de telemetría más ricos
---
Orden recomendado de ejecución
1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 3
5. Fase 4
6. Fase 5
7. Fase 6
8. Fase 7
9. Fase 8
10. Fase 10
11. Fase 9 solo si decides implementar iOS
---
Checklist explícito de TODOs a cerrar
- [ ] listActiveSessions() deja de devolver vacío
- [ ] purgeCompletedSessions() deja de devolver 0
- [ ] cleanupTempFiles() deja de devolver 0
- [ ] pendingSessions de auth:required deja de ser parcial
- [ ] recovery tras restart ya no depende de config volátil
- [ ] defaultHeaders se aplican realmente
- [ ] backend.endpoints.* gobierna requests reales
- [ ] retry.* gobierna retries reales
- [ ] azure.serviceVersion gobierna requests reales
- [ ] azure.sendBlockMd5 gobierna comportamiento real
- [ ] maxParallelChunks se implementa o se retira del contrato
- [ ] no hay doble session:started
- [ ] no hay ambigüedad cancelled/canceled
- [ ] iOS queda implementado o explícitamente fuera de scope
---
Definición de terminado
Skybolt queda “cerrado” cuando:
- no hay TODOs funcionales en APIs públicas
- Android funciona con recovery, auth, retry y maintenance reales
- tests obligatorios están verdes
- performance/memoria tienen baseline aceptable
- README y metadata dicen la verdad
- iOS no engaña: o existe de verdad, o no se anuncia
Si quieres, el siguiente paso te lo convierto en un backlog ejecutable de implementación, archivo por archivo, empezando por los P0.