import {
	registerDecorator,
	type ValidationArguments,
	type ValidationOptions,
} from "class-validator";

export interface IsSecureContentTypeOptions {
	whitelist?: string[]; // default: ['image/jpeg','image/webp','image/jpg']
	allowParams?: boolean; // default: false
	maxLength?: number; // default: 127
}

// Simple RFC 6838-like (lowercase estricto)
const MIME_TOKEN = "[a-z0-9][a-z0-9!#$&^_.+-]*";
const MIME_RE = new RegExp(`^${MIME_TOKEN}/${MIME_TOKEN}$`);

const DEFAULT_WHITELIST = ["image/jpeg", "image/webp", "image/jpg"];

export function isSecureContentType(
	value: unknown,
	opts?: IsSecureContentTypeOptions,
): boolean {
	if (typeof value !== "string") return false;

	const whitelist = (opts?.whitelist ?? DEFAULT_WHITELIST).map((s) =>
		s.toLowerCase(),
	);
	const allowParams = opts?.allowParams ?? false;
	const maxLength = opts?.maxLength ?? 127;

	const v = value.trim();
	if (v.length === 0 || v.length > maxLength) return false;
	if (!allowParams && v.includes(";")) return false;
	if (!MIME_RE.test(v)) return false;

	return whitelist.includes(v);
}

export function IsSecureContentType(
	options?: IsSecureContentTypeOptions & ValidationOptions,
): PropertyDecorator {
	const { whitelist, allowParams, maxLength, ...validationOptions } =
		options ?? {};
	return (obj: object, prop: string | symbol) => {
		registerDecorator({
			name: "IsSecureContentType",
			target: obj.constructor,
			propertyName: prop as string,
			options: validationOptions,
			constraints: [
				(whitelist ?? DEFAULT_WHITELIST).map((s) => s.toLowerCase()),
				allowParams ?? false,
				maxLength ?? 127,
			],
			validator: {
				validate(value: unknown, args: ValidationArguments) {
					const [wl, ap, mx] = args.constraints as [string[], boolean, number];
					return isSecureContentType(value, {
						whitelist: wl,
						allowParams: ap,
						maxLength: mx,
					});
				},
				defaultMessage(args: ValidationArguments) {
					return `${args.property} tiene un MIME type inválido o no permitido.`;
				},
			},
		});
	};
}
