import type { SubProvider } from "../../../domain/entities/sub-provider.entity";
import type { UUID } from "../../../domain/types";

export const SUB_PROVIDER_REPOSITORY = Symbol("SUB_PROVIDER_REPOSITORY");

export interface ISubProviderRepository {
	save(subProvider: SubProvider): Promise<void>;
	findById(id: UUID): Promise<SubProvider | null>;
	existsByProviderAndName(providerId: UUID, name: string): Promise<boolean>;
	list(params?: { providerId?: UUID }): Promise<SubProvider[]>;
}
