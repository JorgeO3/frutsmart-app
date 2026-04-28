import type { ModelType, UUID } from "../../domain/types";

export type ModelOutput = {
	id: UUID;
	name: string;
	versionTag: string;
	type: ModelType;
};

export type ProgramOutput = {
	id: UUID;
	name: string;
};

export type LotOutput = {
	id: UUID;
	name: string;
	programId: UUID;
};

export type CenterOutput = {
	id: UUID;
	name: string;
	lotId: UUID;
};

export type ProviderOutput = {
	id: UUID;
	name: string;
};

export type SubProviderOutput = {
	id: UUID;
	name: string;
	providerId: UUID;
};
