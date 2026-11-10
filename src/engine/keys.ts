// Throw a RangeError unless key is a whole number (the engine's key convention).

export function assertWholeNumber(key: number): void {
  if (!Number.isInteger(key)) {
    throw new RangeError(`Keys must be whole numbers, but got ${String(key)}`);
  }
}