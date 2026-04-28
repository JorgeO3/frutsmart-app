/**
 * Core domain types for the evaluation module.
 * These types reflect the database enums and provide type safety across layers.
 */

export type UUID = string;

export type EvaluationType = "PLANT_ANALYSIS" | "FIELD_EVENT";

export type ProviderKind = "own" | "third-party";

export type ClassificationKind = "external" | "internal";

export type PhotoRole = "raw" | "segmented" | "cropped";

export type ModelKind =
	| "detection"
	| "external_classification"
	| "internal_classification";

export type TimeOfDay = "day" | "night";
