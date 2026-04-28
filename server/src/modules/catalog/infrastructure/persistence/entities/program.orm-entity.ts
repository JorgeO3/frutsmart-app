import { Entity, PrimaryColumn, Column, Unique } from "typeorm";

/**
 * TypeORM entity for core.programs table
 */
@Entity({ schema: "core", name: "programs" })
@Unique("uq_programs_name", ["name"])
export class ProgramOrmEntity {
	@PrimaryColumn("uuid")
	id!: string;

	@Column({ type: "text", nullable: false })
	name!: string;
}
