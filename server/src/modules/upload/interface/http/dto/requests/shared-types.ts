import { ApiProperty } from "@nestjs/swagger";
import {
	IsBoolean,
	IsDefined,
	IsEnum,
	IsInt,
	IsOptional,
	IsPositive,
	IsString,
	Length,
	Matches,
	Max,
	MaxLength,
	Min,
} from "class-validator";
import { Trim } from "@shared/decorators/trim.decorator";
import { IsSecureUUID, UUID_V4 } from "@shared/validators";

export enum UploadDomain {
	PLANT = "plant",
	FIELD = "field",
}

export class ClientItemIdDto {
	@ApiProperty({
		description: "Client-side item identifier",
		example: "file-001",
		maxLength: 255,
		pattern: UUID_V4,
	})
	@Trim()
	@IsDefined({ message: "clientBatchId is required" })
	@IsSecureUUID()
	clientItemId!: string;
}

export enum FlowKind {
	EXTERNAL = "external",
	INTERNAL = "internal",
}

export enum PhotoType {
	RAW = "raw",
	CROPPED = "cropped",
	SEGMENTED = "segmented",
}

// En algunos proyectos usamos “root” = 'planta' | 'campo' para el path visible
export enum RootKind {
	PLANTA = "planta",
	CAMPO = "campo",
}

// throughputs heurísticos reportados por el cliente (opcional)
export enum ThroughputClass {
	LOW = "low",
	MID = "mid",
	HIGH = "high",
}

// Descriptor de archivo que el cliente declara al crear la sesión
export class UploadFileDescriptorDto {
	// Identificador local del archivo (per-file) en el cliente
	@IsString()
	@MaxLength(128)
	client_item_id!: string;

	// Nombre sugerido (extensión ayuda a elegir contentType si faltara)
	@IsString()
	@MaxLength(255)
	file_name!: string;

	// MIME (se recomienda enviarlo)
	@IsString()
	@MaxLength(128)
	content_type!: string;

	@IsInt()
	@IsPositive()
	@Max(2_147_483_647_000) // ~2TB, suficiente para validación
	file_size_bytes!: number;

	// MD5 en hex (32 chars). Valida longitud y charset
	@IsString()
	@Length(32, 32)
	@Matches(/^[a-f0-9]{32}$/)
	md5!: string;

	@IsEnum(FlowKind)
	flow!: FlowKind;

	@IsEnum(PhotoType)
	photo_type!: PhotoType;

	// “root” para el path visible: 'planta' | 'campo'
	@IsEnum(RootKind)
	root!: RootKind;
}

// Opcional: “pista” de red para que el backend ajuste TTL o batch size
export class NetworkHintsDto {
	@IsEnum(ThroughputClass)
	@IsOptional()
	throughput_class?: ThroughputClass;

	@IsBoolean()
	@IsOptional()
	slow_network?: boolean;

	@IsInt()
	@Min(1)
	@Max(120)
	@IsOptional()
	suggested_ttl_minutes?: number;
}
