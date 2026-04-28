import { UUID } from "../../domain/types";

/**
 * Port interface defining the contract for a UUID generation service.
 *
 * @remarks
 * This abstraction decouples the application from specific UUID generation
 * implementations, enabling easier testing and flexibility in ID generation strategies.
 */
export const UUID_GENERATOR = "UuidGenerator";

export interface IUuidGenerator {
	/**
	 * Generates a new UUID v4.
	 *
	 * @returns A string representing the generated UUID
	 *
	 * @remarks
	 * UUID v4 uses random numbers and provides sufficient uniqueness for most
	 * distributed systems without coordination.
	 */
	generate(): UUID;
}
