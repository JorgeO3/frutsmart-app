import { ArgumentInvalidError } from "../errors/argument-invalid.error";

export interface FilePropertiesProps {
  mimeType: string;        // requerido (DB: content_type NOT NULL)
  sizeInBytes: number;     // requerido (DB: size_bytes > 0)
  md5Hash: string;         // requerido (DB: md5 NOT NULL)
}

export class FileProperties {
  private readonly _mimeType: string;
  private readonly _sizeInBytes: number;
  private readonly _md5Hash: string;

  private constructor(props: FilePropertiesProps) {
    this.validate(props);
    this._mimeType = props.mimeType;
    this._sizeInBytes = props.sizeInBytes;
    this._md5Hash = props.md5Hash;
  }

  public static create(props: FilePropertiesProps): FileProperties {
    return new FileProperties(props);
  }

  private validate(props: FilePropertiesProps): void {
    if (!props.mimeType || typeof props.mimeType !== "string" || props.mimeType.trim() === "") {
      throw new ArgumentInvalidError("mimeType is required.");
    }
    // MIME súper básica (si quieres, replica tu IsSecureContentType aquí)
    if (!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(props.mimeType)) {
      throw new ArgumentInvalidError("mimeType is not a valid RFC-like media type.");
    }

    if (!Number.isFinite(props.sizeInBytes) || !Number.isInteger(props.sizeInBytes) || props.sizeInBytes <= 0) {
      throw new ArgumentInvalidError("sizeInBytes must be a positive integer (> 0).");
    }

    if (!props.md5Hash || !/^[a-fA-F0-9]{32}$/.test(props.md5Hash)) {
      throw new ArgumentInvalidError("md5Hash must be a 32-char hex string.");
    }
  }

  get mimeType(): string { return this._mimeType; }
  get sizeInBytes(): number { return this._sizeInBytes; }
  get md5Hash(): string { return this._md5Hash; }

  public equals(other?: FileProperties): boolean {
    if (!other) return false;
    return (
      this._sizeInBytes === other.sizeInBytes &&
      this._md5Hash === other.md5Hash &&
      this._mimeType === other.mimeType
    );
  }
}
