import { ValueTransformer } from "typeorm";

export const int8AsNumber: ValueTransformer = {
	to: (value?: number | null) => (value == null ? null : value.toString()), // escribe como texto
	from: (value: string | null) => (value == null ? null : Number(value)), // lee como number
};

export const int8AsBigInt: ValueTransformer = {
	to: (value?: bigint | null) => (value == null ? null : value.toString()),
	from: (value: string | null) => (value == null ? null : BigInt(value)),
};
