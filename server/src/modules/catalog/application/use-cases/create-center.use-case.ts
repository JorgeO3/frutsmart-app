import { Inject, Injectable } from "@nestjs/common";
import {
	CENTER_REPOSITORY,
	type ICenterRepository,
} from "../ports/repositories/center.repository.port";
import {
	LOT_REPOSITORY,
	type ILotRepository,
} from "../ports/repositories/lot.repository.port";
import { DuplicateNameError } from "../../domain/errors/duplicate-name.error";
import { ForeignNotFoundError } from "../../domain/errors/foreign-not-found.error";
import { Center } from "../../domain/entities/center.entity";
import type { CreateCenterInput } from "../dto/inputs";
import type { CenterOutput } from "../dto/outputs";

@Injectable()
export class CreateCenterUseCase {
	constructor(
		@Inject(CENTER_REPOSITORY)
		private readonly centerRepo: ICenterRepository,
		@Inject(LOT_REPOSITORY)
		private readonly lotRepo: ILotRepository,
	) {}

	async execute(input: CreateCenterInput): Promise<CenterOutput> {
		// Verify lot exists
		const lot = await this.lotRepo.findById(input.lotId);
		if (!lot) {
			throw new ForeignNotFoundError(`Lot with id "${input.lotId}" not found`);
		}

		// Check uniqueness (lotId, name)
		const exists = await this.centerRepo.existsByLotAndName(
			input.lotId,
			input.name,
		);
		if (exists) {
			throw new DuplicateNameError(
				`Center with name "${input.name}" already exists in lot "${lot.name}"`,
			);
		}

		const center = Center.create({
			id: input.id,
			name: input.name,
			lotId: input.lotId,
		});

		await this.centerRepo.save(center);

		return {
			id: center.id,
			name: center.name,
			lotId: center.lotId,
		};
	}
}
