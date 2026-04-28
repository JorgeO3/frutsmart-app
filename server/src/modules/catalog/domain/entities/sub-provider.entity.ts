import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import type { UUID } from "../types";

type SubProviderProps = {
	id: UUID;
	name: string;
	providerId: UUID;
};

/**
 * SubProvider Domain Entity
 * Represents a sub-provider that belongs to a provider.
 * Aligned with core.sub_providers table.
 */
export class SubProvider {
	private constructor(private readonly props: SubProviderProps) {}

	static create(params: SubProviderProps): SubProvider {
		const { id, name, providerId } = params;

		if (!id?.trim()) {
			throw new ArgumentInvalidError("SubProvider.id is required");
		}
		if (!name?.trim()) {
			throw new ArgumentInvalidError("SubProvider.name is required");
		}
		if (!providerId?.trim()) {
			throw new ArgumentInvalidError("SubProvider.providerId is required");
		}

		return new SubProvider({
			id: id.trim(),
			name: name.trim(),
			providerId: providerId.trim(),
		});
	}

	rename(newName: string): void {
		if (!newName?.trim()) {
			throw new ArgumentInvalidError("SubProvider.name cannot be empty");
		}
		(this.props as { name: string }).name = newName.trim();
	}

	moveToProvider(newProviderId: UUID): void {
		if (!newProviderId?.trim()) {
			throw new ArgumentInvalidError("SubProvider.providerId cannot be empty");
		}
		(this.props as { providerId: UUID }).providerId = newProviderId.trim();
	}

	get id(): UUID {
		return this.props.id;
	}

	get name(): string {
		return this.props.name;
	}

	get providerId(): UUID {
		return this.props.providerId;
	}
}
