// src/shared/db/pg-unique-violation.ts
import { QueryFailedError } from "typeorm";

export const PG_UNIQUE_VIOLATION = "23505";

/** Forma genérica de error de pg que nos interesa */
export interface PgErrorShape {
	code?: string; // '23505', etc.
	constraint?: string;
	detail?: string;
	schema?: string;
	table?: string;
}

/** Guard sencillo: ¿tiene "code" string? */
function isPgErrorShape(e: unknown): e is PgErrorShape {
	if (typeof e !== "object" || e === null) return false;
	if (!("code" in e)) return false;

	// aquí ya sabemos que 'code' existe; lo leemos con tipo seguro
	const { code } = e as { code: unknown };
	return typeof code === "string";
}

/** Guard: ¿es QueryFailedError de TypeORM? */
function isTypeOrmQueryFailedError(e: unknown): e is QueryFailedError {
	return e instanceof QueryFailedError;
}

/** API pública: ¿es una violación de unicidad (23505)? */
export function isUniqueViolation(e: unknown): boolean {
	// Caso TypeORM: el código viene en driverError
	if (isTypeOrmQueryFailedError(e)) {
		const de = e.driverError;
		return isPgErrorShape(de) && de.code === PG_UNIQUE_VIOLATION;
	}

	// En algunos stacks podrías recibir directamente el error de pg
	if (isPgErrorShape(e)) {
		return e.code === PG_UNIQUE_VIOLATION;
	}

	return false;
}
