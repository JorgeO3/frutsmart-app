import {
	Entity,
	PrimaryColumn,
	Column,
	Unique,
	ManyToOne,
	JoinColumn,
	Index,
} from "typeorm";
import { LotOrmEntity } from "./lot.orm-entity";

/**
 * TypeORM entity for core.centers table
 */
@Entity({ schema: "core", name: "centers" })
@Unique("uq_centers_lot_name", ["lotId", "name"])
@Index("idx_centers_lot_id", ["lotId"])
export class CenterOrmEntity {
	@PrimaryColumn("uuid")
	id!: string;

	@Column({ type: "text", nullable: false })
	name!: string;

	@Column({ name: "lot_id", type: "uuid", nullable: false })
	lotId!: string;

	@ManyToOne(() => LotOrmEntity, {
		onDelete: "RESTRICT",
	})
	@JoinColumn({ name: "lot_id" })
	lot?: LotOrmEntity;
}
