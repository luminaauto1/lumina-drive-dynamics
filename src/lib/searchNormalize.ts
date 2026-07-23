// Shared search-matching for the admin client lists (Pipeline + Finance).
//
// The old predicates did a raw `blob.includes(query)`, so a phone typed with
// spaces / "+" / dashes ("+27 78 548 8607") never matched the stored digits
// ("27785488607" or "0785488607"). This normalises phone/ID queries to DIGITS so
// formatting can't block a hit, while leaving ordinary text search unchanged.

/** Digits only ("+27 78 548 8607" → "27785488607"). */
export const digitsOnly = (s?: string | null): string => String(s ?? '').replace(/\D/g, '');

/**
 * SA-canonical phone key for loose matching: the last 9 subscriber digits, so
 * "+27 78 548 8607", "078 548 8607", "0785488607" and "27785488607" all reduce to
 * "785488607" (0 / 27 / +27 agnostic). Inputs shorter than 9 digits (partial
 * searches) return their own digits, so a substring like "548 8607" still matches.
 */
export const saPhoneKey = (s?: string | null): string => {
  const d = digitsOnly(s);
  return d.length >= 9 ? d.slice(-9) : d;
};

/** A query that looks like a phone/ID lookup: only digits and phone punctuation
 *  (spaces, +, (), -, .). Anything with a letter is treated as text, not a number. */
export const isNumericQuery = (raw: string): boolean => {
  const t = String(raw ?? '').trim();
  return t.length > 0 && /\d/.test(t) && /^[\d\s+()\-.]+$/.test(t);
};

/**
 * Does an application match the search query?
 *  - text: plain case-insensitive substring over the given fields (names, email,
 *    bank name, …) — identical to the old behaviour, so nothing that matched
 *    before stops matching.
 *  - numeric queries (a phone / ID typed with spaces, +, dashes) ALSO match on
 *    DIGITS: phone via the SA last-9 key, id_number / bank_reference via raw digit
 *    substring. This is purely additive — it can only widen the result set.
 * Empty query matches everything (callers gate on that anyway).
 */
export const appMatchesSearch = (
  rawQuery: string,
  fields: {
    text?: (string | null | undefined)[];
    phone?: string | null;
    id?: string | null;
    bankRef?: string | null;
  },
): boolean => {
  const q = String(rawQuery ?? '').trim().toLowerCase();
  if (!q) return true;

  const textBlob = (fields.text ?? []).filter(Boolean).join(' ').toLowerCase();
  if (textBlob.includes(q)) return true;

  if (isNumericQuery(rawQuery)) {
    const qDigits = digitsOnly(rawQuery);
    if (qDigits.length >= 3) {
      const phoneKey = saPhoneKey(fields.phone);
      if (phoneKey && phoneKey.includes(saPhoneKey(rawQuery))) return true;
      const idDigits = digitsOnly(fields.id);
      if (idDigits && idDigits.includes(qDigits)) return true;
      const bankRefDigits = digitsOnly(fields.bankRef);
      if (bankRefDigits && bankRefDigits.includes(qDigits)) return true;
    }
  }
  return false;
};
