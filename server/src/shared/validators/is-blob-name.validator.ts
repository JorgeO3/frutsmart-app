import {
	registerDecorator,
	type ValidationArguments,
	type ValidationOptions,
} from "class-validator";

/**
 * Valida nombre de blob de Azure (simplificado):
 * - 1 a 1024 chars
 * - sin caracteres de control
 * - no termina en '.' ni '/' ni '\'
 */
export function IsBlobName(opts?: ValidationOptions) {
	return (obj: object, propertyName: string) => {
		registerDecorator({
			name: "IsBlobName",
			target: obj.constructor,
			propertyName,
			options: opts,
			validator: {
				validate(value: unknown) {
					if (typeof value !== "string") return false;
					if (value.length < 1 || value.length > 1024) return false;
					// biome-ignore lint/suspicious/noControlCharactersInRegex: this is intentional
					if (/[\u0000-\u001F]/.test(value)) return false;
					if (/[./\\]$/.test(value)) return false;
					return true;
				},
				defaultMessage(args: ValidationArguments) {
					return `${args.property} is not a valid Azure blob name`;
				},
			},
		});
	};
}
