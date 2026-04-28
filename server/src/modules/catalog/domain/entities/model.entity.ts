import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import type { ModelType, UUID } from "../types";
import { MODEL_TYPES } from "../types";

type ModelProps = {
	id: UUID;
	name: string;
	versionTag: string;
	type: ModelType;
};

/**
 * Model Domain Entity
 * Represents an AI model with its version and type.
 * Aligned with core.models table.
 */
export class Model {
	private constructor(private readonly props: ModelProps) {}

	static create(params: ModelProps): Model {
		const { id, name, versionTag, type } = params;

		if (!id?.trim()) {
			throw new ArgumentInvalidError("Model.id is required");
		}
		if (!name?.trim()) {
			throw new ArgumentInvalidError("Model.name is required");
		}
		if (!versionTag?.trim()) {
			throw new ArgumentInvalidError("Model.versionTag is required");
		}
		if (!MODEL_TYPES.includes(type)) {
			throw new ArgumentInvalidError(
				`Model.type must be one of: ${MODEL_TYPES.join(", ")}`,
			);
		}

		return new Model({
			id: id.trim(),
			name: name.trim(),
			versionTag: versionTag.trim(),
			type,
		});
	}

	rename(newName: string): void {
		if (!newName?.trim()) {
			throw new ArgumentInvalidError("Model.name cannot be empty");
		}
		(this.props as { name: string }).name = newName.trim();
	}

	get id(): UUID {
		return this.props.id;
	}

	get name(): string {
		return this.props.name;
	}

	get versionTag(): string {
		return this.props.versionTag;
	}

	get type(): ModelType {
		return this.props.type;
	}
}
