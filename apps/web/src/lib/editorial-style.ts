/** Normalize presentation punctuation without changing object keys or facts. */
export function editorialStyle<T>(value: T): T {
  if (typeof value === "string") return value.replace(/[^\S\r\n]*\u2014[^\S\r\n]*/g, " - ") as T;
  if (Array.isArray(value)) return value.map(editorialStyle) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /(?:id|url|uri|email|path|token|hash)$|^link$|^(?:excerpt|evidence|sourceText)$/i.test(key) ? item : editorialStyle(item)])) as T;
  }
  return value;
}
