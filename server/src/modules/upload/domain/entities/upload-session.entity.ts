import { SessionEmptyError } from "../errors/session-empty.error";
import { SessionHasPendingItemsError } from "../errors/session-has-pending-items.error";
import { SessionNotOpenError } from "../errors/session-not-open.error";
import { UUID, UploadDomain, UploadSessionStatus } from "../types";
import { ClientIdentifier } from "../value-objects/client-identifier.vo";
import { UploadItem } from "./upload-item.entity";

export interface UploadSessionProps {
	id: UUID;
	clientBatchId: ClientIdentifier;
	domain: UploadDomain;
	status: UploadSessionStatus;
	createdAt: Date;
	updatedAt: Date;
	items: UploadItem[];
}

export class UploadSession {
	private readonly _id: UUID;
	private _status: UploadSessionStatus;
	private _updatedAt: Date;
	private readonly _items: UploadItem[];

	private readonly _clientBatchId: ClientIdentifier;
	private readonly _createdAt: Date;
	private readonly _domain: UploadDomain;

	private constructor(props: UploadSessionProps) {
		this._id = props.id;
		this._domain = props.domain;
		this._clientBatchId = props.clientBatchId;
		this._status = props.status;
		this._createdAt = props.createdAt;
		this._updatedAt = props.updatedAt;
		this._items = [...props.items]; // copia defensiva

		// ===== Invariantes mínimas =====
		if (this._createdAt > this._updatedAt) {
			throw new Error(
				"UploadSession invariant violated: createdAt > updatedAt",
			);
		}

		// Si está terminal, valida coherencia con los ítems
		if (this._status === "COMPLETED") {
			if (this._items.length === 0) {
				throw new Error("Completed session must have at least one item.");
			}
			if (!this._items.every((i) => i.status === "VERIFIED")) {
				throw new Error("Completed session must have all items VERIFIED.");
			}
		}
	}

	public static create(
		props: Omit<UploadSessionProps, "status" | "updatedAt" | "items">,
	): UploadSession {
		const now = new Date();
		return new UploadSession({
			...props,
			status: "OPEN",
			updatedAt: now,
			createdAt: now,
			items: [],
		});
	}

	public static fromPersistence(props: UploadSessionProps): UploadSession {
		return new UploadSession(props);
	}

	// ================= Business =================

	public guardCanGenerateSas(): void {
		if (this._status !== "OPEN") {
			throw new SessionNotOpenError(this._id);
		}
	}

	public addItem(item: UploadItem): void {
		this.guardCanBeModified();

		// Evita duplicado por clientItemId (refleja UNIQUE(session_id, client_item_id))
		if (this.hasItemWithClientItemId(item.clientItemId)) {
			throw new Error("Duplicate item clientItemId in session.");
		}
		// (Opcional) Evita duplicado por ubicación (refleja uq_item_by_blob)
		if (this.hasItemWithLocation(item.location)) {
			throw new Error("Duplicate storage location in session.");
		}

		this._items.push(item);
		this.touch();
	}

	public complete(): void {
		// idempotencia + reglas de transición
		if (this._status === "COMPLETED") {
			return;
		}
		if (this._status !== "OPEN") {
			throw new SessionNotOpenError(this._id);
		}
		if (this._items.length === 0) {
			throw new SessionEmptyError(this._id);
		}
		if (!this._items.every((item) => item.status === "VERIFIED")) {
			throw new SessionHasPendingItemsError(this._id);
		}
		this._status = "COMPLETED";
		this.touch();
	}

	public fail(): void {
		if (this._status !== "OPEN") {
			// coherente: no puedes fallar una sesión ya terminal
			throw new SessionNotOpenError(this._id);
		}
		this._status = "FAILED";
		this.touch();
	}

	// ================= Queries =================

	public findItemByBlobName(blobName: string): UploadItem | undefined {
		return this._items.find((item) => item.location.blobName === blobName);
	}

	public findItemByClientItemId(id: ClientIdentifier): UploadItem | undefined {
		return this._items.find((item) => item.clientItemId.equals(id));
	}

	public hasItemWithClientItemId(id: ClientIdentifier): boolean {
		return this.findItemByClientItemId(id) !== undefined;
	}

	public hasItemWithLocation(loc: UploadItem["location"]): boolean {
		return this._items.some((i) => i.location.equals(loc));
	}

	public isTerminal(): boolean {
		return this._status === "COMPLETED" || this._status === "FAILED";
	}

	// ================= Getters =================

	get id(): UUID {
		return this._id;
	}
	get status(): UploadSessionStatus {
		return this._status;
	}
	get updatedAt(): Date {
		return this._updatedAt;
	}
	get items(): readonly UploadItem[] {
		return this._items;
	}
	get createdAt(): Date {
		return this._createdAt;
	}
	get clientBatchId(): ClientIdentifier {
		return this._clientBatchId;
	}
	get domain(): UploadDomain {
		return this._domain;
	}

	// ================= Private =================

	private guardCanBeModified(): void {
		if (this._status !== "OPEN") {
			throw new SessionNotOpenError(this._id);
		}
	}

	private touch(): void {
		this._updatedAt = new Date();
	}
}
