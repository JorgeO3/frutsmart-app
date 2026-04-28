import {
	BadRequestException,
	Injectable,
	type PipeTransform,
} from "@nestjs/common";

@Injectable()
export class ToBooleanPipe implements PipeTransform {
	transform(value: unknown) {
		if (typeof value === "boolean") return value;
		if (typeof value === "string") {
			const v = value.trim().toLowerCase();
			if (["true", "1", "yes", "y", "on"].includes(v)) return true;
			if (["false", "0", "no", "n", "off"].includes(v)) return false;
			throw new BadRequestException(`Invalid boolean: ${value}`);
		}
		if (value == null) return value;
		throw new BadRequestException("Invalid boolean");
	}
}
