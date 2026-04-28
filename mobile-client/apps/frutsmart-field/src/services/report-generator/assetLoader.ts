import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

// --- Definición de Tipos ---
export interface ReportAssets {
  logo: string;
  styles: string;
  logoFont: string;
  principalFont: string;
}

// --- Caché en Memoria ---
let cachedAssets: ReportAssets | null = null;

// --- Definición de los Assets a Copiar ---
// Usamos require() para que Metro incluya estos archivos en el bundle de la app.
const ASSET_MODULES = {
  logo: require('@/assets/reports/assets/logo.webp'),
  styles: require('@/assets/reports/assets/styles.css'),
  logoFont: require('@/assets/reports/assets/gilroy-Black.woff2'),
  principalFont: require('@/assets/reports/assets/montserrat.woff2'),
  tipoa: require('@/assets/reports/assets/tipoa.jpeg'),
  clase1: require('@/assets/reports/assets/clase1.jpeg'),
  reportsCss: require('@/assets/reports/assets/reports.css'),
} as const;

/**
 * Carga los assets estáticos necesarios para el reporte.
 * Si los assets no existen en el directorio de caché, los copia desde el
 * paquete de la aplicación. Utiliza un caché en memoria para evitar lecturas repetidas.
 */
export const loadReportAssets = async (): Promise<ReportAssets> => {
  if (cachedAssets) {
    console.log('[Assets] Reutilizando assets desde el caché en memoria.');
    return cachedAssets;
  }

  try {
    const baseDir = `${FileSystem.cacheDirectory}reports/assets/`;
    // 1. Asegurarse de que el directorio de destino exista.
    await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });

    // 2. Iterar sobre cada asset que necesitamos.
    const assetPromises = Object.entries(ASSET_MODULES).map(async ([key, moduleId]) => {
      const asset = Asset.fromModule(moduleId);

      const fileName = `${asset.name}.${asset.type}`;
      const destinationPath = `${baseDir}${fileName}`;

      console.log(`[Assets] Procesando asset: ${fileName}`);

      // 3. Verificar si el archivo ya existe en el destino.
      const fileInfo = await FileSystem.getInfoAsync(destinationPath);

      if (!fileInfo.exists) {
        // 4. Si no existe, copiarlo.
        console.log(`[Assets] Copiando asset '${asset.name}' a la caché...`);
        // Primero, asegurarse de que el asset esté disponible como archivo local.
        if (!asset.downloaded) {
          await asset.downloadAsync();
        }

        if (!asset.localUri) {
          throw new Error(`El asset '${asset.name}' no tiene una URI local válida.`);
        }

        // Luego, copiarlo desde su ubicación temporal a nuestro directorio de destino.
        await FileSystem.copyAsync({
          from: asset.localUri,
          to: destinationPath,
        });
      }

      // Devolvemos la clave y la ruta final del archivo.
      return [key, destinationPath];
    });

    // 5. Esperar a que todas las operaciones de copia terminen.
    const resolvedAssets = Object.fromEntries(await Promise.all(assetPromises));

    // 6. Obtener las content URIs (si es necesario para tu caso de uso, como en un WebView).
    const contentUris = await Promise.all(
      Object.values(resolvedAssets).map((path) =>
        FileSystem.getContentUriAsync(path as string),
      ),
    );

    cachedAssets = {
      logo: contentUris[0],
      styles: contentUris[1],
      logoFont: contentUris[2],
      principalFont: contentUris[3],
    };

    console.log('[Assets] Carga de assets completada con éxito.');
    return cachedAssets;

  } catch (error) {
    console.error("❌ Error fatal al cargar los assets del reporte:", error);
    // Devolver un objeto vacío o lanzar el error, según tu estrategia de manejo de errores.
    return {
      logo: "",
      styles: "",
      logoFont: "",
      principalFont: "",
    };
  }
};
