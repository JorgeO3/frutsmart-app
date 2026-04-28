import { HarvestCriteria } from "./harvest-criteria.vo";
import { ArgumentInvalidError } from "../errors/argument-invalid.error";

// biome-ignore format: readability
describe("HarvestCriteria VO", () => {
  it("acepta null/undefined como {}", () => {
    expect(HarvestCriteria.from(null).isEmpty()).toBe(true);
    expect(HarvestCriteria.from(undefined).isEmpty()).toBe(true);
  });

  it("acepta plain objects JSON-serializables", () => {
    const vo = HarvestCriteria.from({ minSize: 10, flags: { ripe: true }, arr: [1, 2, 3] });
    expect(vo.isEmpty()).toBe(false);
    expect(vo.toJSON()).toEqual({ minSize: 10, flags: { ripe: true }, arr: [1, 2, 3] });
  });

  it("rechaza arrays en la raíz", () => {
    expect(() => HarvestCriteria.from([1, 2, 3])).toThrow(ArgumentInvalidError);
  });

  it("rechaza objetos no-plain (Date/Map/Set)", () => {
    expect(() => HarvestCriteria.from(new Date())).toThrow(ArgumentInvalidError);
    expect(() => HarvestCriteria.from(new Map([["a", 1]]))).toThrow(ArgumentInvalidError);
    expect(() => HarvestCriteria.from(new Set([1, 2]))).toThrow(ArgumentInvalidError);
  });

  it("rechaza funciones, símbolos, bigint", () => {
    expect(() => HarvestCriteria.from({ f: () => 1 })).toThrow(ArgumentInvalidError);
    expect(() => HarvestCriteria.from({ s: Symbol("x") })).toThrow(ArgumentInvalidError);
    expect(() => HarvestCriteria.from({ b: 10n })).toThrow(ArgumentInvalidError);
  });

  it("deep freeze: no permite mutaciones", () => {
    const vo = HarvestCriteria.from({ a: { b: 1 } });
    expect(Object.isFrozen(vo.value)).toBe(true);
    expect(Object.isFrozen(vo.value.a)).toBe(true);

    // biome-ignore lint/suspicious/noExplicitAny: test mutación
    expect(() => { (vo.value.a as any).b = 2; }).toThrow();
  });
});
