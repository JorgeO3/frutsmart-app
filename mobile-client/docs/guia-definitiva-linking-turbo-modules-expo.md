# Guia definitiva: Linking de Turbo Modules en React Native + Expo

Esta guia explica **exactamente** como se enlaza (linking) un Turbo Module en una app Expo, con y sin cambios de `AndroidManifest.xml`.

Incluye:

- Que parte hace Expo y que parte hace React Native.
- Como se detecta un Turbo Module (criterios reales).
- Como entran los config plugins de Expo cuando hay que tocar `manifest`.
- Checklist y comandos para verificar que todo quedo bien.

---

## 1) La idea clave: hay 2 pipelines distintos

En Expo + React Native conviven dos sistemas:

1. **RN autolinking (`@react-native/gradle-plugin`)**
   - Genera `PackageList.java`.
   - Registra paquetes tipo `ReactPackage` / `BaseReactPackage` / `TurboReactPackage`.
   - Es el camino principal para **Turbo Modules RN**.

2. **Expo modules autolinking (`expo-modules-autolinking`)**
   - Detecta **Expo Modules** (con `expo-module.config.json`).
   - Genera proveedor de modulos Expo (no el `PackageList.java` de RN).
   - No reemplaza el autolinking de RN para Turbo Modules tradicionales.

### Consecuencia practica

Un Turbo Module RN (como `NativeLocalStorage`) se enlaza por el pipeline de RN.  
Un config plugin de Expo es otro sistema, separado, para modificar archivos nativos (manifest, gradle, etc.).

---

## 2) Como se detecta un Turbo Module (Android)

### 2.1 Señales minimas del paquete

Tu libreria debe tener:

- `package.json` con campo `react-native`.
- carpeta `android/` con `build.gradle`.
- `codegenConfig` en `package.json` (si es Turbo Module de New Architecture).

Ejemplo minimo:

```json
{
  "name": "react-native-mi-modulo",
  "react-native": "src/index",
  "codegenConfig": {
    "name": "MiModuloSpec",
    "type": "modules",
    "jsSrcsDir": "src",
    "android": {
      "javaPackageName": "com.mimodulo"
    }
  }
}
```

### 2.2 Que busca el autolinking de RN

RN termina construyendo un JSON de autolinking y luego `GeneratePackageListTask` genera:

- imports (`packageImportPath`)
- instancia (`packageInstance`)

El `PackageList.java` generado queda en:

- `android/app/build/generated/autolinking/src/main/java/com/facebook/react/PackageList.java`

Si esta bien enlazado, deberias ver algo como:

```java
import com.expoturbostorage.NativeLocalStoragePackage;
...
new NativeLocalStoragePackage()
```

### 2.3 Como entra `codegenConfig.name`

`codegenConfig.name` (ej. `NativeLocalStorageSpec`) define el nombre de la libreria de codegen y conecta JS spec <-> glue C++ <-> implementacion Kotlin.

Artefactos generados tipicos:

- `android/app/.cxx/.../NativeLocalStorageSpec_autolinked_build/.../NativeLocalStorageSpec-generated.cpp.o`

---

## 3) Caso A: modulo que **no** necesita tocar el manifest

Este es el caso mas simple.

Necesitas solo:

1. Libreria con `android/` + clase `*Package` + clase `*Module`.
2. `codegenConfig` y spec TS.
3. Dependencia instalada en la app (`workspace:*`, npm, etc.).
4. `npx expo prebuild` y luego `npx expo run:android`.

No hace falta config plugin.

---

## 4) Caso B: modulo que **si** necesita tocar `AndroidManifest.xml`

Ejemplos:

- Agregar permisos (`CAMERA`, `POST_NOTIFICATIONS`, etc.).
- Agregar `<meta-data>`.
- Declarar `<service>`, `<receiver>`, `<provider>`.

En este caso, ademas del autolinking, necesitas **config plugin**.

### 4.1 Por que

`android/` en Expo managed/prebuild se regenera.  
Si editas a mano `android/app/src/main/AndroidManifest.xml`, lo pierdes al proximo `prebuild --clean`.

El plugin aplica esos cambios de forma reproducible durante prebuild.

### 4.2 Estructura minima en la libreria

En el paquete:

- `app.plugin.js` (entrypoint del plugin)
- opcional: `plugin/index.ts` (source TS)

`app.plugin.js`:

```js
module.exports = require('./plugin/build');
```

o CJS directo con la logica.

### 4.3 Plugin de ejemplo (meta-data)

```ts
import { ConfigPlugin, withAndroidManifest } from 'expo/config-plugins';

const withTurboStorageMetaData: ConfigPlugin = (config) => {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    if (!app) return config;

    app['meta-data'] = app['meta-data'] ?? [];
    const exists = app['meta-data'].some(
      (item) => item.$?.['android:name'] === 'expo.turbo.storage.enabled'
    );

    if (!exists) {
      app['meta-data'].push({
        $: {
          'android:name': 'expo.turbo.storage.enabled',
          'android:value': 'true',
        },
      });
    }

    return config;
  });
};

export default withTurboStorageMetaData;
```

### 4.4 Declararlo en la app

En `app.json`:

```json
{
  "expo": {
    "plugins": ["react-native-expo-turbo-storage"]
  }
}
```

Al correr `npx expo prebuild`, Expo resuelve el plugin del paquete y aplica cambios al manifest generado.

---

## 5) Como saber que se linkeo de verdad (pruebas objetivas)

## 5.1 Ver JSON de autolinking

Archivo:

- `android/build/generated/autolinking/autolinking.json`

Debe contener algo como:

- `packageImportPath: import com.expoturbostorage.NativeLocalStoragePackage;`
- `packageInstance: new NativeLocalStoragePackage()`
- `libraryName: NativeLocalStorageSpec`

## 5.2 Ver `PackageList.java` generado

Archivo:

- `android/app/build/generated/autolinking/src/main/java/com/facebook/react/PackageList.java`

Debe incluir `new NativeLocalStoragePackage()`.

## 5.3 Ver que el plugin toco el manifest (si aplica)

Archivo:

- `android/app/src/main/AndroidManifest.xml`

Ejemplo esperado:

```xml
<meta-data android:name="expo.turbo.storage.enabled" android:value="true"/>
```

## 5.4 Prueba funcional

Si el modulo es storage:

1. Guardas valor.
2. Cierras app.
3. Reabres.
4. Valor persiste.

Si persiste, el camino JS -> TurboModule -> Kotlin -> Android nativo esta operativo.

---

## 6) Flujo completo end-to-end

```text
Instalar libreria (workspace/npm)
  -> node_modules contiene el paquete
    -> prebuild/run: RN autolinking lo detecta
      -> autolinking.json incluye packageImportPath/packageInstance/libraryName
        -> GeneratePackageListTask crea PackageList.java
          -> Gradle compila Kotlin + codegen C++
            -> APK incluye modulo en DEX
              -> TurboModuleRegistry.getEnforcing(...) lo encuentra en runtime

Si hay config plugin:
  app.json plugins[]
    -> Expo prebuild ejecuta plugin
      -> modifica AndroidManifest.xml / Gradle / recursos
```

---

## 7) Checklist rapido (copy/paste mental)

- [ ] Libreria tiene `android/build.gradle`.
- [ ] Libreria tiene clase `*Package` valida para RN.
- [ ] `package.json` tiene `react-native`.
- [ ] `package.json` tiene `codegenConfig` (Turbo Module).
- [ ] App instala la libreria (workspace o npm).
- [ ] `prebuild` ejecutado tras cambios nativos.
- [ ] `autolinking.json` muestra `packageImportPath` y `packageInstance`.
- [ ] `PackageList.java` muestra `new MiPackage()`.
- [ ] Si tocas manifest: plugin declarado en `app.json` y cambio visible en `AndroidManifest.xml`.

---

## 8) Errores comunes que confunden el linking

1. **Pensar que config plugin = autolinking**
   - No: plugin modifica archivos; autolinking registra paquetes.

2. **Editar `android/` a mano en Expo managed**
   - Se pierde con `prebuild --clean`.

3. **No tener `codegenConfig`**
   - Puede linkear como paquete, pero no quedar como Turbo Module de New Architecture.

4. **Caches de Gradle/CMake rotas**
   - Dan errores que parecen de linking y no lo son.

5. **No volver a correr prebuild tras cambios nativos/plugin**
   - Te quedas mirando codigo viejo generado.

---

## 9) Comandos utiles de verificacion

```bash
# Ver configuracion de RN autolinking para Android
npx expo-modules-autolinking react-native-config --platform android

# Regenerar nativo desde config + plugins
npx expo prebuild --platform android --clean

# Compilar e instalar en Android
npx expo run:android
```

---

## 10) Regla final

- Si solo expones API nativa: **autolinking RN basta**.
- Si ademas necesitas permisos/meta-data/servicios: **autolinking RN + config plugin Expo**.

Ambos se complementan; no se sustituyen.
