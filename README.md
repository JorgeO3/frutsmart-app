# FrutSmart

Repositorio principal de FrutSmart. Contiene:

- `mobile-client/apps/frutsmart-field`: aplicación móvil de campo.
- `mobile-client/apps/frutsmart-plant`: aplicación móvil de planta.
- `server`: API backend, catálogos, evaluaciones e ingestión/upload.
- `mobile-client/packages/nano-rt`: módulo nativo de inferencia local.
- `mobile-client/packages/skybolt`: módulo nativo de cargas resilientes a Azure Blob Storage.
- `mobile-client/packages/chart-forge`: módulo nativo de generación de gráficos raster.

Este documento es la referencia operativa y arquitectónica de primer nivel del proyecto.

## 1. Objetivo del sistema

FrutSmart es una plataforma móvil + backend para captura, clasificación, sincronización y explotación de información operativa relacionada con fruta.

En esta revisión del repositorio, el sistema se compone de:

- inferencia local en dispositivo con `nano-rt`;
- sincronización de archivos y sesiones de carga con `skybolt`;
- generación local de gráficos para reportes con `chart-forge`;
- persistencia local en las apps móviles;
- backend modular para catálogos, evaluaciones y gestión de sesiones de upload;
- almacenamiento de blobs en Azure Blob Storage o Azurite en desarrollo local.

## 2. Mapa del repositorio

```text
frutsmart/
├── mobile-client/
│   ├── apps/
│   │   ├── frutsmart-field/
│   │   └── frutsmart-plant/
│   ├── packages/
│   │   ├── nano-rt/
│   │   ├── skybolt/
│   │   └── chart-forge/
│   └── README.md
├── server/
│   ├── src/
│   │   ├── health/
│   │   ├── modules/
│   │   │   ├── catalog/
│   │   │   ├── evaluation/
│   │   │   └── upload/
│   │   └── platform/
│   ├── docker-compose.yml
│   └── justfile
├── package.json
└── bun.lock
```

## 3. Arquitectura general

### 3.1 Vista funcional de alto nivel

1. Las apps móviles capturan imágenes, datos operativos y acciones del usuario.
2. `nano-rt` ejecuta inferencia local en Android para clasificación y segmentación.
3. Los resultados y entidades de negocio se persisten localmente en SQLite.
4. Cuando corresponde, la app crea un job de upload y delega la transferencia binaria a `skybolt`.
5. `skybolt` solicita SAS al backend, sube archivos directo a Azure Blob Storage o Azurite y reporta progreso/eventos nativos.
6. El backend expone endpoints para:
   - catálogos;
   - creación/finalización de sesiones de upload;
   - emisión/refresco de SAS;
   - creación de evaluaciones.
7. `chart-forge` se usa para generar gráficos nativos que luego se insertan en reportes HTML/PDF.

### 3.2 Topología lógica end-to-end

El sistema completo está compuesto por cuatro planos:

- plano cliente:
  - `frutsmart-field`
  - `frutsmart-plant`
- plano nativo compartido:
  - `nano-rt`
  - `skybolt`
  - `chart-forge`
- plano de aplicación backend:
  - API NestJS
  - gateway de autenticación local para desarrollo
  - NocoDB como superficie administrativa en Azure
- plano de datos e infraestructura:
  - PostgreSQL
  - Azure Blob Storage o Azurite
  - Redis
  - Key Vault
  - API Management
  - Container Apps
  - VNet, subredes, Private Endpoints y observabilidad

### 3.3 Arquitectura local de desarrollo

En local, el repositorio no replica exactamente la topología cloud, pero conserva los contratos funcionales críticos:

- las apps móviles hablan con el backend local por HTTP;
- la autenticación puede pasar por `server/scripts/dev-auth-gateway.ts`;
- el backend corre en `localhost:3000`;
- el gateway de desarrollo corre por defecto en `localhost:4100`;
- PostgreSQL, Redis y Azurite se levantan con `docker-compose.yml`;
- Azurite puede operar por HTTPS con certificados locales para simular el flujo real de SAS + upload directo.

#### Diagrama ASCII local

```text
                          DESARROLLO LOCAL

┌───────────────────────────────────────────────────────────────────────┐
│ Android device / emulator                                             │
│                                                                       │
│  frutsmart-field / frutsmart-plant                                    │
│   ├─ Expo Router UI                                                   │
│   ├─ SQLite local                                                     │
│   ├─ nano-rt  -> inferencia local                                     │
│   ├─ chart-forge -> charts/reportes                                   │
│   └─ skybolt -> uploads nativos                                       │
└──────────────┬────────────────────────────────────────────────────────┘
               │
               │ HTTP auth/dev API
               v
┌───────────────────────────────────────────────────────────────────────┐
│ Dev Auth Gateway (`server/scripts/dev-auth-gateway.ts`)               │
│  ├─ emula discovery/OIDC                                              │
│  ├─ acepta bearer de bypass local                                     │
│  └─ proxya `/api/*` al backend real                                   │
└──────────────┬────────────────────────────────────────────────────────┘
               │
               │ HTTP
               v
┌───────────────────────────────────────────────────────────────────────┐
│ Backend NestJS (`server`)                                             │
│  ├─ health                                                            │
│  ├─ catalog                                                           │
│  ├─ evaluation                                                        │
│  └─ upload                                                            │
│     ├─ crea sesiones                                                  │
│     ├─ emite SAS                                                      │
│     └─ cierra uploads                                                 │
└───────┬─────────────────────┬─────────────────────────┬───────────────┘
        │                     │                         │
        │ SQL                 │ Redis                   │ Azure Blob API
        v                     v                         v
┌──────────────┐     ┌────────────────┐       ┌─────────────────────────┐
│ PostgreSQL   │     │ Redis          │       │ Azurite HTTPS           │
│ Docker       │     │ Docker         │       │ 10000/10001/10002       │
└──────────────┘     └────────────────┘       └─────────────────────────┘
                                                     ^
                                                     │
                                                     │ HTTPS directo con SAS
                                                     │ desde `skybolt`
                                                     │
                                           ┌─────────┴─────────┐
                                           │ Android app       │
                                           │ requiere confiar  │
                                           │ en la CA local    │
                                           └───────────────────┘
```

#### Propiedades operativas del entorno local

- El gateway local no es un backend alternativo; es una capa de emulación de Easy Auth/OIDC para desarrollo.
- El upload binario sigue siendo directo desde el dispositivo al blob store emulado, no a través del backend.
- Los problemas TLS con Azurite afectan al dispositivo Android, no necesariamente al backend Node.
- La persistencia local y la inferencia local permiten trabajar aun si el backend no está disponible temporalmente.

### 3.4 Arquitectura objetivo en Azure

La definición de infraestructura deployable presente en el repositorio está en `server/terraform/frutsmart.tf`.

`server/terraform/architecture.tf` existe como referencia comentada/auxiliar, pero la topología efectiva y consumible para documentación de producción es la de `frutsmart.tf`.

#### Componentes de infraestructura declarados

- `Resource Group`
- presupuesto mensual de suscripción
- `Log Analytics Workspace`
- `Virtual Network`
- subred `snet-ca` para `Container Apps Environment`
- subred `snet-pe` para `Private Endpoints`
- subred `snet-pg` delegada para `PostgreSQL Flexible Server`
- `Network Security Group` aplicado a `snet-ca`
- `Container Apps Environment`
- `Azure AD / Entra External ID` applications:
  - API protegida
  - cliente OIDC de NocoDB
- `PostgreSQL Flexible Server` privado
- `Storage Account` con contenedor privado `uploads`
- `Storage Management Policy` para tiering
- `Key Vault` con RBAC
- `Azure Managed Redis`
- dos `Container Apps`:
  - API NestJS
  - NocoDB
- `API Management` en modo `Consumption`
- `Diagnostic Settings`
- `Azure Policy` para restringir SKUs de storage

#### Estado del Terraform y alcance documental

- `server/terraform/frutsmart.tf` describe con claridad la topología de red, seguridad, observabilidad y plataformas base del despliegue.
- Ese archivo también declara las `Container Apps`, pero en esta revisión la app de API usa una imagen placeholder (`nginxdemos/hello:plain-text`) con comentario de reemplazo.
- En consecuencia, este README debe leerse así:
  - la arquitectura de infraestructura Azure sí está reflejada por código;
  - el wiring exacto de la imagen final del backend y parte de su configuración de runtime productiva todavía requiere ajuste o externalización adicional fuera de este archivo.
- Esto no invalida la arquitectura; sí impide afirmar que el Terraform actual, por sí solo, ya deja desplegada la imagen definitiva del backend de negocio.

#### Diagrama ASCII de producción

```text
                             PRODUCCION / AZURE

                            Internet / Usuarios
                                     │
                                     │ HTTPS
                                     v
                    ┌───────────────────────────────────┐
                    │ Cloudflare (opcional)             │
                    │ mTLS hacia APIM si está activado  │
                    └────────────────┬──────────────────┘
                                     │
                                     │ HTTPS
                                     v
                    ┌───────────────────────────────────┐
                    │ Azure API Management              │
                    │ - JWT validation con B2C/External │
                    │ - rate limiting                   │
                    │ - security headers                │
                    │ - backend routing                 │
                    └───────────────┬───────────┬───────┘
                                    │           │
                         /api/*     │           │   /nocodb/*
                                    │           │
                                    v           v
                 ┌───────────────────────┐   ┌───────────────────────┐
                 │ Container App: API    │   │ Container App: NocoDB │
                 │ NestJS + Easy Auth    │   │ admin / OIDC          │
                 │ ingress mTLS required │   │ ingress mTLS required │
                 └───────────┬───────────┘   └───────────┬───────────┘
                             │                           │
                             │ Managed Identity          │ Managed Identity
                             │                           │
          ┌──────────────────┼───────────────┬───────────┼──────────────────┐
          │                  │               │           │                  │
          v                  v               v           v                  v
┌─────────────────┐  ┌───────────────┐  ┌───────────┐  ┌───────────────┐  ┌─────────────────┐
│ Key Vault       │  │ Blob Storage  │  │ Postgres  │  │ Managed Redis │  │ Log Analytics   │
│ secrets + RBAC  │  │ uploads + SAS │  │ private   │  │ private       │  │ diagnostics     │
└────────┬────────┘  └──────┬────────┘  └─────┬─────┘  └──────┬────────┘  └─────────────────┘
         │                  │                 │               │
         │ Private Endpoint │ Private Endpoint│ Delegated     │ Private Endpoint
         │                  │                 │ subnet        │
         └──────────────────┴─────────────────┴───────────────┘
                                inside VNet

                 VNet 10.40.0.0/16
                 ├─ snet-ca : Container Apps Environment
                 ├─ snet-pe : Private Endpoints
                 └─ snet-pg : PostgreSQL Flexible delegated subnet

Mobile apps:
  1. llaman `/api/*` via APIM para negocio y SAS
  2. suben blobs directo al Storage Account mediante SAS
  3. no atraviesan APIM para el plano binario de upload
```

#### Plano de tráfico en producción

El tráfico se separa en dos rutas distintas:

- ruta de control:
  - app móvil -> APIM -> API NestJS
  - incluye autenticación, catálogos, evaluaciones, creación/finalización de sesiones y emisión de SAS
- ruta de datos binarios:
  - app móvil -> Azure Blob Storage con SAS
  - evita hacer proxy de archivos a través del backend

Esta separación es estructural, no incidental. La API coordina y autoriza; `skybolt` transfiere binarios directamente al storage.

#### Seguridad de borde y autenticación

- APIM valida JWT contra el `well-known` de Entra External ID / B2C.
- APIM aplica rate limit, `content-length` máximo y headers defensivos.
- APIM enruta a dos backends:
  - API
  - NocoDB
- Las dos `Container Apps` exigen certificado cliente en ingress (`client_certificate_mode = "require"`).
- APIM presenta un certificado cliente PFX configurado en Terraform para hablar por mTLS con ambos backends.
- De forma opcional, Cloudflare puede quedar delante de APIM con validación de certificado cliente hacia APIM.
- La API además declara `authConfigs` de Container Apps para integración tipo Easy Auth con proveedor OpenID Connect personalizado.

#### Seguridad este-oeste y datos privados

- PostgreSQL no expone acceso público.
- Key Vault tiene RBAC habilitado y puede desactivar `publicNetworkAccess` al final del despliegue.
- Redis no expone acceso público.
- Storage mantiene `public_network_access_enabled = true` porque las apps móviles suben directo con SAS.
- Aun así, el Storage Account también tiene `Private Endpoint`, lo que permite consumo privado desde cargas internas dentro de la VNet.
- Los secretos operativos críticos se resuelven desde Key Vault hacia las Container Apps mediante Managed Identity.

#### Observabilidad y control de costos

- presupuesto mensual a nivel de suscripción con umbrales de alerta;
- `Log Analytics Workspace` central;
- `Diagnostic Settings` para:
  - APIM
  - Storage
  - PostgreSQL
  - Container Apps Environment
- política de lifecycle sobre blobs antiguos;
- política Azure para restringir SKUs permitidos de Storage.

### 3.5 Principios de diseño visibles en el código y en Terraform

- Monorepo móvil con Bun workspaces.
- Apps Expo/React Native con Expo Router.
- Backend NestJS modular, con separación por contexto de negocio.
- Módulos nativos empaquetados como paquetes compartidos.
- Upload desacoplado entre:
  - coordinación de negocio en JS;
  - ejecución binaria robusta en código nativo Android;
  - emisión de SAS y verificación del lado servidor.
- Separación explícita entre:
  - control plane vía API/APIM;
  - data plane binario vía Blob Storage.
- Infraestructura cloud declarativa con Terraform y controles de red privados para dependencias servidor-servidor.

## 4. Componentes principales

## 4.1 `mobile-client`

`mobile-client` es un workspace Bun con cinco paquetes:

- `apps/frutsmart-field`
- `apps/frutsmart-plant`
- `packages/skybolt`
- `packages/nano-rt`
- `packages/chart-forge`

### Tecnologías base

- Bun como package manager del monorepo móvil.
- Expo SDK 55.
- React 19.
- React Native 0.83.
- Expo Router.
- Expo SQLite.
- Reanimated 4.
- FlashList.

### Comando base del workspace

```bash
cd mobile-client
bun install
```

## 4.2 App móvil `frutsmart-field`

Aplicación enfocada en trabajo de campo.

### Stack

- Expo Router
- React Native / Hermes / New Architecture
- `nano-rt`
- `skybolt`
- `chart-forge`
- Expo SQLite
- Sentry

### Identidad de app

- Android package: `com.anonymous.frutosmart`
- iOS bundle identifier: `com.anonymous.frutosmart`
- Expo Updates project id: `e0ae12af-d933-4ef8-8d73-3287e88f5f2e`
- Scheme: `myapp`

### Estructura funcional visible

Áreas principales bajo `src/`:

- `app/auth`: login y flujo de autenticación.
- `app/onboard`: introducción/onboarding.
- `app/field-work`: flujo principal de trabajo de campo.
- `services/uploads`: pipeline activo de uploads v2.
- `services/report-generator`: generación de reportes.
- `services/persistence`: acceso y coordinación de persistencia local.
- `providers`: bootstrap de storage y uploads.
- `stores`: estado de trabajo de campo.

### Comportamiento de arranque

En el layout raíz:

- primero espera a que la app cargue assets;
- inicializa `nano-rt` vía `useNanoRTReady()`;
- solo después de mostrar la app principal inicializa el sistema de uploads.

Esto evita competir en el arranque entre warmup de inferencia y auto-recuperación de uploads.

### Uso de módulos nativos

- `nano-rt`
  - `classifyFieldExternal`
  - `classifyFieldInternal`
- `skybolt`
  - provider global de uploads
  - orquestador de jobs
  - cálculo de MD5
  - recuperación/reanudación de sesiones
- `chart-forge`
  - se usa en `services/report-generator/strategies/summary`
  - genera pie charts nativos para insertar en reportes

### Reportes

La app genera reportes resumen a partir de datos locales:

- consulta agregados por lote;
- genera gráficos nativos con `chart-forge`;
- arma HTML;
- usa assets locales;
- produce documento final para impresión/compartición.

### Upload pipeline activo

La app de campo usa el pipeline activo bajo:

- `src/services/uploads`

Ese paquete exporta:

- store de jobs;
- machine/interpreter;
- `UploadServiceV2`;
- `UploadOrchestrator`;
- `NativeUploadAdapter`.

### Comandos frecuentes

```bash
cd mobile-client/apps/frutsmart-field
just setup
just start_native
just prebuild_android
just lint
just ts_check
```

### Canales EAS

- `development`
- `preview`
- `production`

## 4.3 App móvil `frutsmart-plant`

Aplicación enfocada en trabajo de planta.

### Stack

- Expo Router
- React Native / Hermes
- `nano-rt`
- `skybolt`
- Expo SQLite

### Identidad de app

- Android package: `com.anonymous.FrutSmartP`
- Expo Updates project id: `a0cc6158-193a-4660-a1e3-3756d9b8e534`
- Scheme: `frutsmartp`

### Estructura funcional visible

Áreas principales bajo `src/`:

- `app/auth`
- `app/onboard`
- `app/plant-work`
- `services/uploads-v2`: pipeline activo de uploads
- `services/uploads-v1`: pipeline legado aún presente
- `services/uploads`: código legado/migratorio adicional
- `providers`
- `stores`

### Estado actual del pipeline de uploads

En esta revisión:

- el provider raíz usa `@services/uploads-v2`;
- `uploads-v2` es la ruta activa para nuevas integraciones;
- `uploads-v1` y código legado siguen presentes como superficie histórica/migratoria.

Esto es importante para mantenimiento: no todo lo que está en `src/services/uploads*` está activo al mismo tiempo.

### Uso de módulos nativos

- `nano-rt`
  - `classifyPlantExternal`
  - `classifyFieldInternal` en la ruta interna actual del código
- `skybolt`
  - provider global de uploads
  - recuperación de jobs
  - coordinación de sesiones nativas
  - suite de tests y smoke gates dedicados

### Testing especializado

`frutsmart-plant` concentra la mayor parte de la automatización visible sobre `skybolt` y `nano-rt`, con recipes de `just` para:

- JS tests de Skybolt
- JVM unit tests
- Android integration tests
- uploader-focused tests
- contract tests
- smoke gates
- perf/soak/stability
- gates dedicados de `nano-rt`

### Comandos frecuentes

```bash
cd mobile-client/apps/frutsmart-plant
just setup
just start_native
just skybolt_test_js
just skybolt_test_jvm
just nanort_phase14_gate
```

### Canales EAS

- `development`
- `preview`
- `production`

## 4.4 Paquete `mobile-client/packages/nano-rt`

Módulo nativo compartido para inferencia local.

### Rol

Ejecuta clasificación/segmentación en Android y devuelve:

- ítems segmentados;
- URI de salidas;
- confidencias por clase.

### API pública visible

- `NativeNanoRT`
- `useNanoRT()`
- `useNanoRTReady()`
- `NanoRTClassifier`
- `NanoRTError`

### Métodos de clasificación expuestos

- `classifyPlantExternal(imageUri)`
- `classifyPlantInternal(imageUri)`
- `classifyFieldExternal(imageUri)`
- `classifyFieldInternal(imageUri)`

### Características funcionales

- inicialización explícita del módulo;
- eventos `onReady` y `onInitError`;
- guardas de disponibilidad del módulo nativo;
- timeout configurable a nivel de wrapper JS;
- normalización de errores a `NanoRTError`.

### Patrón de uso

1. bootstrap de módulo con `useNanoRTReady()`;
2. verificación de `ready`;
3. ejecución de `NanoRTClassifier.classify*`;
4. persistencia de segmentos/resultados en stores locales.

### Plataforma

El paquete incluye `android/` y no incluye implementación iOS versionada en este repositorio. Operativamente debe tratarse como Android-first/Android-only en esta revisión.

### Consideraciones

- El hook `useNanoRTReady()` vive realmente dentro de `useNanoRT.ts`.
- `src/nano-rt/useNanoRTReady.ts` está vacío en esta revisión; no es el entrypoint funcional del hook.
- La disponibilidad real depende de que la app haya sido compilada con el módulo nativo enlazado.

## 4.5 Paquete `mobile-client/packages/skybolt`

Módulo nativo compartido para uploads resilientes a Azure Blob Storage.

### Rol

`skybolt` abstrae la transferencia de archivos desde el dispositivo hacia Blob Storage, desacoplando:

- sesión de upload;
- autenticación;
- SAS acquisition/refresh;
- progreso y reintentos;
- recuperación de sesiones pendientes;
- housekeeping de archivos temporales.

### API pública visible

Configuración:

- `configure(settings)`

Gestión de sesiones:

- `initializeSession(config)`
- `startSession(sessionId)`
- `pauseSession(sessionId)`
- `resumeSession(sessionId)`
- `cancelSession(sessionId)`

Consultas:

- `getSessionProgress(sessionId)`
- `listActiveSessions()`
- `listPendingSessions()`
- `resumeAllPending()`

Auth:

- `setAuthTokens(tokens)`
- `getValidAccessToken()`
- `notifyAuthRefreshed()`
- `clearAuthTokens()`

Utilidades:

- `extractMD5FromFiles(fileUris)`
- `purgeCompletedSessions()`
- `cleanupTempFiles()`

Hooks/UI:

- `useSkybolt()`
- `SkyboltNativeUploadProvider`

### Configuración esperada

`CloudUploadSettings` define:

- `version`
- `environment`
- `backend.baseUrl`
- `backend.endpoints.sasBatchPath`
- `backend.endpoints.sasRefreshPath`
- `backend.auth.*`
- `azure.serviceVersion`
- `azure.sendBlockMd5`
- `azure.defaultChunkBytes`
- límites de concurrencia
- política de retry

### Eventos relevantes

La capa JS tipa y traduce eventos nativos como:

- `session:started`
- `session:resumed`
- `session:paused`
- `session:completed`
- `session:failed`
- `item:completed`
- `item:failed`
- `error:network`
- `error:rate-limited`
- `error:throttled`
- `error:forbidden`
- `error:contract`
- `error:checksum`
- `error:file-access`
- `auth:required`

### Integración app-side

En ambas apps, el paquete no se usa aislado; se envuelve en:

- stores locales de jobs;
- máquina de estados de upload;
- orquestador;
- adapter de eventos nativos;
- repositorios SQLite.

### Flujo nominal

1. La app calcula MD5 y prepara items.
2. El backend crea una sesión.
3. `skybolt` solicita `sas-batch`.
4. El módulo nativo sube blobs directo al storage.
5. La app recibe progreso/eventos.
6. El backend finaliza la sesión con `/complete`.

### Plataforma

El paquete incluye `android/` y no incluye implementación iOS versionada en este repositorio.

### Riesgos operativos observables

- la confianza TLS hacia Azurite en Android depende de `networkSecurityConfig` y/o de la instalación de la CA local;
- el pipeline depende de configuración correcta de `apiBaseUrl`, `easyAuthBaseUrl` y SAS emitidas por el backend;
- el consumo real no es el hook `useSkybolt()` genérico, sino los providers/orquestadores app-specific.

## 4.6 Paquete `mobile-client/packages/chart-forge`

Módulo nativo para generar imágenes de gráficos, actualmente orientado a pie charts.

### Rol

Renderiza un gráfico nativo, lo serializa a imagen y devuelve una URI:

- `content://`
- o `file://`

### API pública visible

- `generatePieChart(config)`

### Contrato `ChartConfig`

Campos principales:

- `id`
- `width`
- `height`
- `data[]`
  - `value`
  - `label`
  - `color`
- `format`
  - `WEBP`
  - `PNG`
  - `JPEG`
- `quality`
- `uriType`
  - `content`
  - `file`

### Validaciones JS previas al cruce nativo

- `id` seguro para nombre de archivo;
- dimensiones positivas;
- al menos un datapoint;
- colores hex válidos;
- calidad en rango;
- formatos soportados.

### Uso actual en el repositorio

Solo se observa integración directa en `frutsmart-field` para generación de gráficos de reportes.

### Plataforma

El paquete incluye `android/` y no incluye implementación iOS versionada en este repositorio.

## 4.7 `server`

Backend principal de FrutSmart, implementado con NestJS sobre Fastify.

### Tecnologías

- NestJS 11
- Fastify
- TypeORM
- PostgreSQL
- Redis
- Azure Blob Storage SDK
- Swagger/OpenAPI
- Pino
- Bun para scripts y ejecución local

### Módulos cargados en `AppModule`

- `HealthModule`
- `CatalogModule`
- `UploadModule`
- `EvaluationModule`
- `PlatformModule`

### Estructura de plataforma

La carpeta `server/src/platform` concentra infraestructura transversal:

- `config`
- `database`
- `http`
- `integrations/azure`
- `logging`

### Contextos de negocio

#### `catalog`

Responsable de entidades maestras consultables/creables vía HTTP:

- models
- programs
- lots
- centers
- providers
- sub-providers

#### `upload`

Responsable de:

- crear sesiones de upload;
- emitir SAS batch;
- refrescar SAS;
- completar sesión.

Endpoints relevantes:

- `POST /api/v1/upload/sessions`
- `POST /api/v1/upload/sessions/:sessionId/sas-batch`
- `POST /api/v1/upload/sessions/:sessionId/sas/refresh`
- `POST /api/v1/upload/sessions/:sessionId/complete`

#### `evaluation`

Expone creación de evaluaciones completas en una sola operación:

- `POST /api/v1/evaluations`

#### `health`

Endpoints públicos:

- `GET /health`
- `GET /health/ready`
- `GET /health/live`

### Seguridad visible

- prefijo global `api/v1`, con exclusión de `health`;
- `helmet`, compresión y rate limit configurable;
- `upload` protegido con `ApiKeyGuard`;
- `catalog` y `evaluation` documentan bearer/dev auth;
- validación fuerte de DTOs con `ValidationPipe`.

### Swagger

En entorno no producción, expone:

- `/docs`
- `/docs-json`
- `/docs-yaml`

### Persistencia e infraestructura local

`docker-compose.yml` define:

- PostgreSQL
- Azurite
- Redis
- Adminer

### Azure / Azurite

La integración Azure:

- soporta `AZURE_STORAGE_ACCOUNT_URL`;
- soporta `AZURE_STORAGE_PUBLIC_BASE_URL`;
- maneja contenedores separados por dominio (`plant`, `field`);
- genera SAS con TTL configurable;
- usa `HttpsAndHttp` para Azurite cuando detecta host local.

### Gateway de autenticación local

El script `server/scripts/dev-auth-gateway.ts` implementa un gateway OIDC de desarrollo que:

- emite access token / id token / refresh token;
- publica discovery local;
- proxya requests `/api` al backend real;
- construye `client principal` para emular EasyAuth;
- sirve como sustituto de B2C/EasyAuth en desarrollo local.

Comando:

```bash
cd server
bun run start-auth-gateway
```

## 5. Flujos principales

## 5.1 Flujo de inferencia local

1. El usuario captura o selecciona una imagen.
2. La app verifica que `nano-rt` esté listo.
3. Se ejecuta la clasificación adecuada según dominio y tipo de foto.
4. Se reciben segmentos y confidencias.
5. La app:
   - compacta el raw;
   - persiste/actualiza estado local;
   - continúa el flujo de negocio.

## 5.2 Flujo de upload resiliente

1. La app crea un job de upload desde un analysis o entidad equivalente.
2. El orquestador crea la sesión backend.
3. El backend devuelve blob paths/metadata.
4. `skybolt` solicita SAS batch.
5. El módulo nativo sube archivos directo al blob store.
6. La app observa progreso mediante store + eventos.
7. Si fallan credenciales o red:
   - puede pausar;
   - reanudar;
   - refrescar auth;
   - reintentar.
8. El backend recibe `complete` y cierra la sesión.

## 5.3 Flujo de reportes en `frutsmart-field`

1. La app consulta agregados locales por fecha/lote.
2. Construye datasets para gráficos.
3. `chart-forge` genera imágenes de pie charts.
4. El report generator arma HTML.
5. Se embeben assets y charts.
6. El resultado final se imprime/compone/comparte desde la app.

## 6. Requisitos de entorno

## 6.1 Requisitos generales

- Bun `>= 1.3.x`
- Node.js instalado para tooling adyacente
- Java 21 para builds Android/Gradle observadas en los `justfile`
- Android SDK / dispositivo o emulador
- Docker y Docker Compose
- `just`
- `watchman` recomendado para workflows móviles

## 6.2 Requisitos específicos del backend

- Docker activo para PostgreSQL/Redis/Azurite/Adminer
- certificados locales de Azurite si se trabaja con HTTPS

## 6.3 Requisitos específicos móviles

- development builds de Expo, no Expo Go, para módulos nativos
- device/emulator Android con soporte para los paquetes nativos enlazados

## 7. Configuración de entornos

## 7.1 Backend

Archivos presentes:

- `server/.env.local`
- `server/.env.development`
- `server/.env.production`

Familias de variables visibles en el código:

- aplicación
- base de datos
- Redis
- JWT
- rate limiting
- CORS
- correo
- logging
- Swagger
- Azure Storage / Azurite
- seguridad por API key

Variables especialmente relevantes:

- `BACKEND_PORT`
- `BACKEND_API_PREFIX`
- `BACKEND_DATABASE_*`
- `BACKEND_REDIS_*`
- `BACKEND_CORS_ORIGINS`
- `AZURE_STORAGE_ACCOUNT_URL`
- `AZURE_STORAGE_PUBLIC_BASE_URL`
- `AZURE_STORAGE_CONTAINER_PLANT`
- `AZURE_STORAGE_CONTAINER_FIELD`
- `AZURE_STORAGE_SAS_TTL_MINUTES`
- `INTERNAL_API_SECRET`

No se deben documentar ni compartir secretos reales en el README.

## 7.2 Apps móviles

Las dos apps usan `app.config.ts` para inyectar:

- `appEnv`
- `apiBaseUrl`
- `easyAuthBaseUrl`
- `oidc`
- feature flags

Entornos lógicos:

- `local`
- `dev`
- `staging`
- `prod`

Variables públicas relevantes:

- `EXPO_PUBLIC_ENV_NAME`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_EASYAUTH_BASE_URL`
- `EXPO_PUBLIC_CLIENT_ID`
- `EXPO_PUBLIC_OIDC_API_SCOPE`
- `EXPO_PUBLIC_TENANT_DOMAIN`
- `EXPO_PUBLIC_B2C_POLICY`
- `EXPO_PUBLIC_EASYAUTH_OPENID_CONFIG_URL`
- `EXPO_PUBLIC_AUTH_ENABLED`
- `EXPO_PUBLIC_UPLOAD_JOB_DELETE_ENABLED`

## 8. Arranque local recomendado

## 8.1 Instalar dependencias

Raíz:

```bash
cd /ruta/a/frutsmart
bun install
```

Mobile workspace:

```bash
cd mobile-client
bun install
```

Backend:

```bash
cd server
bun install
```

## 8.2 Levantar backend y servicios auxiliares

```bash
cd server
just db-up
bun run start:dev
```

Si necesitas autenticación de desarrollo:

```bash
cd server
bun run start-auth-gateway
```

## 8.3 Preparar Azurite HTTPS

El repositorio incluye script para certificados locales:

```bash
cd server
bun run azurite:certs
```

Puntos críticos:

- el backend usa `NODE_EXTRA_CA_CERTS` en scripts `start:dev` y `start:debug`;
- Android necesita confiar en esa CA si se sube a Azurite por HTTPS;
- para apps móviles con certificados locales de usuario, Android debe tener `networkSecurityConfig` adecuado.

## 8.4 Levantar app `frutsmart-field`

```bash
cd mobile-client/apps/frutsmart-field
just setup
just prebuild_android
just start_native
```

## 8.5 Levantar app `frutsmart-plant`

```bash
cd mobile-client/apps/frutsmart-plant
just setup
just prebuild_android
just start_native
```

## 9. Build y distribución

## 9.1 Apps móviles

Ambas apps usan EAS y definen perfiles:

- `development`
- `preview`
- `production`

Comandos típicos:

```bash
cd mobile-client/apps/frutsmart-field
eas build --platform android --profile production
```

```bash
cd mobile-client/apps/frutsmart-plant
eas build --platform android --profile production
```

Los `justfile` también incluyen wrappers para builds locales y remotos.

## 9.2 Backend

Compilación:

```bash
cd server
bun run build
```

Ejecución producción:

```bash
cd server
bun run start:prod
```

## 10. Testing y calidad

## 10.1 Backend

Scripts visibles:

- `test:unit`
- `test:int`
- `test:e2e`
- `test:all`
- `lint`
- `check`

## 10.2 `frutsmart-field`

Capacidades visibles:

- `expo lint`
- `jest`
- `biome`
- chequeos TypeScript vía `just ts_check`

## 10.3 `frutsmart-plant`

Además de lint/tests base, concentra la mayor instrumentación para módulos nativos:

- Skybolt JS tests
- Skybolt JVM tests
- Android integration tests
- benchmark/perf/soak/stability
- contract tests
- smoke gates
- NanoRT phase gates

## 11. Consideraciones de plataforma

## 11.1 Android

Android es la plataforma principal para:

- `nano-rt`
- `skybolt`
- `chart-forge`

Las apps móviles usan módulos nativos empaquetados y necesitan builds nativos.

## 11.2 iOS

Aunque las apps Expo declaran configuración iOS, en esta revisión los tres paquetes nativos compartidos solo incluyen árbol `android/`. No debe asumirse paridad funcional de iOS sin una implementación nativa verificada.

## 11.3 Web

Las apps Expo mantienen configuración web, pero las capacidades dependientes de módulos nativos Android no deben asumirse disponibles en web.

## 12. Riesgos y puntos de atención

## 12.1 Certificados locales y Azurite

Si Android falla con errores tipo:

- `SSLHandshakeException`
- `Trust anchor for certification path not found`

el problema suele ser de confianza TLS local entre dispositivo y Azurite, no del endpoint `sas-batch`.

## 12.2 Múltiples generaciones del pipeline de uploads

El repositorio contiene código legado y código activo de uploads, sobre todo en `frutsmart-plant`. Antes de tocar el pipeline:

- identificar qué provider se monta en `_layout.tsx`;
- verificar qué namespace exporta el pipeline activo;
- no asumir que `uploads-v1`, `uploads`, y `uploads-v2` son equivalentes.

## 12.3 README internos desactualizados

Varios README de apps y paquetes siguen siendo plantillas de scaffolding. Este README raíz debe considerarse la referencia principal hasta que se actualicen los documentos locales.

## 13. Rutas y archivos clave

Apps:

- `mobile-client/apps/frutsmart-field/src/app/_layout.tsx`
- `mobile-client/apps/frutsmart-field/src/hooks/useRootBootstrap.ts`
- `mobile-client/apps/frutsmart-field/src/services/uploads`
- `mobile-client/apps/frutsmart-field/src/services/report-generator`
- `mobile-client/apps/frutsmart-plant/src/app/_layout.tsx`
- `mobile-client/apps/frutsmart-plant/src/hooks/useRootBootstrap.ts`
- `mobile-client/apps/frutsmart-plant/src/services/uploads-v2`
- `mobile-client/apps/frutsmart-plant/src/services/uploads-v1`

Paquetes:

- `mobile-client/packages/nano-rt/src/nano-rt`
- `mobile-client/packages/skybolt/src/skybolt`
- `mobile-client/packages/chart-forge/src`

Backend:

- `server/src/main.ts`
- `server/src/app.module.ts`
- `server/src/modules/catalog`
- `server/src/modules/upload`
- `server/src/modules/evaluation`
- `server/src/health`
- `server/src/platform/integrations/azure`
- `server/scripts/dev-auth-gateway.ts`
- `server/docker-compose.yml`

## 14. Mantenimiento recomendado

- Mantener este README alineado con:
  - cambios de endpoints backend;
  - cambios de workspaces;
  - cambios de pipeline de uploads;
  - estado real de implementación nativa Android/iOS.
- Cuando se cambie el paquete activo de uploads o se retire código legado, actualizar explícitamente la sección de arquitectura móvil.
- Si se incorpora iOS real a `nano-rt`, `skybolt` o `chart-forge`, actualizar inmediatamente la sección de plataforma.

## 15. Estado documental

Este README fue construido a partir del código y configuración presentes en el repositorio, no a partir de plantillas heredadas. Si encuentras divergencias entre este documento y un README local dentro de un submódulo, prioriza:

1. el código fuente activo;
2. este README raíz;
3. luego la documentación secundaria del submódulo.
