import {
	Check,
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	OneToMany,
	OneToOne,
	PrimaryColumn,
	Unique,
} from "typeorm";
import { ClassificationResultOrmEntity } from "./classification-result.orm-entity";
import { ClassifiedSegmentOrmEntity } from "./classified-segment.orm-entity";
import { EvaluationOrmEntity } from "./evaluation.orm-entity";
import { PhotoOrmEntity } from "./photo.orm-entity";

type ClassificationKind = "external" | "internal";

/**
 * TypeORM entity for core.classification_steps table.
 */
// biome-ignore format: true
@Entity({ schema: "core", name: "classification_steps" })
@Unique("uq_classification_steps_eval_kind_iter", ["evaluationId", "kind", "iterationIndex"])
@Check("ck_iteration_index_range", "iteration_index BETWEEN 0 AND 3")
export class ClassificationStepOrmEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Column({ name: "evaluation_id", type: "uuid", nullable: false })
  @Index("idx_classification_steps_evaluation_id")
  evaluationId!: string;

  @Column({
    type: "enum",
    enum: ["external", "internal"],
    enumName: "classification_kind", // usa el enum del schema
    nullable: false,
    name: "kind",
  })
  kind!: ClassificationKind;

  @Column({ name: "iteration_index", type: "integer", nullable: false, default: 0 })
  iterationIndex!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @ManyToOne("EvaluationOrmEntity", "steps", {
    onDelete: "CASCADE",
    nullable: false,
  })
  @JoinColumn({ name: "evaluation_id" })
  evaluation!: EvaluationOrmEntity;

  // Inverse side: el owner del FK es classification_results.step_id
  @OneToOne("ClassificationResultOrmEntity", "step", {
    cascade: ["insert"],
  })
  result?: ClassificationResultOrmEntity;

  @OneToMany("PhotoOrmEntity", "step", {
    cascade: ["insert"],
  })
  photos!: PhotoOrmEntity[];

  @OneToMany("ClassifiedSegmentOrmEntity", "step", {
    cascade: ["insert"],
  })
  segments!: ClassifiedSegmentOrmEntity[];
}
