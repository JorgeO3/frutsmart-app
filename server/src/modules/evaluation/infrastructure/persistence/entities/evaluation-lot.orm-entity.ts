import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import type { EvaluationOrmEntity } from "./evaluation.orm-entity";
import type { LotOrmEntity } from "../../../../catalog/infrastructure/persistence/entities/lot.orm-entity";

/**
 * Entidad puente para core.evaluation_lots (PK compuesta).
 */
@Entity({ schema: "core", name: "evaluation_lots" })
@Index("idx_evaluation_lots_lot_id", ["lotId"])
export class EvaluationLotOrmEntity {
	@PrimaryColumn("uuid", { name: "evaluation_id" })
	evaluationId!: string;

	@PrimaryColumn("uuid", { name: "lot_id" })
	lotId!: string;

	@ManyToOne("EvaluationOrmEntity", "evaluationLots", {
		onDelete: "CASCADE",
		nullable: false,
	})
	@JoinColumn({ name: "evaluation_id" })
	evaluation!: EvaluationOrmEntity;

	@ManyToOne("LotOrmEntity", {
		onDelete: "RESTRICT",
		nullable: false,
	})
	@JoinColumn({ name: "lot_id" })
	lot!: LotOrmEntity;
}
