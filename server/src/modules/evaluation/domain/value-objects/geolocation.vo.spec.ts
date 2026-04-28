import { Geolocation } from "./geolocation.vo";
import { ArgumentInvalidError } from "../errors/argument-invalid.error";

describe("Geolocation VO", () => {
	it("crea un VO válido con lat/lng en rango", () => {
		const g = Geolocation.create(-12.046374, -77.042793);
		expect(g.latitude).toBe(-12.046374);
		expect(g.longitude).toBe(-77.042793);
		expect(g.hasCoordinates()).toBe(true);
	});

	it("falla si falta latitude o longitude", () => {
		// @ts-expect-error - probamos runtime
		expect(() => Geolocation.create(undefined, -77)).toThrow(
			ArgumentInvalidError,
		);
		// @ts-expect-error - probamos runtime
		expect(() => Geolocation.create(10, undefined)).toThrow(
			ArgumentInvalidError,
		);
	});

	it("falla si no son finitos", () => {
		expect(() => Geolocation.create(NaN, 10)).toThrow(ArgumentInvalidError);
		expect(() => Geolocation.create(10, Infinity)).toThrow(
			ArgumentInvalidError,
		);
	});

	it("falla si latitude está fuera de [-90, 90]", () => {
		expect(() => Geolocation.create(-90.0001, 0)).toThrow(ArgumentInvalidError);
		expect(() => Geolocation.create(90.0001, 0)).toThrow(ArgumentInvalidError);
	});

	it("falla si longitude está fuera de [-180, 180]", () => {
		expect(() => Geolocation.create(0, -180.0001)).toThrow(
			ArgumentInvalidError,
		);
		expect(() => Geolocation.create(0, 180.0001)).toThrow(ArgumentInvalidError);
	});

	it("acepta límites exactos", () => {
		expect(() => Geolocation.create(-90, -180)).not.toThrow();
		expect(() => Geolocation.create(90, 180)).not.toThrow();
	});
});
