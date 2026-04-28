import type { Model } from "../../../domain/entities/model.entity";
import type { ModelType, UUID } from "../../../domain/types";

export const MODEL_REPOSITORY = Symbol("MODEL_REPOSITORY");

export interface IModelRepository {
	save(model: Model): Promise<void>;
	findById(id: UUID): Promise<Model | null>;
	existsByNameAndVersionTag(name: string, versionTag: string): Promise<boolean>;
	list(params?: { type?: ModelType }): Promise<Model[]>;
}
