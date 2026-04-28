import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import type { UUID } from "../types";

type CenterProps = {
	id: UUID;
	name: string;
	lotId: UUID;
};

/**
 * Center Domain Entity
 * Represents a center that belongs to a lot.
 * Aligned with core.centers table.
 */
export class Center {
	private constructor(private readonly props: CenterProps) {}

	static create(params: CenterProps): Center {
		const { id, name, lotId } = params;

		if (!id?.trim()) {
			throw new ArgumentInvalidError("Center.id is required");
		}
		if (!name?.trim()) {
			throw new ArgumentInvalidError("Center.name is required");
		}
		if (!lotId?.trim()) {
			throw new ArgumentInvalidError("Center.lotId is required");
		}

		return new Center({
			id: id.trim(),
			name: name.trim(),
			lotId: lotId.trim(),
		});
	}

	rename(newName: string): void {
		if (!newName?.trim()) {
			throw new ArgumentInvalidError("Center.name cannot be empty");
		}
		(this.props as { name: string }).name = newName.trim();
	}

	moveToLot(newLotId: UUID): void {
		if (!newLotId?.trim()) {
			throw new ArgumentInvalidError("Center.lotId cannot be empty");
		}
		(this.props as { lotId: UUID }).lotId = newLotId.trim();
	}

	get id(): UUID {
		return this.props.id;
	}

	get name(): string {
		return this.props.name;
	}

	get lotId(): UUID {
		return this.props.lotId;
	}
}
