import { Inject, Injectable } from "@nestjs/common";
import {
	PROVIDER_REPOSITORY,
	type IProviderRepository,
} from "../ports/repositories/provider.repository.port";
import { DuplicateNameError } from "../../domain/errors/duplicate-name.error";
import { Provider } from "../../domain/entities/provider.entity";
import type { CreateProviderInput } from "../dto/inputs";
import type { ProviderOutput } from "../dto/outputs";

@Injectable()
export class CreateProviderUseCase {
	constructor(
		@Inject(PROVIDER_REPOSITORY)
		private readonly providerRepo: IProviderRepository,
	) {}

	async execute(input: CreateProviderInput): Promise<ProviderOutput> {
		// Check uniqueness (name)
		const exists = await this.providerRepo.existsByName(input.name);
		if (exists) {
			throw new DuplicateNameError(
				`Provider with name "${input.name}" already exists`,
			);
		}

		const provider = Provider.create({
			id: input.id,
			name: input.name,
		});

		await this.providerRepo.save(provider);

		return {
			id: provider.id,
			name: provider.name,
		};
	}
}
