import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
	MODEL_REPOSITORY,
	type IModelRepository,
} from "../ports/repositories/model.repository.port";
import {
	PROGRAM_REPOSITORY,
	type IProgramRepository,
} from "../ports/repositories/program.repository.port";
import {
	LOT_REPOSITORY,
	type ILotRepository,
} from "../ports/repositories/lot.repository.port";
import {
	CENTER_REPOSITORY,
	type ICenterRepository,
} from "../ports/repositories/center.repository.port";
import {
	PROVIDER_REPOSITORY,
	type IProviderRepository,
} from "../ports/repositories/provider.repository.port";
import {
	SUB_PROVIDER_REPOSITORY,
	type ISubProviderRepository,
} from "../ports/repositories/sub-provider.repository.port";
import type { UUID } from "../../domain/types";
import type {
	ModelOutput,
	ProgramOutput,
	LotOutput,
	CenterOutput,
	ProviderOutput,
	SubProviderOutput,
} from "../dto/outputs";

@Injectable()
export class GetModelByIdUseCase {
	constructor(
		@Inject(MODEL_REPOSITORY)
		private readonly modelRepo: IModelRepository,
	) {}

	async execute(id: UUID): Promise<ModelOutput> {
		const model = await this.modelRepo.findById(id);
		if (!model) {
			throw new NotFoundException(`Model with id "${id}" not found`);
		}
		return {
			id: model.id,
			name: model.name,
			versionTag: model.versionTag,
			type: model.type,
		};
	}
}

@Injectable()
export class GetProgramByIdUseCase {
	constructor(
		@Inject(PROGRAM_REPOSITORY)
		private readonly programRepo: IProgramRepository,
	) {}

	async execute(id: UUID): Promise<ProgramOutput> {
		const program = await this.programRepo.findById(id);
		if (!program) {
			throw new NotFoundException(`Program with id "${id}" not found`);
		}
		return {
			id: program.id,
			name: program.name,
		};
	}
}

@Injectable()
export class GetLotByIdUseCase {
	constructor(
		@Inject(LOT_REPOSITORY)
		private readonly lotRepo: ILotRepository,
	) {}

	async execute(id: UUID): Promise<LotOutput> {
		const lot = await this.lotRepo.findById(id);
		if (!lot) {
			throw new NotFoundException(`Lot with id "${id}" not found`);
		}
		return {
			id: lot.id,
			name: lot.name,
			programId: lot.programId,
		};
	}
}

@Injectable()
export class GetCenterByIdUseCase {
	constructor(
		@Inject(CENTER_REPOSITORY)
		private readonly centerRepo: ICenterRepository,
	) {}

	async execute(id: UUID): Promise<CenterOutput> {
		const center = await this.centerRepo.findById(id);
		if (!center) {
			throw new NotFoundException(`Center with id "${id}" not found`);
		}
		return {
			id: center.id,
			name: center.name,
			lotId: center.lotId,
		};
	}
}

@Injectable()
export class GetProviderByIdUseCase {
	constructor(
		@Inject(PROVIDER_REPOSITORY)
		private readonly providerRepo: IProviderRepository,
	) {}

	async execute(id: UUID): Promise<ProviderOutput> {
		const provider = await this.providerRepo.findById(id);
		if (!provider) {
			throw new NotFoundException(`Provider with id "${id}" not found`);
		}
		return {
			id: provider.id,
			name: provider.name,
		};
	}
}

@Injectable()
export class GetSubProviderByIdUseCase {
	constructor(
		@Inject(SUB_PROVIDER_REPOSITORY)
		private readonly subProviderRepo: ISubProviderRepository,
	) {}

	async execute(id: UUID): Promise<SubProviderOutput> {
		const subProvider = await this.subProviderRepo.findById(id);
		if (!subProvider) {
			throw new NotFoundException(`SubProvider with id "${id}" not found`);
		}
		return {
			id: subProvider.id,
			name: subProvider.name,
			providerId: subProvider.providerId,
		};
	}
}
