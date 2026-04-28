import {
	Entity,
	Column,
	Index,
	CreateDateColumn,
	UpdateDateColumn,
	OneToMany,
	PrimaryGeneratedColumn,
} from "typeorm";
import {
	type UploadDomain,
	UploadDomainValues,
	type UploadSessionStatus,
	UploadSessionStatusValues,
} from "../../../domain/types";
import type { UploadItemEntity } from "./upload-item.orm-entity";

// biome-ignore format: true
@Entity({ schema: "core", name: "upload_sessions" })
@Index("uq_open_session_by_client_batch_open", ["domain", "clientBatchId"], {
  unique: true,
  where: "status = 'OPEN'::core.upload_session_status",
})
export class UploadSessionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({
    type: "enum",
    enum: UploadDomainValues,
    enumName: "upload_domain",
    name: "domain",
    nullable: false,
  })
  domain!: UploadDomain;

  @Column("uuid", { name: "client_batch_id", nullable: false })
  @Index("idx_session_by_client_batch")
  clientBatchId!: string;

  @Column("uuid", { name: "user_id", nullable: true })
  @Index("idx_session_by_user")
  userId?: string;

  @Column({
    type: "enum",
    enum: UploadSessionStatusValues,
    enumName: "upload_session_status",
    name: "status",
    nullable: false,
  })
  @Index("idx_session_status")
  status!: UploadSessionStatus;

  @OneToMany("UploadItemEntity", "session", { cascade: ['insert', 'update'] })
  items!: UploadItemEntity[];

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
