import {
	registerDecorator,
	type ValidationArguments,
	type ValidationOptions,
} from "class-validator";

export function IsIsoDateString(opts?: ValidationOptions) {
	return (obj: object, propertyName: string) => {
		registerDecorator({
			name: "IsIsoDateString",
			target: obj.constructor,
			propertyName,
			options: opts,
			validator: {
				validate(value: unknown) {
					if (typeof value !== "string") return false;
					const d = new Date(value);
					return (
						!Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}T/.test(value)
					);
				},
				defaultMessage(args: ValidationArguments) {
					return `${args.property} must be an ISO date-time string`;
				},
			},
		});
	};
}
