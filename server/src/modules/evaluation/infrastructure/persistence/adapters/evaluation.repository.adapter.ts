import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { IEvaluationRepository } from "../../../application/ports/repositories/evaluation.repository.port";
import { Evaluation } from "../../../domain/entities/evaluation.entity";
import { UUID } from "../../../domain/types";
import { EvaluationOrmEntity } from "../entities/evaluation.orm-entity";
import type { IEvaluationOrmMapper } from "../mappers/evaluation-orm.mapper.port";
import { EVALUATION_ORM_MAPPER } from "../mappers/evaluation-orm.mapper.port";

/**
 * Repository adapter implementing IEvaluationRepository using TypeORM.
 */
@Injectable()
export class EvaluationRepositoryAdapter implements IEvaluationRepository {
	constructor(
		@InjectRepository(EvaluationOrmEntity)
		private readonly repository: Repository<EvaluationOrmEntity>,
		@Inject(EVALUATION_ORM_MAPPER)
		private readonly mapper: IEvaluationOrmMapper,
	) {}

	/**
	 * Save an evaluation (cascades to all children).
	 */
	async save(entity: Evaluation): Promise<void> {
		const orm = this.mapper.toPersistence(entity);
		await this.repository.save(orm);
	}

	/**
	 * Find an evaluation by ID with all relations.
	 */
	async findById(id: UUID): Promise<Evaluation | null> {
		const orm = await this.repository.findOne({
			where: { id },
			relations: ["steps", "steps.result", "steps.photos", "steps.segments"],
		});

		if (!orm) {
			return null;
		}

		return this.mapper.toDomain(orm);
	}
}
