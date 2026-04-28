export type PageOptions = { page: number; limit: number };
export type PageMeta = {
	page: number;
	limit: number;
	itemCount: number;
	totalItems: number;
	totalPages: number;
};
export type Paginated<T> = { data: T[]; meta: PageMeta };

export function buildPageMeta(
	opts: PageOptions,
	totalItems: number,
	itemCount: number,
): PageMeta {
	const totalPages = Math.max(
		1,
		Math.ceil(totalItems / Math.max(1, opts.limit)),
	);
	return {
		page: opts.page,
		limit: opts.limit,
		itemCount,
		totalItems,
		totalPages,
	};
}
