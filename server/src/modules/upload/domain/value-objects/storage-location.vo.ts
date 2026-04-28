import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import { StorageProvider } from "../types";

export interface StorageLocationProps {
	provider: StorageProvider;
	container: string;
	blobName: string;
}

export class StorageLocation {
	private readonly _provider: StorageProvider;
	private readonly _container: string;
	private readonly _blobName: string;

	private constructor(props: StorageLocationProps) {
		this.validate(props);
		this._provider = props.provider;
		this._container = props.container;
		this._blobName = props.blobName;
	}

	public static create(props: StorageLocationProps): StorageLocation {
		return new StorageLocation(props);
	}

	private validate(props: StorageLocationProps): void {
		const container = (props.container ?? "").trim();
		const blobName = (props.blobName ?? "").trim();

		if (container.length === 0) {
			throw new ArgumentInvalidError("Invalid storage container.");
		}
		if (blobName.length === 0) {
			throw new ArgumentInvalidError("Invalid storage blobName.");
		}

		// Reglas de seguridad del path
		const unsafe =
			blobName.startsWith("/") ||
			blobName.endsWith("/") ||
			blobName.includes("//") ||
			blobName.includes("\\") ||
			blobName.includes("/./") ||
			blobName.includes("/../") ||
			blobName.includes(".."); // si quieres ser menos agresivo, quita este último

		if (unsafe) {
			throw new ArgumentInvalidError("blobName path is unsafe.");
		}
	}

	get provider(): StorageProvider {
		return this._provider;
	}
	get container(): string {
		return this._container;
	}
	get blobName(): string {
		return this._blobName;
	}

	public equals(other?: StorageLocation): boolean {
		if (!other) return false;
		return (
			this._provider === other.provider &&
			this._container === other.container &&
			this._blobName === other.blobName
		);
	}
}
