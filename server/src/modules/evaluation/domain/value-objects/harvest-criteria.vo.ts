import { ArgumentInvalidError } from "../errors/argument-invalid.error";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonRecord | JsonValue[];
export type JsonRecord = { [k: string]: JsonValue };

function isPlainObject(v: unknown): v is Record<string, unknown> {
	if (typeof v !== "object" || v === null) return false;
	const proto = Object.getPrototypeOf(v);
	return proto === Object.prototype || proto === null;
}

function isJsonValue(v: unknown, depth = 0, maxDepth = 10): v is JsonValue {
	if (depth > maxDepth) return false;

	if (
		v === null ||
		typeof v === "string" ||
		(typeof v === "number" && Number.isFinite(v)) ||
		typeof v === "boolean"
	)
		return true;

	if (Array.isArray(v)) {
		return v.every((el) => isJsonValue(el, depth + 1, maxDepth));
	}

	if (isPlainObject(v)) {
		return Object.values(v).every((val) =>
			isJsonValue(val, depth + 1, maxDepth),
		);
	}

	return false;
}

function deepFreeze<T>(obj: T): T {
	if (obj && typeof obj === "object") {
		Object.freeze(obj);
		for (const val of Object.values(obj as Record<string, unknown>)) {
			if (val && typeof val === "object" && !Object.isFrozen(val)) {
				deepFreeze(val);
			}
		}
	}
	return obj;
}

/**
 * HarvestCriteria Value Object
 *
 * JSON seguro para persistir (jsonb NOT NULL). Inmutable (deep freeze).
 */
export class HarvestCriteria {
	private constructor(public readonly value: JsonRecord) {}

	/**
	 * Crea el VO desde input arbitrario.
	 * - null/undefined -> {}
	 * - Debe ser Plain Object JSON-serializable (sin funciones, Date, Map, etc.)
	 */
	static from(json: unknown): HarvestCriteria {
		if (json === null || json === undefined) {
			return new HarvestCriteria({});
		}

		if (!isPlainObject(json)) {
			throw new ArgumentInvalidError("HarvestCriteria must be a plain object");
		}

		// Validación de JSON‐serialización profunda
		if (!isJsonValue(json)) {
			throw new ArgumentInvalidError(
				"HarvestCriteria must contain only JSON-serializable values",
			);
		}

		const frozen = deepFreeze({ ...(json as JsonRecord) });
		return new HarvestCriteria(frozen);
	}

	/** Devuelve true si el objeto no tiene claves. */
	isEmpty(): boolean {
		return Object.keys(this.value).length === 0;
	}

	/** Para serialización directa a JSON/DB. */
	toJSON(): JsonRecord {
		return this.value;
	}
}
