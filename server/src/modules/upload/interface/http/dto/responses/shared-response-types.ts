import { ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Detalles de problemas/errores siguiendo RFC 7807
 */
export class ProblemDetails {
	@ApiPropertyOptional({ description: "Tipo de problema (URI o código)" })
	type?: string;

	@ApiPropertyOptional({ description: "Título breve del problema" })
	title?: string;

	@ApiPropertyOptional({ description: "Código de status HTTP" })
	status?: number;

	@ApiPropertyOptional({ description: "Descripción detallada del problema" })
	detail?: string;

	@ApiPropertyOptional({ description: "URI de la instancia específica" })
	instance?: string;
}

/**
 * Información de error específica para items de upload
 */
export class UploadItemError {
	@ApiPropertyOptional({ description: "Código de error específico" })
	code?: string;

	@ApiPropertyOptional({ description: "Mensaje de error" })
	message?: string;

	@ApiPropertyOptional({ description: "Detalles adicionales en formato JSON" })
	details_json?: Record<string, unknown>;
}
