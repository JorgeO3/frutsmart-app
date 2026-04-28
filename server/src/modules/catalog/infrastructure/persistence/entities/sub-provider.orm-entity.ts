import {
	Entity,
	PrimaryColumn,
	Column,
	Unique,
	ManyToOne,
	JoinColumn,
	Index,
} from "typeorm";
import { ProviderOrmEntity } from "./provider.orm-entity";

/**
 * TypeORM entity for core.sub_providers table
 */
@Entity({ schema: "core", name: "sub_providers" })
@Unique("uq_sub_providers_provider_name", ["providerId", "name"])
@Index("idx_sub_providers_provider_id", ["providerId"])
export class SubProviderOrmEntity {
	@PrimaryColumn("uuid")
	id!: string;

	@Column({ type: "text", nullable: false })
	name!: string;

	@Column({ name: "provider_id", type: "uuid", nullable: false })
	providerId!: string;

	@ManyToOne(() => ProviderOrmEntity, {
		onDelete: "RESTRICT",
	})
	@JoinColumn({ name: "provider_id" })
	provider?: ProviderOrmEntity;
}
