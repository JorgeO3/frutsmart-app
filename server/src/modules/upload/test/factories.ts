import { UploadSession } from "../domain/entities/upload-session.entity";
import { UploadItem } from "../domain/entities/upload-item.entity";
import { ClientIdentifier } from "../domain/value-objects/client-identifier.vo";
import { StorageLocation } from "../domain/value-objects/storage-location.vo";
import { FileProperties } from "../domain/value-objects/file-properties.vo";
import { UploadItemStatus, UploadSessionStatus } from "../domain/types";

interface MakeUploadSessionProps {
	id?: string;
	clientBatchId?: string;
	domain?: "plant" | "field";
	status?: UploadSessionStatus;
	items?: UploadItem[];
	createdAt?: Date;
	updatedAt?: Date;
}

interface MakeUploadItemProps {
	id?: string;
	clientItemId?: string;
	status?: UploadItemStatus;
	blobName?: string;
	container?: string;
	sizeInBytes?: number;
	mimeType?: string;
	md5Hash?: string | null;
	createdAt?: Date;
	updatedAt?: Date;
}

/**
 * Factory to create UploadSession entities for testing
 */
export function makeUploadSession(
	props: MakeUploadSessionProps = {},
): UploadSession {
	const {
		id = randomUUID(),
		clientBatchId = `batch-${randomId()}`,
		domain = "plant",
		status = "OPEN",
		items = [],
		createdAt = new Date(),
		updatedAt = new Date(),
	} = props;

	if (status === "OPEN" && !props.status) {
		return UploadSession.create({
			id,
			clientBatchId: ClientIdentifier.create(clientBatchId),
			domain,
			createdAt,
		});
	}

	// If COMPLETED status is requested without items, create a default VERIFIED item
	let effectiveItems = items;
	if (status === "COMPLETED" && items.length === 0) {
		const verifiedItem = makeUploadItem({ status: "VERIFIED" });
		effectiveItems = [verifiedItem];
	}

	return UploadSession.fromPersistence({
		id,
		clientBatchId: ClientIdentifier.create(clientBatchId),
		domain,
		status,
		items: effectiveItems,
		createdAt,
		updatedAt,
	});
}

/**
 * Factory to create UploadItem entities for testing
 */
export function makeUploadItem(props: MakeUploadItemProps = {}): UploadItem {
	const {
		id = `item-${randomId()}`,
		clientItemId = `client-item-${randomId()}`,
		status = "PENDING",
		blobName = `plant/2025-01-01/file-${randomId()}.jpg`,
		container = "test-container",
		sizeInBytes = 1024,
		mimeType = "image/jpeg",
		md5Hash = "a".repeat(32),
		createdAt = new Date(),
		updatedAt = new Date(),
	} = props;

	// If md5Hash is explicitly null, use a placeholder valid MD5
	const effectiveMd5Hash =
		md5Hash === null ? "00000000000000000000000000000000" : md5Hash;

	if (status === "PENDING" && !props.status) {
		return UploadItem.create({
			id,
			clientItemId: ClientIdentifier.create(clientItemId),
			location: StorageLocation.create({
				provider: "azure",
				container,
				blobName,
			}),
			properties: FileProperties.create({
				sizeInBytes,
				mimeType,
				md5Hash: effectiveMd5Hash,
			}),
			createdAt,
		});
	}

	return UploadItem.fromPersistence({
		id,
		clientItemId: ClientIdentifier.create(clientItemId),
		location: StorageLocation.create({
			provider: "azure",
			container,
			blobName,
		}),
		properties: FileProperties.create({
			sizeInBytes,
			mimeType,
			md5Hash: effectiveMd5Hash,
		}),
		status,
		createdAt,
		updatedAt,
	});
}

/**
 * Generate a random ID for testing
 */
function randomId(): string {
	return Math.random().toString(36).substring(7);
}

/**
 * Generate a valid UUID v4 for testing session IDs
 */
export function randomUUID(): string {
	// Generate a valid UUID v4
	const hex = "0123456789abcdef";
	let uuid = "";
	for (let i = 0; i < 36; i++) {
		if (i === 8 || i === 13 || i === 18 || i === 23) {
			uuid += "-";
		} else if (i === 14) {
			uuid += "4"; // Version 4
		} else if (i === 19) {
			uuid += hex[Math.floor(Math.random() * 4) + 8]; // 8, 9, a, or b
		} else {
			uuid += hex[Math.floor(Math.random() * 16)];
		}
	}
	return uuid;
}

/**
 * Generate a valid MD5 hash (32 hex chars) for testing
 */
export function makeMd5Hash(seed: string = "a"): string {
	return seed.repeat(32).substring(0, 32);
}

/**
 * Generate a blob name following the pattern {domain}/{timestamp}/{clientItemId}/{fileName}
 */
export function makeBlobName(
	domain: "plant" | "field" = "plant",
	fileName: string = "test.jpg",
	clientItemId: string = randomId(),
): string {
	const timestamp = new Date()
		.toISOString()
		.replace(/[:.]/g, "-")
		.replace("Z", "");
	return `${domain}/${timestamp}/${clientItemId}/${fileName}`;
}
