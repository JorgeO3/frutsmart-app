import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { type EntityManager, type Repository, In } from "typeorm";
import { UploadItemEntity } from "../entities/upload-item.orm-entity";
import {
	type UploadItemStatus,
	UploadItemStatusValues,
} from "src/modules/upload/domain/types";

@Injectable()
export class UploadItemsRepository {
	constructor(
		@InjectRepository(UploadItemEntity)
		private readonly repo: Repository<UploadItemEntity>,
	) {}

	/**
	 * Crea múltiples items de upload en batch. Debe ser llamado dentro de una transacción.
	 */
	async createMany(
		items: Partial<UploadItemEntity>[],
		manager?: EntityManager,
	): Promise<UploadItemEntity[]> {
		const repository = manager?.getRepository(UploadItemEntity) ?? this.repo;
		const itemEntities = repository.create(items);
		return repository.save(itemEntities);
	}

	/**
	 * Busca items por su sessionId y una lista de blob_names.
	 * Útil para el endpoint de /sas-batch para obtener metadata necesaria.
	 */
	async findBySessionAndBlobNames(
		sessionId: string,
		blobNames: string[],
	): Promise<UploadItemEntity[]> {
		if (!blobNames?.length) return [];
		return this.repo.find({
			where: {
				sessionId: sessionId,
				blobName: In(blobNames),
			},
		});
	}

	/**
	 * Busca todos los items que están listos para ser verificados en una sesión.
	 */
	async findVerifiableItems(
		sessionId: string,
		manager?: EntityManager,
	): Promise<UploadItemEntity[]> {
		const repository = manager?.getRepository(UploadItemEntity) ?? this.repo;
		return repository.find({
			where: {
				sessionId: sessionId,
				status: "UPLOADED" as UploadItemStatus,
			},
		});
	}

	/**
	 * Aborta todos los items no terminales de una sesión.
	 */
	async abortAllPendingItems(
		sessionId: string,
		manager?: EntityManager,
	): Promise<void> {
		const repository = manager?.getRepository(UploadItemEntity) ?? this.repo;
		await repository.update(
			{
				sessionId: sessionId,
				status: In([
					"PENDING" as UploadItemStatus,
					"IN_PROGRESS" as UploadItemStatus,
					"UPLOADED" as UploadItemStatus,
				]),
			},
			{ status: "ABORTED" as UploadItemStatus },
		);
	}

	/**
	 * Cuenta la cantidad de items por estado para una sesión.
	 * Optimizado para no traer todos los registros.
	 */
	async countByStatus(
		sessionId: string,
	): Promise<Record<UploadItemStatus, number>> {
		const counts = await this.repo
			.createQueryBuilder("item")
			.select("item.status", "status")
			.addSelect("COUNT(item.id)", "count")
			.where("item.sessionId = :sessionId", { sessionId })
			.groupBy("item.status")
			.getRawMany<{ status: UploadItemStatus; count: string }>();

		const result = Object.values(UploadItemStatusValues).reduce(
			(acc, status) => {
				acc[status] = 0;
				return acc;
			},
			{} as Record<UploadItemStatus, number>,
		);

		counts.forEach((row) => {
			result[row.status] = parseInt(row.count, 10);
		});

		return result;
	}
}
