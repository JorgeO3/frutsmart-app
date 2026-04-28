import { Inject, Injectable } from "@nestjs/common";
import {
	LOT_REPOSITORY,
	type ILotRepository,
} from "../ports/repositories/lot.repository.port";
import {
	PROGRAM_REPOSITORY,
	type IProgramRepository,
} from "../ports/repositories/program.repository.port";
import { DuplicateNameError } from "../../domain/errors/duplicate-name.error";
import { ForeignNotFoundError } from "../../domain/errors/foreign-not-found.error";
import { Lot } from "../../domain/entities/lot.entity";
import type { CreateLotInput } from "../dto/inputs";
import type { LotOutput } from "../dto/outputs";

@Injectable()
export class CreateLotUseCase {
	constructor(
		@Inject(LOT_REPOSITORY)
		private readonly lotRepo: ILotRepository,
		@Inject(PROGRAM_REPOSITORY)
		private readonly programRepo: IProgramRepository,
	) {}

	async execute(input: CreateLotInput): Promise<LotOutput> {
		// Verify program exists
		const program = await this.programRepo.findById(input.programId);
		if (!program) {
			throw new ForeignNotFoundError(
				`Program with id "${input.programId}" not found`,
			);
		}

		// Check uniqueness (programId, name)
		const exists = await this.lotRepo.existsByProgramAndName(
			input.programId,
			input.name,
		);
		if (exists) {
			throw new DuplicateNameError(
				`Lot with name "${input.name}" already exists in program "${program.name}"`,
			);
		}

		const lot = Lot.create({
			id: input.id,
			name: input.name,
			programId: input.programId,
		});

		await this.lotRepo.save(lot);

		return {
			id: lot.id,
			name: lot.name,
			programId: lot.programId,
		};
	}
}
