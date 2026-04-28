import { Entity, PrimaryColumn, Column, Unique } from "typeorm";

/**
 * TypeORM entity for core.models table
 */
@Entity({ schema: "core", name: "models" })
@Unique("uq_models_name_version", ["name", "versionTag"])
export class ModelOrmEntity {
	@PrimaryColumn("uuid")
	id!: string;

	@Column({ type: "text", nullable: false })
	name!: string;

	@Column({ name: "version_tag", type: "text", nullable: false })
	versionTag!: string;

	@Column({
		type: "enum",
		enum: ["detection", "external_classification", "internal_classification"],
		enumName: "model_kind",
		nullable: false,
	})
	type!: "detection" | "external_classification" | "internal_classification";
}
