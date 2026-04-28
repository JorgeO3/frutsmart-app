/**
 * Error lanzado cuando un argumento proporcionado a un método o constructor
 * de una entidad de dominio es inválido (ej: nulo, vacío, fuera de rango).
 */
export class ArgumentInvalidError extends Error {
	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
	}
}
