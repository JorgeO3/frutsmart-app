# Nano RT Fase 0: congelamiento de contratos externos

Fuente principal: `docs/migration_plan_nano_rt.md`

## Invariantes externos congelados

Estos contratos no deben romperse durante el resto de la migracion.

## Superficie Expo/JS

- Modulo Expo: `NanoRT`.
- Archivo de contrato: `modules/nano-rt/src/NanoRTModule.ts`.
- Hook principal: `modules/nano-rt/src/useNanoRT.ts`.
- Clasificador JS: `modules/nano-rt/src/NanoRTClassifier.ts`.
- Bootstrap host: `src/hooks/useRootBootstrap.ts`.

## Contrato de constantes

- `version: string`
- `liteRT: string`
- `engine: string`

## Contrato de lifecycle/readiness

- `isReady(): boolean`
- `initialize(): Promise<boolean>`
- `initializeModule(): Promise<{ success, message, version }>`
- Eventos emitidos:
  - `onReady`
  - `onInitError` con payload `{ message, type }`

## Contrato de workflows clasificacion

Metodos publicos que se mantienen:

- `classifyPlantExternal(imageUri)`
- `classifyPlantInternal(imageUri)`
- `classifyFieldExternal(imageUri)`
- `classifyFieldInternal(imageUri)`

Envelope de salida congelado:

- `{ items: [{ uri, confidences }] }`

## Invariantes funcionales

- `NanoRTClassifier` debe continuar validando `imageUri`, readiness y timeout de clasificacion.
- `useNanoRTReady()` sigue siendo la forma de readiness para bootstrap del host app.
- No se cambia la semantica de integracion esperada en el host: app lista solo cuando `useRootBootstrap` observa readiness.

## Estado de cierre

Fase 0 queda cerrada al quedar este documento como referencia normativa de API/contratos para las fases restantes.
