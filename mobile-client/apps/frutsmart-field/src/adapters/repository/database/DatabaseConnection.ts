import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { type SQLiteDatabase, openDatabaseAsync } from "expo-sqlite";

import { DatabaseHelpers } from "./DatabaseHelpers";

// --- Feature Flag ---
/**
 * Controla el comportamiento de la inicialización de la base de datos.
 * - `true`: (Desarrollo) Copia la base de datos con datos de prueba desde `frutsmart.db`.
 * - `false`: (Producción) Crea una base de datos vacía usando el esquema de `frutsmart.sql`.
 */
const ENABLE_MOCK_DATA = true;

// --- Constantes ---
const DATABASE_ASSET_PATH = require("@/assets/db/frutsmart_database.db");
const DATABASE_SCHEMA_PATH = require("@/assets/db/frutsmart_schema.sql");

// --- Tipos ---
export type SqlParam = string | number | null;
export type TransactionCallback<T> = (db: SQLiteDatabase) => Promise<T>;

/**
 * Wrapper de expo-sqlite que maneja la conexión y operaciones básicas.
 * Incluye la lógica para copiar una base de datos predefinida o crear un esquema vacío,
 * controlado por un feature flag.
 */
export class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;
  private db: SQLiteDatabase | null = null;
  private dbPromise: Promise<SQLiteDatabase> | null = null;

  public readonly helpers: DatabaseHelpers;

  private constructor(private databaseName: string) {
    this.helpers = new DatabaseHelpers();
  }

  static getInstance(databaseName: string): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection(databaseName);
    }
    return DatabaseConnection.instance;
  }

  private async getDatabase(): Promise<SQLiteDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = this.initializeDatabase();
    }
    return this.dbPromise;
  }

  /**
   * Inicializa la base de datos basándose en el feature flag `ENABLE_MOCK_DATA`.
   */
  private async initializeDatabase(): Promise<SQLiteDatabase> {
    try {
      const sqliteDirectory = `${FileSystem.documentDirectory}SQLite`;
      const dbPath = `${sqliteDirectory}/${this.databaseName}`;

      await FileSystem.makeDirectoryAsync(sqliteDirectory, { intermediates: true });
      const dbFileInfo = await FileSystem.getInfoAsync(dbPath);


if (ENABLE_MOCK_DATA && !dbFileInfo.exists) {
        console.log("Modo Mock: Copiando base de datos desde assets...");
        const dbAsset = Asset.fromModule(DATABASE_ASSET_PATH);
        if (!dbAsset.downloaded) {
          await dbAsset.downloadAsync();
        }
        if (!dbAsset.localUri) {
          throw new Error("No se pudo obtener la URI local para el asset de la base de datos.");
        }
        await FileSystem.copyAsync({
          from: dbAsset.localUri,
          to: dbPath,
        });
        console.log("Copia de la base de datos completada.");
      }

      // Abrir la base de datos. Si no existe, se creará un archivo vacío.
      this.db = await openDatabaseAsync(this.databaseName);

      // Siempre ejecutar el esquema para garantizar que todas las tablas existan.
      // Esto asegura que nuevas tablas (como upload_jobs) se creen en DBs existentes.
      console.log("Ejecutando esquema SQL para garantizar estructura...");
      await this._loadAndExecuteSchema(this.db);

      // La configuración de conexión siempre es necesaria.
      await this.db.execAsync("PRAGMA journal_mode = WAL");
      await this.db.execAsync("PRAGMA foreign_keys = ON");

      console.log(`✅ Database ${this.databaseName} initialized successfully.`);
      return this.db;
    } catch (error) {
      console.error(
        `❌ Error initializing database ${this.databaseName}:`,
        error,
      );
      this.dbPromise = null;
      throw error;
    }
  }

  /**
   * Carga el archivo .sql desde los assets de la aplicación y lo ejecuta
   * para crear la estructura de tablas. Usado en modo Producción.
   * @param db La instancia de la base de datos activa.
   */
  private async _loadAndExecuteSchema(db: SQLiteDatabase): Promise<void> {
    const asset = Asset.fromModule(DATABASE_SCHEMA_PATH);
    if (!asset.downloaded) {
      await asset.downloadAsync();
    }
    if (!asset.localUri) {
      throw new Error("Failed to load database schema file: localUri is null.");
    }
    const schemaSql = await FileSystem.readAsStringAsync(asset.localUri);
    await db.execAsync(schemaSql);
    console.log("✅ Database schema executed successfully.");
  }

  // --- Métodos de Operaciones CRUD ---

  async execute(sql: string, params: SqlParam[] = []): Promise<void> {
    const db = await this.getDatabase();
    await db.runAsync(sql, params);
  }

  async get<T>(sql: string, params: SqlParam[] = []): Promise<T | null> {
    const db = await this.getDatabase();
    return db.getFirstAsync<T>(sql, params);
  }

  async getAll<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    const db = await this.getDatabase();
    return db.getAllAsync<T>(sql, params);
  }

  async run(
    sql: string,
    params: SqlParam[] = [],
  ): Promise<{ lastInsertRowId: number; changes: number }> {
    const db = await this.getDatabase();
    return db.runAsync(sql, params);
  }

  async execAsync(sql: string): Promise<void> {
    const db = await this.getDatabase();
    await db.execAsync(sql);
  }

  async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    const db = await this.getDatabase();
    let returnValue!: T;
    await db.withTransactionAsync(async () => {
      returnValue = await callback(db);
    });
    return returnValue;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.dbPromise = null;
    }
  }

  async prepareAsync(sql: string) {
    const db = await this.getDatabase();
    return db.prepareAsync(sql);
  }
}
