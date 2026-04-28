import { UUID } from "../../../domain/types";

/**
 * Input DTO for the CompleteSessionUseCase.
 *
 * @remarks
 * Represents the command with parameters needed to finalize an upload session.
 * This is a pure data structure without coupling to any framework.
 *
 * The completion process can optionally verify file integrity and selectively
 * process specific items within the session.
 */
export interface CompleteSessionInput {
	/**
	 * The session ID to complete.
	 */
	readonly sessionId: UUID;

	/**
	 * When true, verifies file integrity (size/MD5) before marking items as VERIFIED.
	 *
	 * @defaultValue true
	 *
	 * @remarks
	 * Verification ensures uploaded files match expected size and checksums.
	 * Disable only when integrity is verified through other means.
	 */
	readonly verifyAndPromote: boolean;

	/**
	 * When true, fails the entire session if any item cannot be verified.
	 * When false, marks unverified items as INCOMPLETE without failing the session.
	 *
	 * @defaultValue false
	 *
	 * @remarks
	 * Set to true for critical uploads where partial success is unacceptable.
	 * Set to false to allow partial batch processing.
	 */
	readonly failOnIncomplete: boolean;

	/**
	 * Optional subset of client item IDs to process.
	 *
	 * @remarks
	 * When provided, only items with matching client IDs will be processed.
	 * When omitted, all items in the session will be processed.
	 * Useful for resuming failed uploads or processing items in stages.
	 */
	readonly onlyClientItemIds?: readonly string[];
}
