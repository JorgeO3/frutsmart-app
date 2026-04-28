/**
 * Error lanzado cuando se viola una restricción de unicidad en la base de datos.
 */
export class UniqueViolationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
	}
}
