import { Inject, Injectable } from "@nestjs/common";
import { IUploadSessionsRepository } from "../../../application/ports/repositories/upload-sessions.repo.port";
import { UUID } from "../../../domain/types";
import { ClientIdentifier } from "../../../domain/value-objects/client-identifier.vo";
import { UploadSession } from "../../../domain/entities/upload-session.entity";
import { UploadSessionsRepo } from "../repositories/upload-sessions.typeorm-repo";
import type { IUploadSessionOrmMapper } from "../mappers/upload-session-orm.mapper.port";
import { UPLOAD_SESSION_ORM_MAPPER } from "../mappers/upload-session-orm.mapper.port";
import { isUniqueViolation } from "@platform/database/errors/pg-unique-violation";

/**
 * Adapter TypeORM para IUploadSessionsRepository.
 * - Convierte Domain <-> ORM con IUploadSessionOrmMapper.
 * - Usa operaciones idempotentes (save) para insertar/actualizar.
 */
@Injectable()
export class UploadSessionsRepositoryAdapter
	implements IUploadSessionsRepository
{
	constructor(
		private readonly repo: UploadSessionsRepo,
		@Inject(UPLOAD_SESSION_ORM_MAPPER)
		private readonly mapper: IUploadSessionOrmMapper,
	) {}

	/**
	 * Inserta o actualiza la sesión (upsert). Delega la política de escritura a TypeORM.
	 */
	async save(session: UploadSession): Promise<void> {
		const orm = this.mapper.toPersistence(session);
		try {
			// Preferimos una operación idempotente que haga INSERT o UPDATE según exista el id.
			// Asegúrate de que UploadSessionsRepo exponga `save`. Si no, cambia a create/update según tu implementación.
			await this.repo.save(orm);
		} catch (err) {
			// Exponemos tal cual las violaciones únicas u otros errores para que el caso de uso decida.
			if (this.isUniqueViolation(err)) {
				throw err;
			}
			throw err;
		}
	}

	/**
	 * Carga una sesión con sus ítems por id (o null si no existe).
	 */
	async findById(id: UUID): Promise<UploadSession | null> {
		const orm = await this.repo.findByIdWithItems(id);
		return orm ? this.mapper.toDomain(orm) : null;
	}

	/**
	 * Busca una sesión OPEN por clientBatchId.
	 * Compatibilidad con repositorio actual que requiere domain:
	 * — Intenta primero en 'plant' y luego en 'field'.
	 */
	async findOpenByClientBatchId(
		clientBatchId: ClientIdentifier,
	): Promise<UploadSession | null> {
		// 1) Intentar en PLANT
		const plant = await this.repo.findOpenByBatchId(
			"plant",
			clientBatchId.value,
		);
		if (plant) {
			const withItems = await this.repo.findByIdWithItems(plant.id);
			return withItems ? this.mapper.toDomain(withItems) : null;
		}

		// 2) Intentar en FIELD
		const field = await this.repo.findOpenByBatchId(
			"field",
			clientBatchId.value,
		);
		if (!field) {
			return null;
		}

		const withItems = await this.repo.findByIdWithItems(field.id);
		return withItems ? this.mapper.toDomain(withItems) : null;
	}

	/**
	 * Expone helper para detectar violación de unicidad de Postgres.
	 */
	isUniqueViolation(err: unknown): boolean {
		return isUniqueViolation(err);
	}
}
