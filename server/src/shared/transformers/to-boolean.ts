export const INVALID_BOOLEAN = Symbol("INVALID_BOOLEAN");

export function toBooleanStrictOrInvalid(
	v: unknown,
): boolean | undefined | typeof INVALID_BOOLEAN {
	if (v === undefined) return undefined; // no enviado -> opcional
	if (v === true || v === false) return v;

	if (typeof v === "string") {
		const s = v.trim().toLowerCase();
		if (s === "true") return true;
		if (s === "false") return false;
	}

	// importante: null, números, objetos, arrays, "yes"/"no", etc. -> inválidos
	return INVALID_BOOLEAN;
}
