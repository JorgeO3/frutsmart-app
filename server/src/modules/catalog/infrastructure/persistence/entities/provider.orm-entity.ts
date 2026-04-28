import { Entity, PrimaryColumn, Column, Unique } from "typeorm";

/**
 * TypeORM entity for core.providers table
 */
@Entity({ schema: "core", name: "providers" })
@Unique("uq_providers_name", ["name"])
export class ProviderOrmEntity {
	@PrimaryColumn("uuid")
	id!: string;

	@Column({ type: "text", nullable: false })
	name!: string;
}
