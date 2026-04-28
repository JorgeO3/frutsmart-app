import { Inject, Injectable } from "@nestjs/common";
import {
	MODEL_REPOSITORY,
	type IModelRepository,
} from "../ports/repositories/model.repository.port";
import { DuplicateNameError } from "../../domain/errors/duplicate-name.error";
import { Model } from "../../domain/entities/model.entity";
import type { CreateModelInput } from "../dto/inputs";
import type { ModelOutput } from "../dto/outputs";

@Injectable()
export class CreateModelUseCase {
	constructor(
		@Inject(MODEL_REPOSITORY)
		private readonly modelRepo: IModelRepository,
	) {}

	async execute(input: CreateModelInput): Promise<ModelOutput> {
		// Check uniqueness (name, versionTag)
		const exists = await this.modelRepo.existsByNameAndVersionTag(
			input.name,
			input.versionTag,
		);
		if (exists) {
			throw new DuplicateNameError(
				`Model with name "${input.name}" and version "${input.versionTag}" already exists`,
			);
		}

		const model = Model.create({
			id: input.id,
			name: input.name,
			versionTag: input.versionTag,
			type: input.type,
		});

		await this.modelRepo.save(model);

		return {
			id: model.id,
			name: model.name,
			versionTag: model.versionTag,
			type: model.type,
		};
	}
}
