import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Font from 'expo-font';
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  Montserrat_900Black,
} from '@expo-google-fonts/montserrat';

// --- Constantes de Directorios ---
const DOCS_DIR = FileSystem.documentDirectory;
const SQLITE_DIR = `${DOCS_DIR}SQLite/`;
const REPORTS_ASSETS_DIR = `${DOCS_DIR}reports/assets/`;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type AssetMap = { [key: string]: any };

/**
 * Gestor Singleton para preparar todos los assets iniciales de la aplicación.
 */
class InitialAssetsManager {
  public isReady = false;

  private readonly fontSources: AssetMap = {
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
    Montserrat_900Black,
  };

  public async setup(): Promise<void> {
    if (this.isReady) return;
    console.log("⏳ [Assets] Iniciando configuración de assets iniciales...");

    try {
      const [dbMap, reportsMap] = await Promise.all([
        import('./asset-maps/db.map'),
        import('./asset-maps/reports.map'),
      ]);

      await Promise.all([
        this._setupFonts(),
        // Usamos el nuevo método especializado para la base de datos
        this._setupDatabase(dbMap.default),
        this._setupAssetGroup(reportsMap.default, REPORTS_ASSETS_DIR, 'Archivos de Reporte'),
      ]);

      this.isReady = true;
      console.log("✅ [Assets] Configuración de assets iniciales completada.");
    } catch (error) {
      console.error("❌ [Assets] Error fatal durante la configuración de assets.", error);
      throw new Error("No se pudieron preparar los archivos de la aplicación.");
    }
  }

  private async _setupFonts(): Promise<void> {
    await Font.loadAsync(this.fontSources);
    console.log("👍 [Assets] Fuentes cargadas.");
  }

  /**
   * Prepara los assets de la base de datos.
   * - Copia el archivo .db si no existe (para modo MOCK).
   * - Pre-descarga el archivo .sql pero no lo copia, ya que se lee directamente del bundle (para modo Producción).
   */
  private async _setupDatabase(dbSourceMap: AssetMap): Promise<void> {
    await FileSystem.makeDirectoryAsync(SQLITE_DIR, { intermediates: true });

    // 1. Manejar el archivo de base de datos (.db)
    const dbAsset = Asset.fromModule(dbSourceMap.database);
    const dbDestinationUri = `${SQLITE_DIR}${dbAsset.name}`;
    const dbFileInfo = await FileSystem.getInfoAsync(dbDestinationUri);
    if (!dbFileInfo.exists) {
      console.log(`- Copiando 'database' de Base de Datos...`);
      if (!dbAsset.downloaded) await dbAsset.downloadAsync();
      if (!dbAsset.localUri) throw new Error("URI local no encontrada para el asset: database");
      await FileSystem.copyAsync({ from: dbAsset.localUri, to: dbDestinationUri });
    }

    // 2. Manejar el archivo de esquema (.sql)
    // Solo nos aseguramos de que esté descargado para que `readAsStringAsync` funcione después.
    // No lo copiamos, ya que tu clase `DatabaseConnection` lo lee desde su `localUri` original.
    const schemaAsset = Asset.fromModule(dbSourceMap.schema);
    if (!schemaAsset.downloaded) {
      console.log(`- Pre-descargando 'schema' de Base de Datos...`);
      await schemaAsset.downloadAsync();
    }

    console.log("👍 [Assets] Base de Datos lista.");
  }

  /**
   * Método genérico para copiar un grupo de assets a un directorio de destino.
   */
  private async _setupAssetGroup(
    sourceMap: AssetMap,
    destinationDir: string,
    assetTypeName: string,
  ): Promise<void> {
    await FileSystem.makeDirectoryAsync(destinationDir, { intermediates: true });

    const assetPromises = Object.entries(sourceMap).map(
      async ([key, assetModule]) => {
        const asset = Asset.fromModule(assetModule);
        const destinationUri = `${destinationDir}${asset.name}`;

        const fileInfo = await FileSystem.getInfoAsync(destinationUri);
        if (fileInfo.exists) return;

        console.log(`- Copiando '${key}' de ${assetTypeName}...`);
        if (!asset.downloaded) await asset.downloadAsync();
        if (!asset.localUri) throw new Error(`URI local no encontrada para el asset: ${key}`);
        await FileSystem.copyAsync({ from: asset.localUri, to: destinationUri });
      },
    );

    await Promise.all(assetPromises);
    console.log(`👍 [Assets] ${assetTypeName} listos.`);
  }
}

export const initialAssetsManager = new InitialAssetsManager();
