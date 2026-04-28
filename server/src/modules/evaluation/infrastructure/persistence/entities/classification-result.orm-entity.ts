import {
	Check,
	Column,
	Entity,
	JoinColumn,
	OneToOne,
	PrimaryColumn,
	Unique,
	CreateDateColumn,
} from "typeorm";
import type { ClassificationStepOrmEntity } from "./classification-step.orm-entity";

/**
 * TypeORM entity for core.classification_results table.
 */
// biome-ignore format: true
@Entity({ schema: "core", name: "classification_results" })
@Unique("uq_classification_results_step_id", ["stepId"])
@Check("ck_ai_confidence_range", "ai_confidence >= 0 AND ai_confidence <= 1")
export class ClassificationResultOrmEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Column({ name: "step_id", type: "uuid", nullable: false })
  stepId!: string;

  @Column({ name: "ai_class_name", type: "text", nullable: false })
  aiClassName!: string;

  @Column({ name: "ai_confidence", type: "double precision", nullable: false })
  aiConfidence!: number;

  @Column({ name: "ai_raw_confidences_json", type: "jsonb", nullable: false })
  aiRawConfidencesJson!: Record<string, number>;

  @Column({ name: "hf_is_correct", type: "boolean", nullable: true })
  hfIsCorrect?: boolean | null;

  @Column({ name: "hf_corrected_class_name", type: "text", nullable: true })
  hfCorrectedClassName?: string | null;

  @Column({ name: "hf_observation", type: "text", nullable: true })
  hfObservation?: string | null;

  // DB tiene DEFAULT now() NOT NULL; CreateDateColumn respeta eso sin synchronize
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @OneToOne("ClassificationStepOrmEntity", "result", {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "step_id" })
  step!: ClassificationStepOrmEntity;
}
