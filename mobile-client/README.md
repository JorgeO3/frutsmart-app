# Mobile Client Monorepo

Estructura objetivo del monorepo mobile en `frutsmart/mobile-client`.

## Estructura

```txt
mobile-client/
  package.json
  bun.lock
  apps/
    frutsmart-plant/   # antes: FrutSmartP
    frutsmart-field/   # antes: frutosmart
  packages/
    skybolt/
    nano-rt/
```

## Convenciones

- `apps/frutsmart-plant`: app de planta de produccion.
- `apps/frutsmart-field`: app de campo.
- `packages/*`: modulos compartidos entre apps (nativos y TS).

## Regla para modulos nativos

- `skybolt` y `nano-rt` deben vivir en `packages/` y consumirse con `workspace:*`.
- Evitar tener el mismo modulo simultaneamente como Expo Module local y TurboModule compartido, porque genera falsos positivos de linking.
- `skybolt` y `nano-rt` no estan en la misma etapa tecnica; revisar `docs/mobile-monorepo-plan.md` antes de migrarlos como si fueran iguales.

## Mapeo inicial (renombre)

- `FrutSmartP` -> `apps/frutsmart-plant`
- `frutosmart` -> `apps/frutsmart-field`
- `frutsmart-back` -> `../server` (fuera del monorepo mobile)

## Siguiente paso operativo

1. Limpiar los templates nuevos de `create-react-native-library`.
2. Cerrar primero la migracion de `skybolt` al paquete nuevo.
3. Reorganizar `nano-rt` y separar su migracion Turbo en una fase propia.
