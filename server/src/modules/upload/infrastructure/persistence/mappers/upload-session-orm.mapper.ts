import { Injectable } from "@nestjs/common";
import { UploadSession } from "../../../domain/entities/upload-session.entity";
import { UploadItem } from "../../../domain/entities/upload-item.entity";
import { UploadSessionEntity } from "../entities/upload-session.orm-entity";
import { UploadItemEntity } from "../entities/upload-item.orm-entity";
import { ClientIdentifier } from "../../../domain/value-objects/client-identifier.vo";
import { StorageLocation } from "../../../domain/value-objects/storage-location.vo";
import { FileProperties } from "../../../domain/value-objects/file-properties.vo";
import { IUploadSessionOrmMapper } from "./upload-session-orm.mapper.port";

/**
 * Mapper responsible for converting between Domain entities and ORM entities
 * for UploadSession aggregate.
 *
 * @remarks
 * This mapper encapsulates all conversion logic, keeping domain entities
 * free from persistence concerns and ORM entities free from business logic.
 */
@Injectable()
export class UploadSessionOrmMapper implements IUploadSessionOrmMapper {
	/**
	 * Converts a domain UploadSession entity to an ORM entity for persistence.
	 *
	 * @param domain - The domain entity
	 * @returns The ORM entity ready for persistence
	 */
	toPersistence(domain: UploadSession): UploadSessionEntity {
		const orm = new UploadSessionEntity();

		orm.id = domain.id;
		orm.domain = domain.domain;
		orm.clientBatchId = domain.clientBatchId.value;
		orm.status = domain.status;
		orm.createdAt = domain.createdAt;
		orm.updatedAt = domain.updatedAt;

		// Map items
		orm.items = domain.items.map((item) =>
			this.itemToPersistence(item, domain.id),
		);

		return orm;
	}

	/**
	 * Converts an ORM UploadSession entity to a domain entity.
	 *
	 * @param orm - The ORM entity from database
	 * @returns The reconstituted domain entity
	 */
	toDomain(orm: UploadSessionEntity): UploadSession {
		const items = (orm.items || []).map((item) => this.itemToDomain(item));

		return UploadSession.fromPersistence({
			id: orm.id,
			clientBatchId: ClientIdentifier.create(orm.clientBatchId),
			domain: orm.domain,
			status: orm.status,
			createdAt: orm.createdAt,
			updatedAt: orm.updatedAt,
			items,
		});
	}

	/**
	 * Converts a domain UploadItem to ORM entity.
	 */
	private itemToPersistence(
		item: UploadItem,
		sessionId: string,
	): UploadItemEntity {
		const orm = new UploadItemEntity();

		orm.id = item.id;
		orm.sessionId = sessionId;
		orm.clientItemId = item.clientItemId.value;
		orm.storageProvider = item.location.provider;
		orm.blobContainer = item.location.container;
		orm.blobName = item.location.blobName;
		orm.status = item.status;
		orm.contentType = item.properties.mimeType;
		orm.sizeBytes = item.properties.sizeInBytes;
		orm.md5 = item.properties.md5Hash ?? undefined;
		orm.createdAt = item.createdAt;
		orm.updatedAt = item.updatedAt;

		return orm;
	}

	/**
	 * Converts an ORM UploadItem to domain entity.
	 */
	private itemToDomain(orm: UploadItemEntity): UploadItem {
		return UploadItem.fromPersistence({
			id: orm.id,
			clientItemId: ClientIdentifier.create(orm.clientItemId),
			location: StorageLocation.create({
				provider: orm.storageProvider,
				container: orm.blobContainer,
				blobName: orm.blobName,
			}),
			properties: FileProperties.create({
				mimeType: orm.contentType,
				sizeInBytes: orm.sizeBytes ?? 0,
				md5Hash: orm.md5,
			}),
			status: orm.status,
			createdAt: orm.createdAt,
			updatedAt: orm.updatedAt,
		});
	}
}
