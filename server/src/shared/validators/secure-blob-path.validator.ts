import {
	registerDecorator,
	type ValidationArguments,
	type ValidationOptions,
} from "class-validator";
import { isSecureFileName } from "./secure-filename.validator";

export interface IsSecureBlobPathOptions {
	maxLength?: number; // default 1024
	segmentMaxLength?: number; // default 255
	rejectNkfcChanges?: boolean; // default true
}

const ASCII_VISIBLE_RE = /^[\x20-\x7E]+$/; // solo ASCII visible
const INVISIBLE_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/; // zero-width & bidi

export function isSecureBlobPath(
	value: unknown,
	opts?: IsSecureBlobPathOptions,
): boolean {
	if (typeof value !== "string") return false;

	const maxLength = opts?.maxLength ?? 1024;
	const segMax = opts?.segmentMaxLength ?? 255;
	const rejectNfkc = opts?.rejectNkfcChanges ?? true;

	const raw = value;

	// 1) Longitud y charset
	if (raw.length === 0 || raw.length > maxLength) return false;
	if (!ASCII_VISIBLE_RE.test(raw)) return false; // bloquea \x00, \r, \n, \t, ESC, DEL, etc.
	if (INVISIBLE_RE.test(raw)) return false; // bloquea ZWSP/ZWNJ/ZWJ/BiDi, etc.
	if (rejectNfkc && raw.normalize("NFKC") !== raw) return false; // evita homoglifos

	// 2) Prohibidos absolutos a nivel de path
	if (raw.includes("%")) return false; // bloquea %00, %0d%0a, %255C, etc. (y double-encoding)
	if (raw.includes("\\")) return false; // backslash
	if (raw.startsWith("/") || raw.endsWith("/")) return false;
	if (raw.includes("//")) return false;
	if (raw.includes("/./")) return false;
	if (raw.includes("/../")) return false;
	if (raw.includes("..")) return false; // evita traversal y “file..jpg”

	// 3) Validación por segmentos
	const segments = raw.split("/");
	if (segments.some((s) => s.length === 0)) return false;

	for (const seg of segments) {
		if (seg.length > segMax) return false;
		// Reutiliza la política dura del filename (ASCII visible + whitelist)
		if (!isSecureFileName(seg, { maxLength: segMax })) return false;
	}

	return true;
}

export function IsSecureBlobPath(
	options?: IsSecureBlobPathOptions & ValidationOptions,
): PropertyDecorator {
	const { maxLength, segmentMaxLength, ...validationOptions } = options ?? {};
	return (obj: object, prop: string | symbol) => {
		registerDecorator({
			name: "IsSecureBlobPath",
			target: obj.constructor,
			propertyName: prop as string,
			options: validationOptions,
			constraints: [maxLength ?? 1024, segmentMaxLength ?? 255],
			validator: {
				validate(value: unknown, args: ValidationArguments) {
					const [mx, segMx] = args.constraints as [number, number];
					return isSecureBlobPath(value, {
						maxLength: mx,
						segmentMaxLength: segMx,
					});
				},
				defaultMessage(args: ValidationArguments) {
					return `${args.property} contiene un blob path inseguro.`;
				},
			},
		});
	};
}
