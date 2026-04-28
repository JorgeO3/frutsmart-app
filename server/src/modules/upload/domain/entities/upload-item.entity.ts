import { ItemInvalidStatusTransitionError } from "../errors/item-invalid-status-transition.error";
import { ItemMD5MismatchError } from "../errors/item-md5-mismatch.error";
import { UUID, UploadItemStatus } from "../types";
import { ClientIdentifier } from "../value-objects/client-identifier.vo";
import { FileProperties } from "../value-objects/file-properties.vo";
import { StorageLocation } from "../value-objects/storage-location.vo";

export interface UploadItemProps {
	id: UUID;
	clientItemId: ClientIdentifier;
	status: UploadItemStatus;
	location: StorageLocation;
	properties: FileProperties; // garantiza md5Hash no-nulo y válido
	createdAt: Date;
	updatedAt: Date;
}

export class UploadItem {
	private readonly _id: UUID;
	private _status: UploadItemStatus;
	private _updatedAt: Date;

	private readonly _clientItemId: ClientIdentifier;
	private readonly _location: StorageLocation;
	private readonly _properties: FileProperties;
	private readonly _createdAt: Date;

	private constructor(props: UploadItemProps) {
		this._id = props.id;
		this._status = props.status;
		this._clientItemId = props.clientItemId;
		this._location = props.location;
		this._properties = props.properties;
		this._createdAt = props.createdAt;
		this._updatedAt = props.updatedAt;

		// Invariante temporal opcional (comenta si no lo quieres estricto)
		if (this._createdAt > this._updatedAt) {
			throw new Error("UploadItem invariant violated: createdAt > updatedAt");
		}
	}

	public static create(
		props: Omit<UploadItemProps, "status" | "updatedAt">,
	): UploadItem {
		const now = new Date();
		return new UploadItem({
			...props,
			status: "PENDING",
			updatedAt: now,
		});
	}

	public static fromPersistence(props: UploadItemProps): UploadItem {
		return new UploadItem(props);
	}

	// ================= Business =================

	public markAsInProgress(): void {
		if (this._status !== "PENDING") {
			throw new ItemInvalidStatusTransitionError(
				this._id,
				this._status,
				"IN_PROGRESS",
			);
		}
		this._status = "IN_PROGRESS";
		this.touch();
	}

	public markAsUploaded(): void {
		if (this._status !== "PENDING" && this._status !== "IN_PROGRESS") {
			throw new ItemInvalidStatusTransitionError(
				this._id,
				this._status,
				"UPLOADED",
			);
		}
		this._status = "UPLOADED";
		this.touch();
	}

	public verify(md5HashFromServer: string): void {
		if (this._status !== "UPLOADED") {
			throw new ItemInvalidStatusTransitionError(
				this._id,
				this._status,
				"VERIFIED",
			);
		}

		// Validación estricta del hash del servidor (32-hex)
		if (!/^[a-fA-F0-9]{32}$/.test(md5HashFromServer)) {
			throw new ItemMD5MismatchError(this._id); // o crea un error específico si prefieres
		}

		// FileProperties garantiza md5Hash no-nulo; compara siempre
		if (this._properties.md5Hash !== md5HashFromServer) {
			throw new ItemMD5MismatchError(this._id);
		}

		this._status = "VERIFIED";
		this.touch();
	}

	public markAsFailed(): void {
		if (this._status === "VERIFIED" || this._status === "FAILED") {
			throw new ItemInvalidStatusTransitionError(
				this._id,
				this._status,
				"FAILED",
			);
		}
		this._status = "FAILED";
		this.touch();
	}

	// ======= Opcionales si usas otros estados del enum =======
	// public markAsIncomplete(): void { ... }
	// public abort(): void { ... }

	// ================= Queries =================

	public isTerminal(): boolean {
		return this._status === "VERIFIED" || this._status === "FAILED";
	}

	public canBeUploaded(): boolean {
		return this._status === "PENDING" || this._status === "IN_PROGRESS";
	}

	// ================= Getters =================

	get id(): UUID {
		return this._id;
	}
	get status(): UploadItemStatus {
		return this._status;
	}
	get updatedAt(): Date {
		return this._updatedAt;
	}
	get createdAt(): Date {
		return this._createdAt;
	}
	get clientItemId(): ClientIdentifier {
		return this._clientItemId;
	}
	get location(): StorageLocation {
		return this._location;
	}
	get properties(): FileProperties {
		return this._properties;
	}

	// ================= Private =================

	private touch(): void {
		this._updatedAt = new Date();
	}
}
