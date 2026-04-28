import {
	Entity,
	PrimaryColumn,
	Column,
	Index,
	Unique,
	ManyToOne,
	JoinColumn,
	CreateDateColumn,
	UpdateDateColumn,
} from "typeorm";
import { UploadSessionEntity } from "./upload-session.orm-entity";
import {
	type StorageProvider,
	StorageProviderValues,
	type UploadItemStatus,
	UploadItemStatusValues,
} from "../../../domain/types";
import { int8AsNumber } from "../../../../../shared/transformers/int8.transformer";

@Entity({ schema: "core", name: "upload_items" })
@Unique("uq_item_by_session_client", ["sessionId", "clientItemId"])
@Unique("uq_item_by_blob", ["blobContainer", "blobName"])
export class UploadItemEntity {
	@PrimaryColumn("uuid")
	id!: string;

	@Column("uuid", { name: "session_id" })
	@Index("idx_upload_items_session_id")
	sessionId!: string;

	@ManyToOne(
		() => UploadSessionEntity,
		(s) => s.items,
		{
			onDelete: "CASCADE",
			nullable: false,
		},
	)
	@JoinColumn({ name: "session_id" })
	session!: UploadSessionEntity;

	@Column("uuid", { name: "client_item_id", nullable: false })
	clientItemId!: string;

	@Column({
		type: "enum",
		enum: StorageProviderValues,
		enumName: "storage_provider",
		default: "azure" as StorageProvider,
		name: "storage_provider",
	})
	storageProvider!: StorageProvider;

	@Column("text", { name: "blob_container", nullable: false })
	blobContainer!: string;

	@Column("text", { name: "blob_name", nullable: false })
	blobName!: string;

	@Column("text", { name: "content_type", nullable: false })
	contentType!: string;

	@Column("bigint", {
		name: "size_bytes",
		nullable: false,
		transformer: int8AsNumber,
	})
	sizeBytes!: number;

	@Column("text", { name: "md5", nullable: false })
	md5!: string;

	@Column({
		type: "enum",
		enum: UploadItemStatusValues,
		enumName: "upload_item_status",
		default: "PENDING" as UploadItemStatus,
		name: "status",
	})
	@Index("idx_upload_items_status")
	status!: UploadItemStatus;

	@CreateDateColumn({ type: "timestamptz", name: "created_at" })
	createdAt!: Date;

	@UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
	updatedAt!: Date;
}
