import { Injectable, type PipeTransform } from "@nestjs/common";

@Injectable()
export class TrimPipe implements PipeTransform {
	transform(value: unknown) {
		if (typeof value === "string") return value.trim();
		if (Array.isArray(value))
			return value.map((v) => (typeof v === "string" ? v.trim() : v));
		if (value && typeof value === "object") {
			const out: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(value)) {
				out[k] = typeof v === "string" ? v.trim() : v;
			}
			return out;
		}
		return value;
	}
}
