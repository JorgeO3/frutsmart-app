import { Inject, Injectable } from "@nestjs/common";
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
import type { ModelType } from "../../domain/types";
import type {
	ModelOutput,
	ProgramOutput,
	LotOutput,
	CenterOutput,
	ProviderOutput,
	SubProviderOutput,
} from "../dto/outputs";
import type {
	ListLotsInput,
	ListCentersInput,
	ListSubProvidersInput,
} from "../dto/inputs";

@Injectable()
export class ListModelsUseCase {
	constructor(
		@Inject(MODEL_REPOSITORY)
		private readonly modelRepo: IModelRepository,
	) {}

	async execute(params?: { type?: ModelType }): Promise<ModelOutput[]> {
		const models = await this.modelRepo.list(params);
		return models.map((m) => ({
			id: m.id,
			name: m.name,
			versionTag: m.versionTag,
			type: m.type,
		}));
	}
}

@Injectable()
export class ListProgramsUseCase {
	constructor(
		@Inject(PROGRAM_REPOSITORY)
		private readonly programRepo: IProgramRepository,
	) {}

	async execute(): Promise<ProgramOutput[]> {
		const programs = await this.programRepo.list();
		return programs.map((p) => ({
			id: p.id,
			name: p.name,
		}));
	}
}

@Injectable()
export class ListLotsUseCase {
	constructor(
		@Inject(LOT_REPOSITORY)
		private readonly lotRepo: ILotRepository,
	) {}

	async execute(input?: ListLotsInput): Promise<LotOutput[]> {
		const lots = await this.lotRepo.list(input);
		return lots.map((l) => ({
			id: l.id,
			name: l.name,
			programId: l.programId,
		}));
	}
}

@Injectable()
export class ListCentersUseCase {
	constructor(
		@Inject(CENTER_REPOSITORY)
		private readonly centerRepo: ICenterRepository,
	) {}

	async execute(input?: ListCentersInput): Promise<CenterOutput[]> {
		const centers = await this.centerRepo.list(input);
		return centers.map((c) => ({
			id: c.id,
			name: c.name,
			lotId: c.lotId,
		}));
	}
}

@Injectable()
export class ListProvidersUseCase {
	constructor(
		@Inject(PROVIDER_REPOSITORY)
		private readonly providerRepo: IProviderRepository,
	) {}

	async execute(): Promise<ProviderOutput[]> {
		const providers = await this.providerRepo.list();
		return providers.map((p) => ({
			id: p.id,
			name: p.name,
		}));
	}
}

@Injectable()
export class ListSubProvidersUseCase {
	constructor(
		@Inject(SUB_PROVIDER_REPOSITORY)
		private readonly subProviderRepo: ISubProviderRepository,
	) {}

	async execute(input?: ListSubProvidersInput): Promise<SubProviderOutput[]> {
		const subProviders = await this.subProviderRepo.list(input);
		return subProviders.map((sp) => ({
			id: sp.id,
			name: sp.name,
			providerId: sp.providerId,
		}));
	}
}
