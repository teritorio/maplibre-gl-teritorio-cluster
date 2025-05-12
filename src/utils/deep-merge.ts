/**
 * Recursively merges two objects, giving precedence to values from the `source` object.
 *
 * This function performs a deep merge: if a value in both `target` and `source` is an object (but not an array),
 * their properties will be merged recursively. If a property exists in `source` and is not `undefined`,
 * it will override the corresponding value in `target`.
 *
 * Arrays are not merged recursively and will be replaced entirely if present in `source`.
 *
 * @template T - The type of the target and resulting object.
 * @param target - The base object to merge into.
 * @param source - The object whose properties will override or extend those in `target`.
 *
 * @returns A new object resulting from deeply merging `source` into `target`.
 */
export function deepMerge<T>(target: T, source: Partial<T>): T {
  const output = { ...target }
  for (const key in source) {
    if (
      source[key]
      && typeof source[key] === 'object'
      && !Array.isArray(source[key])
    ) {
      output[key] = deepMerge((target as any)[key] || {}, source[key])
    }
    else if (source[key] !== undefined) {
      output[key] = source[key] as any
    }
  }
  return output
}
