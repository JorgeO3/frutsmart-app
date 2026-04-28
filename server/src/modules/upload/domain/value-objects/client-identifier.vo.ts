import { ArgumentInvalidError } from "../errors/argument-invalid.error";

/**
 * Properties required to create a ClientIdentifier.
 */
export interface ClientIdentifierProps {
	value: string;
}

/**
 * Value Object representing a client-provided identifier.
 *
 * This class ensures that any client identifier used within the domain
 * is valid (i.e., not null or empty) and immutable. It encapsulates
 * the primitive string into a rich domain object.
 */
export class ClientIdentifier {
	private readonly _value: string;

	private constructor(props: ClientIdentifierProps) {
		this.validate(props);
		this._value = props.value;
	}

	/**
	 * Factory method to create a new ClientIdentifier instance.
	 * @param value The string value of the identifier.
	 * @returns A new instance of ClientIdentifier.
	 * @throws {ArgumentInvalidError} if the value is null, undefined, or an empty string.
	 */
	public static create(value: string): ClientIdentifier {
		return new ClientIdentifier({ value });
	}

	/**
	 * Validates the properties of the ClientIdentifier.
	 * @param props The properties to validate.
	 */
	private validate(props: ClientIdentifierProps): void {
		if (!props.value || props.value.trim().length === 0) {
			throw new ArgumentInvalidError("ClientIdentifier value cannot be empty.");
		}
	}

	/**
	 * Public getter to access the primitive value of the identifier.
	 */
	get value(): string {
		return this._value;
	}

	/**
	 * Compares this ClientIdentifier with another for equality.
	 * @param other The other ClientIdentifier to compare with.
	 * @returns `true` if the values are equal, `false` otherwise.
	 */
	public equals(other?: ClientIdentifier): boolean {
		if (other === null || other === undefined) {
			return false;
		}
		return this._value === other.value;
	}
}
