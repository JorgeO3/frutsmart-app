/**
 * Domain types for Catalog module
 */

export type UUID = string;

/**
 * Model types from core.model_kind enum
 */
export type ModelType =
	| "detection"
	| "external_classification"
	| "internal_classification";

export const MODEL_TYPES: ModelType[] = [
	"detection",
	"external_classification",
	"internal_classification",
];
