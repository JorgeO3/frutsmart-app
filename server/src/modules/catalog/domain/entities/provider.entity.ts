import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import type { UUID } from "../types";

type ProviderProps = {
	id: UUID;
	name: string;
};

/**
 * Provider Domain Entity
 * Represents a provider in the catalog.
 * Aligned with core.providers table.
 */
export class Provider {
	private constructor(private readonly props: ProviderProps) {}

	static create(params: ProviderProps): Provider {
		const { id, name } = params;

		if (!id?.trim()) {
			throw new ArgumentInvalidError("Provider.id is required");
		}
		if (!name?.trim()) {
			throw new ArgumentInvalidError("Provider.name is required");
		}

		return new Provider({
			id: id.trim(),
			name: name.trim(),
		});
	}

	rename(newName: string): void {
		if (!newName?.trim()) {
			throw new ArgumentInvalidError("Provider.name cannot be empty");
		}
		(this.props as { name: string }).name = newName.trim();
	}

	get id(): UUID {
		return this.props.id;
	}

	get name(): string {
		return this.props.name;
	}
}
