import * as FileSystem from "expo-file-system/legacy";

/**
 * Nombre del subdirectorio que usaremos para nuestros archivos temporales.
 */
const TEMP_DIR_NAME = "tmp_media";

/**
 * Gestiona un directorio temporal persistente dentro del almacenamiento de la aplicación.
 *
 * Esta clase se encarga de crear, limpiar y proporcionar rutas de archivo
 * para un directorio temporal que no es volátil como el directorio de caché del sistema.
 * Los archivos aquí persisten hasta que la app decide explícitamente borrarlos,
 * lo cual hacemos al inicio de cada nueva sesión.
 */
class TempFileManager {
  private tempDirUri: string;

  /**
   * Inicializa el servicio definiendo la ruta y asegurándose de que el directorio exista.
   */
  constructor() {
    // Usamos `documentDirectory` porque es persistente y privado para la app.
    // El `/` al final es importante para construir rutas de archivo correctamente.
    this.tempDirUri = `${FileSystem.documentDirectory}${TEMP_DIR_NAME}/`;

    // Nos aseguramos de que el directorio exista desde el principio.
    this.initialize();
  }

  /**
   * Se asegura de que el directorio temporal exista en el sistema de archivos.
   * Utiliza `intermediates: true` para evitar errores si el directorio ya existe.
   */
  public async initialize(): Promise<void> {
    try {
      await FileSystem.makeDirectoryAsync(this.tempDirUri, { intermediates: true });
      console.log("✅ Directorio temporal inicializado en:", this.tempDirUri);
    } catch (error) {
      console.error("Error al inicializar el directorio temporal:", error);
    }
  }

  /**
   * Genera una nueva y única URI para un archivo temporal.
   * El nombre del archivo se basa en la fecha actual y un número aleatorio para evitar colisiones.
   * @param extension La extensión del archivo (e.g., '.jpg', '.png').
   * @returns La URI completa del nuevo archivo.
   */
  public getNewTempFileUri(extension: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const fileName = `${timestamp}-${random}${extension}`;
    return `${this.tempDirUri}${fileName}`;
  }

  /**
   * Limpia completamente el directorio temporal eliminándolo y recreándolo.
   * Este método está diseñado para ser llamado al inicio de cada sesión de la aplicación
   * para borrar los archivos de la sesión anterior.
   */
  public async cleanup(): Promise<void> {
    try {
      console.log("🧹 Limpiando directorio temporal...");
      // `idempotent: true` evita un error si el directorio no existe.
      await FileSystem.deleteAsync(this.tempDirUri, { idempotent: true });

      // Después de borrarlo, lo volvemos a crear para la sesión actual.
      await this.initialize();
      console.log("🗑️ Directorio temporal limpiado y recreado.");
    } catch (error) {
      console.error("Error durante la limpieza del directorio temporal:", error);
    }
  }

  /**
   * Devuelve la URI del directorio temporal.
   * Útil para acceder directamente al directorio si es necesario (e.g., para listar archivos).
   * @returns La URI del directorio como un string.
   */
  public getTempDirUri(): string {
    return this.tempDirUri;
  }
}

/**
 * Exportamos una única instancia (patrón Singleton) para asegurar que
 * toda la aplicación utilice el mismo gestor de archivos temporales.
 */
export const tempFileManager = new TempFileManager();