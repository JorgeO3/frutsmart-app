export type SafeExtract<T, U extends T> = T extends U ? T : never;
