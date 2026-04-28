import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import { UploadItem } from "../../domain/entities/upload-item.entity";
import { UploadSession } from "../../domain/entities/upload-session.entity";
import { ClientIdentifier } from "../../domain/value-objects/client-identifier.vo";
import { FileProperties } from "../../domain/value-objects/file-properties.vo";
import { StorageLocation } from "../../domain/value-objects/storage-location.vo";
import { CreateUploadSessionInput } from "../dto/create-upload-session/create-upload-session.input";
import { CreateUploadSessionOutput } from "../dto/create-upload-session/create-upload-session.output";
import {
	type IUuidGenerator,
	UUID_GENERATOR,
} from "../ports/uuid-generator.port";
import { BLOB_STORAGE, type IBlobStorage } from "../ports/blob-storage.port";

export const CREATE_UPLOAD_SESSION_MAPPER = Symbol(
	"CREATE_UPLOAD_SESSION_MAPPER",
);

export interface ICreateUploadSessionMapper {
	toDomain(input: CreateUploadSessionInput): UploadSession;
	toOutput(session: UploadSession): CreateUploadSessionOutput;
}

/**
 * Mapper responsable de las conversiones entre DTOs y Entidades de Dominio
 * para el caso de uso CreateUploadSession.
 */
@Injectable()
export class CreateUploadSessionMapper implements ICreateUploadSessionMapper {
	constructor(
		// Inyectamos la dependencia que necesitamos para crear las entidades
		@Inject(UUID_GENERATOR) private readonly uuidGenerator: IUuidGenerator,
		@Inject(BLOB_STORAGE) private readonly blobStorage: IBlobStorage,
	) {}

	/**
	 * Convierte el DTO de entrada del caso de uso en un agregado de dominio UploadSession.
	 * Encapsula la lógica de creación de las entidades.
	 * @param input El DTO de entrada del caso de uso.
	 * @returns Una nueva instancia de la entidad de dominio UploadSession con sus ítems.
	 */
	public toDomain(input: CreateUploadSessionInput): UploadSession {
		// Validate input
		this.validateInput(input);

		const newSession = UploadSession.create({
			id: this.uuidGenerator.generate(),
			clientBatchId: ClientIdentifier.create(input.clientBatchId),
			createdAt: new Date(),
			domain: input.domain,
		});

		const newItems = input.files.map((file) => {
			const { clientItemId, fileName, contentType, fileSizeBytes, md5 } = file;
			const blobName = this.blobStorage.generateBlobName(
				input.domain,
				clientItemId,
				fileName,
			);

			return UploadItem.create({
				id: this.uuidGenerator.generate(),
				clientItemId: ClientIdentifier.create(clientItemId),
				location: StorageLocation.create({
					provider: "azure", // Esto debería venir de la configuración
					container: input.domain,
					blobName: blobName,
				}),
				properties: FileProperties.create({
					mimeType: contentType,
					sizeInBytes: fileSizeBytes,
					md5Hash: md5,
				}),
				createdAt: new Date(), // createdAt is set within UploadItem.create now
			});
		});

		newItems.forEach((item) => {
			newSession.addItem(item);
		});
		return newSession;
	}

	/**
	 * Convierte una entidad de dominio UploadSession al DTO de salida.
	 * @param session La entidad de dominio UploadSession.
	 * @returns El DTO de salida CreateUploadSessionOutput.
	 */
	public toOutput(session: UploadSession): CreateUploadSessionOutput {
		return {
			sessionId: session.id,
			clientBatchId: session.clientBatchId.value,
			status: session.status,
			createdAt: session.createdAt,
			domain: session.domain,
			items: session.items.map((item) => ({
				itemId: item.id,
				clientItemId: item.clientItemId.value,
				status: item.status,
				blobContainer: item.location.container,
				blobName: item.location.blobName,
				createdAt: item.createdAt,
			})),
		};
	}

	/**
	 * Validates the input before creating domain entities.
	 * @param input The input to validate
	 * @throws BadRequestException if validation fails
	 */
	private validateInput(input: CreateUploadSessionInput): void {
		// VAL-001: files array cannot be empty
		if (!input.files || input.files.length === 0) {
			throw new BadRequestException("Files array cannot be empty");
		}

		input.files.forEach((file, index) => {
			// VAL-002: fileSizeBytes must be > 0
			if (file.fileSizeBytes <= 0) {
				throw new BadRequestException(
					`File at index ${index} has invalid size: ${file.fileSizeBytes}`,
				);
			}

			// VAL-003: reject unsafe filenames (path traversal)
			if (
				file.fileName.includes("../") ||
				file.fileName.includes("..\\") ||
				file.fileName.startsWith("/") ||
				file.fileName.startsWith("\\")
			) {
				throw new BadRequestException(
					`File at index ${index} has unsafe filename: ${file.fileName}`,
				);
			}

			// VAL-005: validate MD5 hash length if provided
			if (file.md5 && file.md5.length !== 32) {
				throw new BadRequestException(
					`File at index ${index} has invalid MD5 hash length: ${file.md5.length} (expected 32)`,
				);
			}
		});
	}
}
