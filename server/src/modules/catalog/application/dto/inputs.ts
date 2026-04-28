import type { ModelType, UUID } from "../../domain/types";

export type CreateModelInput = {
	id: UUID;
	name: string;
	versionTag: string;
	type: ModelType;
};

export type CreateProgramInput = {
	id: UUID;
	name: string;
};

export type CreateLotInput = {
	id: UUID;
	name: string;
	programId: UUID;
};

export type CreateCenterInput = {
	id: UUID;
	name: string;
	lotId: UUID;
};

export type CreateProviderInput = {
	id: UUID;
	name: string;
};

export type CreateSubProviderInput = {
	id: UUID;
	name: string;
	providerId: UUID;
};

export type ListLotsInput = {
	programId?: UUID;
};

export type ListCentersInput = {
	lotId?: UUID;
};

export type ListSubProvidersInput = {
	providerId?: UUID;
};
