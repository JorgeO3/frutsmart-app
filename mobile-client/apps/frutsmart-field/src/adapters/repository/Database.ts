import { LotRepository } from "./repositories/LotRepository";
import { DatabaseConnection } from "./database/DatabaseConnection";
import { CenterRepository } from "./repositories/CenterRepository";
import { ReportRepository } from "./repositories/ReportRepository";
import { ReportQueryRepository } from "./repositories/ReportQueryRepository";
import { ClassificationPhotoRepository } from "./repositories/ClassificationPhotoRepository";
import { ClassificationResultRepository } from "./repositories/ClassificationResultRepository";
import { QualityClassificationRepository } from "./repositories/QualityClassificationRepository";
import { SessionRepository } from "./repositories/SessionsRepository";
import { UploadJobsRepository } from "./repositories/UploadJobsRepository";

/**
 * Clase Singleton que gestiona la conexión a la base de datos y sirve
 * como punto de acceso único a todos los repositorios de la aplicación.
 *
 * Sigue los patrones:
 * - Singleton: Asegura una única instancia de la base de datos.
 * - Composition Root: Crea e inyecta las dependencias entre repositorios.
 * - Facade: Expone una API pública y limpia, ocultando los detalles de implementación.
 */
export class Database {
  private static instance: Database;
  private connection: DatabaseConnection;

  // ============================================================
  // API Pública de Repositorios
  // Estos son los únicos repositorios accesibles desde fuera.
  // ============================================================
  public readonly lots: LotRepository;
  public readonly centers: CenterRepository;
  public readonly reports: ReportRepository;
  public readonly reportQueries: ReportQueryRepository;
  public readonly qualityClassifications: QualityClassificationRepository;
  public readonly sessions: SessionRepository;
  public readonly uploadJobs: UploadJobsRepository;

  // ============================================================
  // Repositorios Privados (Detalles de implementación)
  // Estos repositorios son necesarios para la inyección de dependencias
  // pero no son accesibles directamente desde la capa de servicios.
  // ============================================================
  private readonly photosRepository: ClassificationPhotoRepository;
  private readonly resultsRepository: ClassificationResultRepository;

  /**
   * El constructor es privado para forzar el uso del método `getInstance()`,
   * asegurando así que solo exista una instancia de la clase (Singleton).
   */
  private constructor() {
    this.connection = DatabaseConnection.getInstance("frutosmart.db");

    // 1. Inicializar repositorios que no tienen dependencias entre sí.
    this.lots = new LotRepository(this.connection);
    this.centers = new CenterRepository(this.connection);
    this.reports = new ReportRepository(this.connection);
    this.sessions = new SessionRepository(this.connection);
    this.reportQueries = new ReportQueryRepository(this.connection);

    // 2. Inicializar los repositorios "hijos" que actuarán como dependencias.
    // Se mantienen como propiedades privadas.
    this.photosRepository = new ClassificationPhotoRepository(this.connection);
    this.resultsRepository = new ClassificationResultRepository(
      this.connection,
    );

    // 3. Inicializar el repositorio "fachada" (QualityClassificationRepository),
    //    inyectando las dependencias que necesita para funcionar.
    this.qualityClassifications = new QualityClassificationRepository(
      this.connection,
      this.resultsRepository,
      this.photosRepository,
    );

    this.uploadJobs = new UploadJobsRepository(this.connection);
  }

  /**
   * Obtiene la instancia única de la clase Database.
   * Si la instancia no existe, la crea.
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
   * transacción atómica desde la capa de servicios, si fuera necesario.
   * @param callback La función que contiene las operaciones de base de datos.
   * @returns El resultado de la función de callback.
   */
  public async transaction<T>(callback: () => Promise<T>): Promise<T> {
    return this.connection.transaction(callback);
  }

  /**
   * Expone los métodos de utilidad de la conexión para un acceso fácil.
   */
  public get helpers() {
    return this.connection.helpers;
  }
}

/**
 * Instancia única y exportada de la base de datos.
 * Importa esta constante en tus servicios para interactuar con la base de datos.
 *
 * @example
 * import { database } from '@/adapters/repository/Database';
 *
 * async function searchLots(term: string) {
 * const lots = await database.lots.search(term, 1, 10);
 * return lots;
 * }
 */
export const database = Database.getInstance();
