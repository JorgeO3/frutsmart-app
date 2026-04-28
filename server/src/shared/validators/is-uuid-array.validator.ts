import {
	registerDecorator,
	type ValidationArguments,
	type ValidationOptions,
} from "class-validator";
import { validate as isUuid } from "uuid";

export function IsUuidArray(opts?: ValidationOptions) {
	return (obj: object, propertyName: string) => {
		registerDecorator({
			name: "IsUuidArray",
			target: obj.constructor,
			propertyName,
			options: opts,
			validator: {
				validate(value: unknown) {
					return (
						Array.isArray(value) &&
						value.every((v) => typeof v === "string" && isUuid(v))
					);
				},
				defaultMessage(args: ValidationArguments) {
					return `${args.property} must be an array of UUID v4`;
				},
			},
		});
	};
}
