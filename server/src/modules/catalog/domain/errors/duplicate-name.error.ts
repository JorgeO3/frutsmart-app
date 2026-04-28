/**
 * Error lanzado cuando se intenta crear una entidad con un nombre que ya existe
 * y viola una restricción de unicidad.
 */
export class DuplicateNameError extends Error {
	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
	}
}
