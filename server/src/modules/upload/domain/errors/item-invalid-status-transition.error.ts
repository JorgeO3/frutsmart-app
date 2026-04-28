import { UploadItemStatus, UUID } from "../types";

/**
 * Error lanzado cuando se intenta cambiar el estado de un UploadItem
 * a un estado que no es válido según el estado actual.
 */
export class ItemInvalidStatusTransitionError extends Error {
	constructor(
		itemId: UUID,
		fromStatus: UploadItemStatus,
		toStatus: UploadItemStatus,
	) {
		super(
			`Invalid status transition for item '${itemId}': cannot move from '${fromStatus}' to '${toStatus}'.`,
		);
		this.name = this.constructor.name;
	}
}
