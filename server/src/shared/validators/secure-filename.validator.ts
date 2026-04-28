import {
	registerDecorator,
	type ValidationArguments,
	type ValidationOptions,
} from "class-validator";

export interface IsSecureFileNameOptions {
	maxLength?: number; // default 255
	rejectNkfcChanges?: boolean; // default true (recomendado)
}

const WIN_RESERVED = new Set([
	"CON",
	"PRN",
	"AUX",
	"NUL",
	...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
	...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`),
]);

// Solo ASCII visible (0x20–0x7E)
const ASCII_VISIBLE_RE = /^[\x20-\x7E]+$/;
// Invisibles/format (ZWSP/ZWJ/RLM/etc.)
const INVISIBLE_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/;
// Whitelist
const FILENAME_ALLOWED_RE = /^[A-Za-z0-9 _.-]+$/;

export function isSecureFileName(
	value: unknown,
	opts?: IsSecureFileNameOptions,
): boolean {
	if (typeof value !== "string") return false;

	const maxLength = opts?.maxLength ?? 255;
	const rejectNkfcChanges = opts?.rejectNkfcChanges ?? true;

	// 1) charset
	if (!ASCII_VISIBLE_RE.test(value)) return false;
	if (INVISIBLE_RE.test(value)) return false;

	// 2) homoglifos (opcional pero recomendado)
	if (rejectNkfcChanges && value.normalize("NFKC") !== value) return false;

	const name = value; // no normalizamos aquí
	if (name.length === 0 || name.length > maxLength) return false;

	// 3) separadores / traversal
	if (name.includes("/") || name.includes("\\")) return false;
	if (name.includes("..")) return false;

	// 4) sin punto/espacio al inicio o al final
	const first = name[0],
		last = name[name.length - 1];
	if (first === "." || first === " " || last === "." || last === " ")
		return false;

	// 5) NO espacios pegados al punto (ni antes ni después)
	if (/\s\./.test(name) || /\.\s/.test(name)) return false;

	// 6) no todo puntos
	if ([...name].every((ch) => ch === ".")) return false;

	// 7) reservados Windows (base antes del primer '.')
	const base = name.split(".", 1)[0].toUpperCase();
	if (WIN_RESERVED.has(base)) return false;

	// 8) whitelist + cinturón/tirantes
	if (!FILENAME_ALLOWED_RE.test(name)) return false;
	for (const bad of ["<", ">", ":", '"', "|", "?", "*"]) {
		if (name.includes(bad)) return false;
	}

	return true;
}

export function IsSecureFileName(
	options?: IsSecureFileNameOptions & ValidationOptions,
): PropertyDecorator {
	const { maxLength, rejectNkfcChanges, ...validationOptions } = options ?? {};
	return (obj: object, prop: string | symbol) => {
		registerDecorator({
			name: "IsSecureFileName",
			target: obj.constructor,
			propertyName: prop as string,
			options: validationOptions,
			constraints: [maxLength ?? 255, rejectNkfcChanges ?? true],
			validator: {
				validate(value: unknown, args: ValidationArguments) {
					const [mx, rnkfc] = args.constraints as [number, boolean];
					return isSecureFileName(value, {
						maxLength: mx,
						rejectNkfcChanges: rnkfc,
					});
				},
				defaultMessage(args: ValidationArguments) {
					return `${args.property} contiene un nombre de archivo inseguro.`;
				},
			},
		});
	};
}
