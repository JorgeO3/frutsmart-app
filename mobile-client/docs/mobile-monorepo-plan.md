# Mobile Native Modules Plan

## Objetivo

Dejar los dos modulos compartidos dentro de `mobile-client/packages` con una estrategia correcta por modulo, sin mezclar pipelines ni mantener duplicados activos en las apps.

## Estado actualizado (2026-04-28)

- `frutsmart-plant` es la unica app activa en workspaces para evitar conflictos de versiones con `frutsmart-field`.
- `expo-doctor` ya pasa limpio en `frutsmart-plant`.
- `:app:assembleDebug` ya compila en `frutsmart-plant`.
- `skybolt` quedo normalizado como libreria Android con source set unico en `packages/skybolt/android/src/main`.
- Se elimino la estructura duplicada `packages/skybolt/android/app/src`.
- `nano-rt` fue migrado a TurboModule en Android con codegen y autolinking.
- Build de verificacion `:app:assembleDebug` en `frutsmart-plant` vuelve a pasar despues de la migracion.

## Estado actual

### Monorepo

- Root mobile: `mobile-client/`
- Apps:
  - `apps/frutsmart-plant`
  - `apps/frutsmart-field`
- Paquetes nuevos creados con `create-react-native-library`:
  - `packages/skybolt`
  - `packages/nano-rt`
- Paquetes legacy renombrados:
  - `packages/skybolt_old`
  - `packages/nano_rt_old`

### Skybolt

- `skybolt_old` contiene la logica real actual.
- `skybolt` es el repo nuevo generado como Turbo Module.
- `frutsmart-plant` ya consume `skybolt` por nombre de paquete desde JS.
- El modulo local viejo de la app ya fue desactivado.
- Problema actual: `skybolt` nuevo todavia no contiene la logica migrada ni su Android esta adaptado del todo a formato de libreria final.

### NanoRT

- `nano-rt` es ahora el modulo activo compartido para `frutsmart-plant`.
- El bridge JS usa `TurboModuleRegistry.getEnforcing('NanoRT')`.
- Android usa `NativeNanoRTModule` + `NativeNanoRTPackage` (BaseReactPackage) con codegen.
- Se preserva el contrato publico de clasificacion y hooks para no romper consumo en app.

## Decision tecnica

No tratar ambos modulos como si estuvieran en la misma etapa.

### Skybolt

- Se migra **ya** al paquete nuevo `packages/skybolt`.
- Se mantiene como **Turbo Module oficial de React Native**.
- Debe quedar con autolinking automatico desde `package.json` + `android/` + `codegenConfig`.

### NanoRT

- Migracion Expo Module -> Turbo Module aplicada en `packages/nano-rt`.
- Se mantiene estabilidad de API publica mientras cambia el bridge nativo.

## Regla de organizacion final

- `packages/skybolt`: paquete real compartido y consumible por apps.
- `packages/nano-rt`: paquete real compartido con bridge TurboModule activo en Android.
- `packages/*_old`: solo referencia temporal durante la migracion; se eliminan al cerrar cada modulo.
- Ninguna app debe volver a consumir `modules/<modulo>` local.

## Plan por fases

## Fase 1 - Limpiar templates nuevos

Aplicar a `packages/skybolt` y `packages/nano-rt`:

- Borrar `.yarn/`
- Borrar `.yarnrc.yml`
- Borrar `turbo.json`
- Borrar `CONTRIBUTING.md`
- Borrar `CODE_OF_CONDUCT.md`
- Borrar `example/`
- Borrar `ios/`
- Borrar `*.podspec`
- Borrar metadata que no usemos para Bun/Android-only
- Mantener:
  - `package.json`
  - `src/`
  - `android/`
  - `react-native.config.js` solo si el paquete realmente lo necesita

## Fase 2 - Cerrar Skybolt primero

### JS/TS

- Mover a `packages/skybolt/src` la capa publica desde `packages/skybolt_old/src/skybolt`
- Mover el spec desde `packages/skybolt_old/specs/NativeSkybolt.ts` a layout del paquete nuevo
- Ajustar `src/index.tsx` para exportar la API real de Skybolt
- Mantener el nombre del modulo nativo consistente con el spec y Kotlin

### Android

- Convertir `packages/skybolt/android` en una libreria Android final, no app standalone
- Tomar como referencia el layout del paquete nuevo generado por `create-react-native-library`
- Migrar solo la logica nativa necesaria desde `packages/skybolt_old/android/app/src/main/*`
- Eliminar cosas de app standalone:
  - `MainActivity`
  - `MainApplication`
  - iconos/app resources de demo
  - `applicationId`
  - signing configs
- Mantener:
  - `NativeSkyboltPackage`
  - `NativeSkyboltModule`
  - `core/*`
  - `azureblob/*`
  - `proto/*`
  - manifest de libreria con permisos/service/receiver si corresponden

### Build/autolinking

- `package.json` debe conservar:
  - `name`
  - `react-native`
  - `codegenConfig`
- `android/build.gradle` debe ser de libreria (`com.android.library`)
- El paquete no debe depender de configuracion manual en la app para linkearse

### Validacion

- `npx expo-modules-autolinking react-native-config --platform android`
  - debe mostrar `skybolt`
- `android/build/generated/autolinking/autolinking.json`
  - debe incluir `skybolt`
- `android/app/build/generated/autolinking/.../PackageList.java`
  - debe incluir `new NativeSkyboltPackage()`
- Build debug de `frutsmart-plant` debe completar
- `Skybolt` debe resolver en runtime sin fallback local

## Fase 3 - Dejar NanoRT estable antes de migrarlo

### Reorganizacion inmediata

- Mover el JS/TS publico de `packages/nano_rt_old` a `packages/nano-rt`
- Dejar `packages/nano-rt` con una API publica estable para las apps
- Si el bridge nativo sigue siendo Expo Module en esta fase, reflejarlo explicitamente y no venderlo como TurboModule terminado

### Decision de bridge

Elegir una de estas dos rutas antes de tocar native:

1. Ruta conservadora recomendada:
   - mantener NanoRT temporalmente como Expo Module compartido
   - reorganizarlo dentro del monorepo
   - migrar a Turbo en una fase posterior

2. Ruta agresiva:
   - rehacer NanoRT como Turbo Module completo ahora
   - definir spec TS
   - reemplazar `requireNativeModule('NanoRT')`
   - migrar Kotlin al paquete RN nuevo

### Recomendacion

- Tomar la ruta conservadora.
- Cerrar primero `skybolt` end-to-end.
- Luego hacer una migracion dedicada de `nano-rt`.

## Fase 4 - Eliminar legacy

Cuando cada modulo ya funcione desde su paquete nuevo:

- borrar `packages/skybolt_old`
- borrar `packages/nano_rt_old`
- actualizar docs, scripts y paths de test
- dejar solo una fuente de verdad por modulo

## Criterios de exito

### Skybolt

- `frutsmart-plant` lo consume por paquete workspace
- autolinking Android lo detecta automaticamente
- compila sin config manual en la app
- modulo funciona en runtime

### NanoRT

- `frutsmart-plant` lo consume por paquete workspace
- ya no depende de carpeta local en app
- queda funcional y organizado en el monorepo
- su migracion a Turbo queda separada y explicita

## Orden recomendado de ejecucion

1. Limpiar templates nuevos
2. Cerrar migracion de `skybolt`
3. Reorganizar `nano-rt` sin forzar Turbo si no existe aun
4. Eliminar paquetes `*_old`
