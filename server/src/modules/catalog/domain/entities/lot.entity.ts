import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import type { UUID } from "../types";

type LotProps = {
	id: UUID;
	name: string;
	programId: UUID;
};

/**
 * Lot Domain Entity
 * Represents a lot that belongs to a program.
 * Aligned with core.lots table.
 */
export class Lot {
	private constructor(private readonly props: LotProps) {}

	static create(params: LotProps): Lot {
		const { id, name, programId } = params;

		if (!id?.trim()) {
			throw new ArgumentInvalidError("Lot.id is required");
		}
		if (!name?.trim()) {
			throw new ArgumentInvalidError("Lot.name is required");
		}
		if (!programId?.trim()) {
			throw new ArgumentInvalidError("Lot.programId is required");
		}

		return new Lot({
			id: id.trim(),
			name: name.trim(),
			programId: programId.trim(),
		});
	}

	rename(newName: string): void {
		if (!newName?.trim()) {
			throw new ArgumentInvalidError("Lot.name cannot be empty");
		}
		(this.props as { name: string }).name = newName.trim();
	}

	moveToProgram(newProgramId: UUID): void {
		if (!newProgramId?.trim()) {
			throw new ArgumentInvalidError("Lot.programId cannot be empty");
		}
		(this.props as { programId: UUID }).programId = newProgramId.trim();
	}

	get id(): UUID {
		return this.props.id;
	}

	get name(): string {
		return this.props.name;
	}

	get programId(): UUID {
		return this.props.programId;
	}
}
