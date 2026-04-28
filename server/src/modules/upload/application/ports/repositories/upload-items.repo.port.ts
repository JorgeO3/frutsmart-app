import { UploadItem } from "../../../domain/entities/upload-item.entity";
import { UUID } from "../../../domain/types";

/**
 * Port interface defining the repository contract for UploadItem entities.
 *
 * @remarks
 * This repository manages individual upload items that belong to upload sessions.
 * It provides batch operations for efficiency when dealing with multiple items.
 */
export const UPLOAD_ITEMS_REPOSITORY = "UploadItemsRepository";

export interface IUploadItemsRepository {
	/**
	 * Persists multiple UploadItem entities in a single operation.
	 *
	 * @param items - Array of domain entities to persist
	 * @returns Promise that resolves when the operation completes
	 *
	 * @remarks
	 * This batch operation improves performance when creating or updating
	 * multiple items. The implementation should use bulk operations when possible.
	 */
	saveMany(items: UploadItem[]): Promise<void>;

	/**
	 * Finds an UploadItem by its unique identifier.
	 *
	 * @param id - The UUID of the item
	 * @returns Promise resolving to the domain entity or null if not found
	 */
	findById(id: UUID): Promise<UploadItem | null>;
}
