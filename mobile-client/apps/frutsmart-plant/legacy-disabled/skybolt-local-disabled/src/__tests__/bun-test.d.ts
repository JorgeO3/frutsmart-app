declare module "bun:test" {
  export function describe(name: string, fn: () => void | Promise<void>): void;
  export function it(name: string, fn: () => void | Promise<void>): void;

  export interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toThrow(expected?: string | RegExp): void;
  }

  export function expect(value: unknown): Matchers;

  export const mock: {
    module(path: string, factory: () => unknown): void;
  };
}
