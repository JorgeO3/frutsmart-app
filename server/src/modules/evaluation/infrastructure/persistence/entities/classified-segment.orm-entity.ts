import {
	Check,
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
	Unique,
} from "typeorm";
import { ClassificationStepOrmEntity } from "./classification-step.orm-entity";
import { UploadItemEntity } from "@modules/upload/infrastructure/persistence/entities/upload-item.orm-entity";

/**
 * TypeORM entity for core.classified_segments table.
 */
// biome-ignore format: true
@Entity({ schema: "core", name: "classified_segments" })
@Unique("uq_classified_segments_step_upload_item", ["stepId", "uploadItemId"])
@Check("ck_best_confidence_range", "best_confidence >= 0 AND best_confidence <= 1")
export class ClassifiedSegmentOrmEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Column({ name: "step_id", type: "uuid", nullable: false })
  @Index("idx_classified_segments_step_id")
  stepId!: string;

  // >>> En el schema es NOT NULL + FK ON DELETE CASCADE
  @Column({ name: "upload_item_id", type: "uuid", nullable: false })
  @Index("idx_classified_segments_upload_item_id")
  uploadItemId!: string;

  @Column({ name: "best_class_name", type: "text", nullable: false })
  bestClassName!: string;

  @Column({ name: "best_confidence", type: "double precision", nullable: false })
  bestConfidence!: number;

  @Column({ name: "confidences_json", type: "jsonb", nullable: false })
  confidencesJson!: Record<string, number>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @ManyToOne(() => ClassificationStepOrmEntity, (step) => step.segments, {
    onDelete: "CASCADE",
    nullable: false,
  })
  @JoinColumn({ name: "step_id" })
  step!: ClassificationStepOrmEntity;

  // (Recomendado) Relación explícita con upload_items para reflejar el FK
  @ManyToOne(() => UploadItemEntity, {
    onDelete: "CASCADE",
    nullable: false,
  })
  @JoinColumn({ name: "upload_item_id" })
  uploadItem!: UploadItemEntity;
}
