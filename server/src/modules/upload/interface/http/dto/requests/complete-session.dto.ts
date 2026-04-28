import {
	ArrayMinSize,
	ArrayMaxSize,
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsOptional,
	ValidateNested,
	ValidateIf,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { ClientItemIdDto } from "./shared-types";
import { toBooleanStrictOrInvalid } from "@shared/transformers/to-boolean";

export class CompleteSessionDto {
	/**
	 * If true, the backend re-validates integrity (size/md5)
	 * and promotes to destination only if everything is OK.
	 */
	@ApiPropertyOptional({
		description:
			"If true, re-validate (size/md5) and promote only when everything is OK",
		example: true,
		type: Boolean,
		default: true,
	})
	// si NO viene en el body -> se permite omitir (queda el default = true)
	@IsOptional()
	@Transform(({ value }) => toBooleanStrictOrInvalid(value), {
		toClassOnly: true,
	})
	@ValidateIf((_, v) => v !== undefined)
	@IsBoolean()
	verifyAndPromote?: boolean = true;

	/**
	 * If there are non-UPLOADED items, decides whether to fail the session
	 * or mark those items as INCOMPLETE.
	 */
	@ApiPropertyOptional({
		description:
			"If true, fail the session when there are non-UPLOADED items; otherwise mark them INCOMPLETE",
		example: false,
		type: Boolean,
		default: false,
	})
	@IsOptional()
	@Transform(({ value }) => toBooleanStrictOrInvalid(value), {
		toClassOnly: true,
	})
	@ValidateIf((_, v) => v !== undefined)
	@IsBoolean()
	failOnIncomplete?: boolean = false;

	/**
	 * Optional subset of clientItemId to verify/promote.
	 * If omitted, all items in the session are processed.
	 */
	@ApiPropertyOptional({
		description:
			"Optional subset of clientItemId to verify/promote; if omitted, all items are processed",
		type: [ClientItemIdDto],
		minItems: 1,
		maxItems: 100,
	})
	@IsOptional()
	@IsArray()
	@ArrayMinSize(1, {
		message: "At least 1 item is required if onlyClientItems is provided",
	})
	@ArrayMaxSize(100, {
		message: "Maximum 100 items allowed in onlyClientItems",
	})
	@ValidateNested({ each: true })
	@Type(() => ClientItemIdDto)
	@ArrayUnique((o: ClientItemIdDto) => o.clientItemId, {
		message: "onlyClientItems.clientItemId must be unique",
	})
	onlyClientItems?: ClientItemIdDto[];
}
