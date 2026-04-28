import {
	BadRequestException,
	Injectable,
	type PipeTransform,
} from "@nestjs/common";
import { validate as isUuid } from "uuid";

/**
 * Convierte: ?ids=uuid1,uuid2  o  ?ids[]=uuid1&ids[]=uuid2  → string[]
 */
@Injectable()
export class ParseUuidArrayPipe implements PipeTransform {
	constructor(private readonly paramName = "ids") {}

	transform(value: unknown): string[] {
		if (Array.isArray(value)) {
			this.ensureUuids(value);
			return value;
		}
		if (typeof value === "string") {
			const arr = value
				.split(",")
				.map((v) => v.trim())
				.filter(Boolean);
			this.ensureUuids(arr);
			return arr;
		}
		if (value == null) return [];
		throw new BadRequestException(
			`Expected "${this.paramName}" to be string or string[]`,
		);
	}

	private ensureUuids(arr: string[]) {
		if (!arr.every((v) => isUuid(v))) {
			throw new BadRequestException("Invalid UUID array");
		}
	}
}
