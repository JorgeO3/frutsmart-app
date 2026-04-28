/**
 * Error lanzado cuando una entidad referencia un recurso padre que no existe.
 */
export class ForeignNotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
	}
}
