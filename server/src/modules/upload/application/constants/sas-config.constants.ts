/**
 * Configuration constants for SAS token generation.
 */
export const SAS_CONFIG = {
	/**
	 * Default time-to-live for SAS tokens in minutes.
	 */
	DEFAULT_TTL_MINUTES: 60,

	/**
	 * Minimum TTL for SAS tokens in minutes.
	 */
	MIN_TTL_MINUTES: 1,

	/**
	 * Maximum TTL for SAS tokens in minutes.
	 */
	MAX_TTL_MINUTES: 240,

	/**
	 * Maximum number of items allowed per batch request.
	 */
	MAX_ITEMS_PER_REQUEST: 500,
} as const;
