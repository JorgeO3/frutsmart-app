import type { Program } from "../../../domain/entities/program.entity";
import type { UUID } from "../../../domain/types";

export const PROGRAM_REPOSITORY = Symbol("PROGRAM_REPOSITORY");

export interface IProgramRepository {
	save(program: Program): Promise<void>;
	findById(id: UUID): Promise<Program | null>;
	existsByName(name: string): Promise<boolean>;
	list(): Promise<Program[]>;
}
