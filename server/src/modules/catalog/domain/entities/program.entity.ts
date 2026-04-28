import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import type { UUID } from "../types";

type ProgramProps = {
	id: UUID;
	name: string;
};

/**
 * Program Domain Entity
 * Represents a program in the catalog.
 * Aligned with core.programs table.
 */
export class Program {
	private constructor(private readonly props: ProgramProps) {}

	static create(params: ProgramProps): Program {
		const { id, name } = params;

		if (!id?.trim()) {
			throw new ArgumentInvalidError("Program.id is required");
		}
		if (!name?.trim()) {
			throw new ArgumentInvalidError("Program.name is required");
		}

		return new Program({
			id: id.trim(),
			name: name.trim(),
		});
	}

	rename(newName: string): void {
		if (!newName?.trim()) {
			throw new ArgumentInvalidError("Program.name cannot be empty");
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
