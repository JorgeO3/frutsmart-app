import {
	registerDecorator,
	type ValidationArguments,
	type ValidationOptions,
} from "class-validator";

export interface NoSqlInjectionOptions {
	// Permitir explícitamente el carácter '$' (desaconsejado)
	allowDollar?: boolean; // default: false
}

const SUSPICIOUS_RE =
	/(\$|\b(or|and|where|ne|gt|lt|gte|lte|in|nin|regex)\b|\{|\}|\[|\]|;|--|#)/i;

function hasControlChars(s: string): boolean {
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		if (c < 32 || c === 127) return true;
	}
	return false;
}

export function NoSqlInjection(
	options?: NoSqlInjectionOptions & ValidationOptions,
): PropertyDecorator {
	const { allowDollar, ...validationOptions } = options ?? {};
	return (obj: object, prop: string | symbol) => {
		registerDecorator({
			name: "NoSqlInjection",
			target: obj.constructor,
			propertyName: prop as string,
			options: validationOptions,
			constraints: [allowDollar ?? false],
			validator: {
				validate(value: unknown, args: ValidationArguments) {
					if (value == null) return true; // usar @IsDefined() si es requerido
					if (typeof value !== "string") return false;
					const v = value.normalize("NFKC");
					if (hasControlChars(v)) return false;

					// Bloquea patrones y metacaracteres comunes de inyección
					if (SUSPICIOUS_RE.test(v)) {
						const [allow] = args.constraints as [boolean];
						if (!allow) {
							if (v.includes("$")) return false;
						}
						// incluso si $ está permitido, otros patrones siguen bloqueando
						const alt =
							/(\b(or|and|where|ne|gt|lt|gte|lte|in|nin|regex)\b|\{|\}|\[|\]|;|--|#)/i;
						if (alt.test(v)) return false;
					}
					return true;
				},
				defaultMessage(args: ValidationArguments) {
					return `${args.property} contiene patrones potenciales de inyección NoSQL.`;
				},
			},
		});
	};
}
