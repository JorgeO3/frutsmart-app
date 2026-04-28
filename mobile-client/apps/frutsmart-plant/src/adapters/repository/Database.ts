import { DatabaseConnection } from "./database/DatabaseConnection";

import { LotRepository } from "./repositories/LotRepository";
import { ProgramRepository } from "./repositories/ProgramRepository";
import { QualityAnalysisRepository } from "./repositories/QualityAnalysisRepository";
import { ReportQueryRepository } from "./repositories/ReportQueryRepository";
import { ReportRepository } from "./repositories/ReportRepository";
import { SessionRepository } from "./repositories/SessionRepository";
import { UploadJobsRepository } from "./repositories/UploadJobsRepository";

/**
 * Clase Singleton que gestiona la conexión a la base de datos y sirve
 * como punto de acceso único a todos los repositorios de la aplicación "Planta".
 */
export class Database {
  private static instance: Database;
  private connection: DatabaseConnection;

  // ============================================================
  // API Pública de Repositorios
  // ============================================================
  public readonly programs: ProgramRepository;
  public readonly lots: LotRepository;
  public readonly sessions: SessionRepository;
  public readonly reports: ReportRepository;
  public readonly reportQueries: ReportQueryRepository;
  public readonly qualityAnalyses: QualityAnalysisRepository;
  public readonly uploadJobs: UploadJobsRepository;

  /**
   * El constructor es privado para forzar el uso del método `getInstance()`.
   */
  private constructor() {
    this.connection = DatabaseConnection.getInstance("frutosmart_planta.db");

    // 1. Inicializar repositorios de catálogo y de bajo nivel.
    this.programs = new ProgramRepository(this.connection);
    this.lots = new LotRepository(this.connection);
    this.sessions = new SessionRepository(this.connection);
    this.reports = new ReportRepository(this.connection);
    this.reportQueries = new ReportQueryRepository(this.connection);

    // 3. Inicializar el repositorio "fachada" (QualityAnalysisRepository),
    this.qualityAnalyses = new QualityAnalysisRepository(this.connection);
    this.uploadJobs = new UploadJobsRepository(this.connection);
  }

  /**
   * Obtiene la instancia única de la clase Database.
   * @returns La instancia Singleton de la base de datos.
   */
  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * Permite ejecutar operaciones de múltiples repositorios en una única
   * transacción atómica desde la capa de servicios.
   * @param callback La función que contiene las operaciones de base de datos.
   */
  public async transaction<T>(
    callback: (db: Database) => Promise<T>,
  ): Promise<T> {
    // Nota: El callback recibe la propia instancia de 'database' para
    // que las operaciones dentro de la transacción usen los repositorios ya instanciados.
    return this.connection.transaction(() => callback(this));
  }

  /**
   * Expone los métodos de utilidad de la conexión para un acceso fácil.
   */
  public get helpers() {
    return this.connection.helpers;
  }
}

/**
 * Instancia única y exportada de la base de datos para la app "Planta".
 *
 * @example
 * import { database } from '@/adapters/repository/Database';
 *
 * async function saveNewAnalysis(data: FullAnalysisInput) {
 * const newId = await database.qualityAnalyses.createAndFinalize(data);
 * return newId;
 * }
 */
export const database = Database.getInstance();
