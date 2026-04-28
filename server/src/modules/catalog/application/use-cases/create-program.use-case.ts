import { Inject, Injectable } from "@nestjs/common";
import {
	PROGRAM_REPOSITORY,
	type IProgramRepository,
} from "../ports/repositories/program.repository.port";
import { DuplicateNameError } from "../../domain/errors/duplicate-name.error";
import { Program } from "../../domain/entities/program.entity";
import type { CreateProgramInput } from "../dto/inputs";
import type { ProgramOutput } from "../dto/outputs";

@Injectable()
export class CreateProgramUseCase {
	constructor(
		@Inject(PROGRAM_REPOSITORY)
		private readonly programRepo: IProgramRepository,
	) {}

	async execute(input: CreateProgramInput): Promise<ProgramOutput> {
		// Check uniqueness (name)
		const exists = await this.programRepo.existsByName(input.name);
		if (exists) {
			throw new DuplicateNameError(
				`Program with name "${input.name}" already exists`,
			);
		}

		const program = Program.create({
			id: input.id,
			name: input.name,
		});

		await this.programRepo.save(program);

		return {
			id: program.id,
			name: program.name,
		};
	}
}
