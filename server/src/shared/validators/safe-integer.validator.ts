import {
	registerDecorator,
	type ValidationArguments,
	type ValidationOptions,
} from "class-validator";

function toNumberIfString(v: unknown): number | null {
	if (typeof v === "number") return v;
	if (typeof v === "string" && v.trim() !== "") {
		// Solo dígitos opcionalmente con signo
		if (!/^[+-]?\d+$/.test(v.trim())) return null;
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

export function IsSafeInteger(
	validationOptions?: ValidationOptions,
): PropertyDecorator {
	return (obj: object, prop: string | symbol) => {
		registerDecorator({
			name: "IsSafeInteger",
			target: obj.constructor,
			propertyName: prop as string,
			options: validationOptions,
			validator: {
				validate(value: unknown) {
					const n = toNumberIfString(value);
					return n !== null && Number.isSafeInteger(n);
				},
				defaultMessage(args: ValidationArguments) {
					return `${args.property} debe ser un entero seguro (dentro de MIN_SAFE_INTEGER..MAX_SAFE_INTEGER).`;
				},
			},
		});
	};
}

export function IsPositiveInteger(
	validationOptions?: ValidationOptions,
): PropertyDecorator {
	return (obj: object, prop: string | symbol) => {
		registerDecorator({
			name: "IsPositiveInteger",
			target: obj.constructor,
			propertyName: prop as string,
			options: validationOptions,
			validator: {
				validate(value: unknown) {
					const n = toNumberIfString(value);
					return n !== null && Number.isSafeInteger(n) && n >= 1;
				},
				defaultMessage(args: ValidationArguments) {
					return `${args.property} debe ser un entero positivo >= 1.`;
				},
			},
		});
	};
}
