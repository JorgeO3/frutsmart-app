/**
 * Error lanzado cuando un argumento proporcionado a un método o constructor
 * de una entidad de dominio o VO es inválido (ej: nulo, vacío, fuera de rango).
 *
 * Hereda de DomainError para una categorización más clara.
 */
export class ArgumentInvalidError extends Error {
	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
	}
}
