/**
 * Tap-to-call helper. Phones only open the dialer when the number is digits
 * (plus an optional country code), so spaces, dashes and brackets are dropped.
 * Returns "" when the value is too short to be callable.
 */
export function telHref(value?: string | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const plus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return "";
  return `tel:${plus ? `+${digits}` : digits}`;
}
