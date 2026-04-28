import {
	Entity,
	PrimaryColumn,
	Column,
	Unique,
	ManyToOne,
	JoinColumn,
	Index,
} from "typeorm";
import { ProgramOrmEntity } from "./program.orm-entity";

/**
 * TypeORM entity for core.lots table
 */
@Entity({ schema: "core", name: "lots" })
@Unique("uq_lots_program_name", ["programId", "name"])
@Index("idx_lots_program_id", ["programId"])
export class LotOrmEntity {
	@PrimaryColumn("uuid")
	id!: string;

	@Column({ type: "text", nullable: false })
	name!: string;

	@Column({ name: "program_id", type: "uuid", nullable: false })
	programId!: string;

	@ManyToOne(() => ProgramOrmEntity, {
		onDelete: "RESTRICT",
	})
	@JoinColumn({ name: "program_id" })
	program?: ProgramOrmEntity;
}
