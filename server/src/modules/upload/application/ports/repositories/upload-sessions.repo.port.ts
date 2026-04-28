import { UploadSession } from "../../../domain/entities/upload-session.entity";
import { ClientIdentifier } from "../../../domain/value-objects/client-identifier.vo";
import { UUID } from "../../../domain/types";

/**
 * Port interface defining the repository contract for UploadSession aggregates.
 *
 * @remarks
 * This abstraction allows the application layer to persist and retrieve
 * UploadSession aggregates without knowledge of the underlying database implementation.
 * It follows the Repository pattern from Domain-Driven Design.
 */
export const UPLOAD_SESSIONS_REPOSITORY = "UploadSessionsRepository";

export interface IUploadSessionsRepository {
	/**
	 * Persists an UploadSession entity (create or update).
	 *
	 * @param session - The domain entity to persist
	 * @returns Promise that resolves when the operation completes
	 *
	 * @remarks
	 * This method handles both creation and updates. The repository implementation
	 * should determine whether to INSERT or UPDATE based on entity state.
	 */
	save(session: UploadSession): Promise<void>;

	/**
	 * Finds an UploadSession by its unique identifier.
	 *
	 * @param id - The UUID of the session
	 * @returns Promise resolving to the domain entity or null if not found
	 */
	findById(id: UUID): Promise<UploadSession | null>;

	/**
	 * Finds an open session by its client-provided batch identifier.
	 *
	 * @param clientBatchId - The batch identifier provided by the client
	 * @returns Promise resolving to the domain entity or null if not found
	 *
	 * @remarks
	 * Only returns sessions with OPEN status. This prevents reusing
	 * completed or failed sessions.
	 */
	findOpenByClientBatchId(
		clientBatchId: ClientIdentifier,
	): Promise<UploadSession | null>;

	/** Detects if the given error is a unique constraint violation. */
	isUniqueViolation(err: unknown): boolean;
}
