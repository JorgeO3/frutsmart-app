import {
	registerDecorator,
	type ValidationArguments,
	type ValidationOptions,
} from "class-validator";

const REQUIRED = ["sv", "se", "sp", "sr", "sig"];

export function IsSasUrl(opts?: ValidationOptions) {
	return (obj: object, propertyName: string) => {
		registerDecorator({
			name: "IsSasUrl",
			target: obj.constructor,
			propertyName,
			options: opts,
			validator: {
				validate(value: unknown) {
					if (typeof value !== "string") return false;
					try {
						const u = new URL(value);
						if (u.protocol !== "https:") return false;
						if (!/\.blob\.core\.windows\.net$/i.test(u.hostname)) return false;
						const hasAll = REQUIRED.every((p) => u.searchParams.has(p));
						return hasAll;
					} catch {
						return false;
					}
				},
				defaultMessage(args: ValidationArguments) {
					return `${args.property} must be a valid Azure SAS URL (sv,se,sp,sr,sig)`;
				},
			},
		});
	};
}
