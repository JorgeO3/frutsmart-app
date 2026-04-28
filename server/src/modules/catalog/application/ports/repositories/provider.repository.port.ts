import type { Provider } from "../../../domain/entities/provider.entity";
import type { UUID } from "../../../domain/types";

export const PROVIDER_REPOSITORY = Symbol("PROVIDER_REPOSITORY");

export interface IProviderRepository {
	save(provider: Provider): Promise<void>;
	findById(id: UUID): Promise<Provider | null>;
	existsByName(name: string): Promise<boolean>;
	list(): Promise<Provider[]>;
}
