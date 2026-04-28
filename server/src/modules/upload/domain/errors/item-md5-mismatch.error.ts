import { UUID } from "../types";

/**
 * Error lanzado después de una subida si el hash MD5 calculado del archivo
 * no coincide con el hash MD5 proporcionado por el cliente.
 */
export class ItemMD5MismatchError extends Error {
	constructor(itemId: UUID) {
		super(
			`MD5 hash mismatch for item '${itemId}'. The uploaded file may be corrupt.`,
		);
		this.name = this.constructor.name;
	}
}
