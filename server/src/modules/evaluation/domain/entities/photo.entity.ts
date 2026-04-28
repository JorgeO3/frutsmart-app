import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import { PhotoRole, UUID } from "../types";

const PHOTO_ROLES = [
	"raw",
	"segmented",
	"cropped",
] as const satisfies readonly PhotoRole[];

export interface PhotoProps {
	id: UUID;
	stepId: UUID;
	role: PhotoRole;
	uploadItemId: UUID; // requerido según esquema
	createdAt: Date;
}

/**
 * Photo Entity (Dominio)
 * Representa una foto asociada a un paso de clasificación.
 * Alineada con core.photos (sin blob_container / blob_name / fileName / contentType).
 */
export class Photo {
	private readonly _id: UUID;
	private readonly _stepId: UUID;
	private readonly _role: PhotoRole;
	private readonly _uploadItemId: UUID;
	private readonly _createdAt: Date;

	private constructor(props: PhotoProps) {
		this._id = props.id;
		this._stepId = props.stepId;
		this._role = props.role;
		this._uploadItemId = props.uploadItemId;
		this._createdAt = props.createdAt;

		// Invariantes mínimas
		if (!this._id) throw new ArgumentInvalidError("Photo.id is required.");
		if (!this._stepId)
			throw new ArgumentInvalidError("Photo.stepId is required.");
		if (!this._uploadItemId)
			throw new ArgumentInvalidError("Photo.uploadItemId is required.");
		if (!PHOTO_ROLES.includes(this._role)) {
			throw new ArgumentInvalidError(
				`Photo.role must be one of: ${PHOTO_ROLES.join(", ")}`,
			);
		}
	}

	/**
	 * Factory con validación. createdAt por defecto = now()
	 */
	static create(params: {
		id: UUID;
		stepId: UUID;
		role: PhotoRole;
		uploadItemId: UUID;
		createdAt?: Date;
	}): Photo {
		const { id, stepId, role, uploadItemId } = params;
		const createdAt = params.createdAt ?? new Date();

		return new Photo({ id, stepId, role, uploadItemId, createdAt });
	}

	// Getters (inmutabilidad hacia afuera)
	get id(): UUID {
		return this._id;
	}
	get stepId(): UUID {
		return this._stepId;
	}
	get role(): PhotoRole {
		return this._role;
	}
	get uploadItemId(): UUID {
		return this._uploadItemId;
	}
	get createdAt(): Date {
		return this._createdAt;
	}
}
