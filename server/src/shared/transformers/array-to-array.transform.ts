import { Transform, type TransformFnParams } from "class-transformer";

/**
 * Garantiza que el valor permanezca como array al deserializar (toClass).
 * Corrige casos donde enableImplicitConversion termina con objetos indexados.
 *
 * Uso en DTO:
 *   @ArrayToArray()
 *   @IsUUID('4', { each: true })
 *   ids: string[];
 */
export function ArrayToArray(): PropertyDecorator {
	return Transform(
		({ value }: TransformFnParams) => {
			if (Array.isArray(value)) return value;

			// {0: 'a', 1: 'b'} -> ['a','b'] si las claves son 0..n
			if (value && typeof value === "object") {
				const entries = Object.entries(value as Record<string, unknown>);
				if (entries.length === 0) return [];

				// Verifica que TODOS sean índices numéricos consecutivos y arma en orden
				const nums = entries.map(([k]) => Number(k));
				const isArrayLike =
					nums.every((n) => Number.isInteger(n) && n >= 0) &&
					nums.length === Math.max(...nums) + 1;

				if (isArrayLike) {
					return entries
						.sort(([a], [b]) => Number(a) - Number(b))
						.map(([, v]) => v);
				}
			}
			return value;
		},
		{ toClassOnly: true },
	);
}
