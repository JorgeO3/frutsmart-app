export type ApiEnvelope<T> = { data: T; meta?: Record<string, unknown> };
export const ok = <T>(
	data: T,
	meta?: Record<string, unknown>,
): ApiEnvelope<T> => ({
	data,
	meta,
});
export const created = <T>(
	data: T,
	meta?: Record<string, unknown>,
): ApiEnvelope<T> => ({ data, meta });
