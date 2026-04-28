import {
	registerDecorator,
	type ValidationArguments,
	type ValidationOptions,
} from "class-validator";

export interface IsSecureUUIDOptions {
	denylist?: string[]; // UUIDs explícitamente prohibidos
}

export const UUID_V4 =
	"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$";

const UUID_V4_RE =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export function isSecureUUIDv4(
	value: unknown,
	opts?: IsSecureUUIDOptions,
): boolean {
	if (typeof value !== "string") return false;
	const deny = new Set((opts?.denylist ?? []).map((s) => s.toLowerCase()));

	const v = value.trim();
	if (!UUID_V4_RE.test(v)) return false;
	if (v.toLowerCase() === NIL_UUID) return false;
	if (deny.has(v.toLowerCase())) return false;
	return true;
}

export function IsSecureUUID(
	options?: IsSecureUUIDOptions & ValidationOptions,
): PropertyDecorator {
	const { denylist, ...validationOptions } = options ?? {};
	return (target: object, propertyKey: string | symbol) => {
		registerDecorator({
			name: "IsSecureUUID",
			target: target.constructor,
			propertyName: propertyKey as string,
			options: validationOptions,
			constraints: [(denylist ?? []).map((s) => s.toLowerCase())],
			validator: {
				validate(value: unknown, args: ValidationArguments) {
					const [deny] = args.constraints as [string[]];
					return isSecureUUIDv4(value, { denylist: deny });
				},
				defaultMessage(args: ValidationArguments) {
					return `${args.property} no es un UUID v4 válido o está prohibido.`;
				},
			},
		});
	};
}
