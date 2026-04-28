import { Evaluation } from "../../../domain/entities/evaluation.entity";
import { EvaluationOrmEntity } from "../entities/evaluation.orm-entity";

/**
 * Token for EvaluationOrmMapper injection
 */
export const EVALUATION_ORM_MAPPER = Symbol("EVALUATION_ORM_MAPPER");

/**
 * Port interface for EvaluationOrmMapper
 * Maps between domain entities and TypeORM entities.
 */
export interface IEvaluationOrmMapper {
	/**
	 * Map TypeORM entity to domain aggregate.
	 */
	toDomain(ormEntity: EvaluationOrmEntity): Evaluation;

	/**
	 * Map domain aggregate to TypeORM entity.
	 */
	toPersistence(evaluation: Evaluation): EvaluationOrmEntity;
}
