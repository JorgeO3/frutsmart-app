import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";

import { UploadSessionStatus } from "src/modules/upload/domain/types";
import { UploadSessionEntity } from "../entities/upload-session.orm-entity";

@Injectable()
export class UploadSessionsRepo {
	constructor(
		@InjectRepository(UploadSessionEntity)
		private readonly repo: Repository<UploadSessionEntity>,
	) {}

	// ---------------------------------------------------------------------------
	// Queries
	// ---------------------------------------------------------------------------

	async findOpenByBatchId(
		domain: UploadSessionEntity["domain"],
		clientBatchId: string,
		manager?: EntityManager,
	): Promise<UploadSessionEntity | null> {
		const r = manager ? manager.getRepository(UploadSessionEntity) : this.repo;
		return r.findOne({
			where: { domain, clientBatchId, status: "OPEN" as UploadSessionStatus },
		});
	}

	async findByIdWithItems(
		sessionId: string,
		manager?: EntityManager,
	): Promise<UploadSessionEntity | null> {
		const r = manager ? manager.getRepository(UploadSessionEntity) : this.repo;
		return r.findOne({ where: { id: sessionId }, relations: ["items"] });
	}

	async findById(
		sessionId: string,
		manager?: EntityManager,
	): Promise<UploadSessionEntity | null> {
		const r = manager ? manager.getRepository(UploadSessionEntity) : this.repo;
		return r.findOne({ where: { id: sessionId } });
	}

	// ---------------------------------------------------------------------------
	// Commands
	// ---------------------------------------------------------------------------

	/**
	 * Upsert idempotente: inserta una nueva sesión o actualiza una existente.
	 * - Si `session` trae `id`, TypeORM intentará UPDATE; si no, INSERT.
	 * - Acepta `Partial<UploadSessionEntity>` para facilitar uso desde el mapper.
	 * - Respeta cascades definidos en la entidad para `items`.
	 */
	async save(
		session: UploadSessionEntity | Partial<UploadSessionEntity>,
		manager?: EntityManager,
	): Promise<UploadSessionEntity> {
		const r = manager ? manager.getRepository(UploadSessionEntity) : this.repo;

		// Si viene como POJO parcial, creamos la entidad; si ya es entidad, la usamos tal cual.
		const entity =
			session instanceof UploadSessionEntity ? session : r.create(session);

		return r.save(entity);
	}

	/**
	 * Método legacy para INSERT explícito.
	 * Recomendación: preferir `save()` para soportar INSERT/UPDATE.
	 */
	async create(
		session: Partial<UploadSessionEntity>,
		manager?: EntityManager,
	): Promise<UploadSessionEntity> {
		const r = manager ? manager.getRepository(UploadSessionEntity) : this.repo;
		const newSession = r.create(session);
		return r.save(newSession);
	}

	/**
	 * Actualiza solo el estado de la sesión (optimización puntual).
	 */
	async updateStatus(
		sessionId: string,
		status: UploadSessionEntity["status"],
		manager?: EntityManager,
	): Promise<void> {
		const r = manager ? manager.getRepository(UploadSessionEntity) : this.repo;
		await r.update({ id: sessionId }, { status });
	}
}
