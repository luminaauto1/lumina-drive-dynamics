/**
 * Contact sanitization helpers used for referral cross-referencing.
 * Strict: trims, lowercases (email), strips all non-digits (phone).
 * Returns null if not enough data to match against.
 */
export const normalizeEmail = (value?: string | null): string | null => {
  if (!value) return null;
  const v = value.trim().toLowerCase().replace(/\s+/g, '');
  return v.length > 3 && v.includes('@') ? v : null;
};

export const normalizePhone = (value?: string | null): string | null => {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7) return null;
  // Compare the last 9 digits — handles +27 / 0 prefix variants.
  return digits.slice(-9);
};
