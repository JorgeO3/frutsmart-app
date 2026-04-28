import {
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

type PhotoRole = "raw" | "segmented" | "cropped";

/**
 * TypeORM entity for core.photos table.
 */
// biome-ignore format: true
@Entity({ schema: "core", name: "photos" })
@Unique("uq_photos_step_upload_item", ["stepId", "uploadItemId"])
export class PhotoOrmEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Column({ name: "step_id", type: "uuid", nullable: false })
  @Index("idx_photos_step_id")
  stepId!: string;

  @Column({
    name: "role",
    type: "enum",
    enum: ["raw", "segmented", "cropped"],
    enumName: "photo_role",
    nullable: false,
  })
  role!: PhotoRole;

  // NOT NULL según schema, FK a core.upload_items(id) ON DELETE CASCADE
  @Column({ name: "upload_item_id", type: "uuid", nullable: false })
  @Index("idx_photos_upload_item_id")
  uploadItemId!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @ManyToOne(() => ClassificationStepOrmEntity, (step) => step.photos, {
    onDelete: "CASCADE",
    nullable: false,
  })
  @JoinColumn({ name: "step_id" })
  step!: ClassificationStepOrmEntity;

  // Relación sugerida para reflejar el FK de DB
  @ManyToOne(() => UploadItemEntity, {
    onDelete: "CASCADE",
    nullable: false,
  })
  @JoinColumn({ name: "upload_item_id" })
  uploadItem!: UploadItemEntity;
}
