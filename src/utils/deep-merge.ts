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
