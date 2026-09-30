/**
 * AICTE-sourced values arrive in ALL CAPS (e.g. "BANGALORE URBAN"). Display
 * them in Title Case while keeping the raw value for API filters.
 */
export function prettyLabel(value) {
  if (typeof value !== 'string' || value.length === 0) return value;

  const isAllCaps = value === value.toUpperCase() && /[A-Z]/.test(value);
  if (!isAllCaps) return value;

  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}
