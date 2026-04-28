import { ArgumentInvalidError } from "../errors/argument-invalid.error";

/**
 * Geolocation Value Object
 *
 * Requiere SIEMPRE lat y lng (ambos definidos), valida rangos:
 *  - latitude ∈ [-90, 90]
 *  - longitude ∈ [-180, 180]
 * Coincide con columnas NOT NULL y CHECK del esquema.
 */
export class Geolocation {
	private constructor(
		public readonly latitude: number,
		public readonly longitude: number,
	) {}

	static create(latitude: number, longitude: number): Geolocation {
		// Ambos deben venir definidos (BD: NOT NULL)
		if (latitude === undefined || longitude === undefined) {
			throw new ArgumentInvalidError(
				"Geolocation requires latitude AND longitude",
			);
		}

		if (!Number.isFinite(latitude)) {
			throw new ArgumentInvalidError("Latitude must be a finite number");
		}
		if (!Number.isFinite(longitude)) {
			throw new ArgumentInvalidError("Longitude must be a finite number");
		}

		if (latitude < -90 || latitude > 90) {
			throw new ArgumentInvalidError(
				`Latitude must be between -90 and 90, received: ${latitude}`,
			);
		}
		if (longitude < -180 || longitude > 180) {
			throw new ArgumentInvalidError(
				`Longitude must be between -180 and 180, received: ${longitude}`,
			);
		}

		return new Geolocation(latitude, longitude);
	}

	hasCoordinates(): boolean {
		// En esta versión siempre será true, pero mantiene compatibilidad con llamadas existentes.
		return true;
	}
}
