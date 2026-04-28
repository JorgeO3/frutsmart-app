import {
	BadRequestException,
	Injectable,
	type PipeTransform,
} from "@nestjs/common";

export type PaginationInput = {
	page?: number;
	limit?: number;
	cursor?: string;
	sort?: string; // "createdAt:desc,name:asc"
};

export type NormalizedPagination = {
	page: number;
	limit: number;
	cursor?: string;
	sort: Array<{ field: string; dir: "asc" | "desc" }>;
};

@Injectable()
export class PaginationPipe implements PipeTransform {
	constructor(
		private readonly defaults = { page: 1, limit: 25, limitMax: 100 },
	) {}

	transform(value: PaginationInput): NormalizedPagination {
		const page = this.toInt(value?.page, this.defaults.page, 1);
		const limit = this.toInt(
			value?.limit,
			this.defaults.limit,
			1,
			this.defaults.limitMax,
		);
		const cursor = (value?.cursor && String(value.cursor).trim()) || undefined;
		const sort = this.parseSort(value?.sort);

		return { page, limit, cursor, sort };
	}

	private toInt(v: unknown, dflt: number, min?: number, max?: number): number {
		const n = v == null ? dflt : Number(v);
		if (!Number.isFinite(n)) throw new BadRequestException("Invalid number");
		if (min != null && n < min) throw new BadRequestException("Out of range");
		if (max != null && n > max) throw new BadRequestException("Out of range");
		return Math.trunc(n);
	}

	private parseSort(
		sort?: string,
	): Array<{ field: string; dir: "asc" | "desc" }> {
		if (!sort) return [];
		return sort
			.split(",")
			.map((token) => {
				const [field, dirRaw] = token
					.split(":")
					.map((s) => s.trim())
					.filter(Boolean);
				if (!field) return null;
				const dir: "asc" | "desc" =
					dirRaw?.toLowerCase() === "desc" ? "desc" : "asc";
				return { field, dir };
			})
			.filter((x): x is { field: string; dir: "asc" | "desc" } => !!x);
	}
}
