import { Inject, Injectable } from "@nestjs/common";
import {
	SUB_PROVIDER_REPOSITORY,
	type ISubProviderRepository,
} from "../ports/repositories/sub-provider.repository.port";
import {
	PROVIDER_REPOSITORY,
	type IProviderRepository,
} from "../ports/repositories/provider.repository.port";
import { DuplicateNameError } from "../../domain/errors/duplicate-name.error";
import { ForeignNotFoundError } from "../../domain/errors/foreign-not-found.error";
import { SubProvider } from "../../domain/entities/sub-provider.entity";
import type { CreateSubProviderInput } from "../dto/inputs";
import type { SubProviderOutput } from "../dto/outputs";

@Injectable()
export class CreateSubProviderUseCase {
	constructor(
		@Inject(SUB_PROVIDER_REPOSITORY)
		private readonly subProviderRepo: ISubProviderRepository,
		@Inject(PROVIDER_REPOSITORY)
		private readonly providerRepo: IProviderRepository,
	) {}

	async execute(input: CreateSubProviderInput): Promise<SubProviderOutput> {
		// Verify provider exists
		const provider = await this.providerRepo.findById(input.providerId);
		if (!provider) {
			throw new ForeignNotFoundError(
				`Provider with id "${input.providerId}" not found`,
			);
		}

		// Check uniqueness (providerId, name)
		const exists = await this.subProviderRepo.existsByProviderAndName(
			input.providerId,
			input.name,
		);
		if (exists) {
			throw new DuplicateNameError(
				`SubProvider with name "${input.name}" already exists in provider "${provider.name}"`,
			);
		}

		const subProvider = SubProvider.create({
			id: input.id,
			name: input.name,
			providerId: input.providerId,
		});

		await this.subProviderRepo.save(subProvider);

		return {
			id: subProvider.id,
			name: subProvider.name,
			providerId: subProvider.providerId,
		};
	}
}
