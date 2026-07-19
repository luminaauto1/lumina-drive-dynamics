/** Returns a readable text colour ('#0a0a0a' or '#ffffff') for content placed ON the given hex fill,
 *  via relative-luminance (YIQ) threshold. Falls back to white for invalid input. */
export const readableTextOn = (hex?: string | null): string => {
  if (!hex) return '#ffffff';
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return '#ffffff';
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  // YIQ brightness; >150 => dark text, else white.
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0a0a0a' : '#ffffff';
};

/** Translucent (~12% alpha) 8-digit-hex tint of a lane hex, used as the active-tab
 *  body fill. Normalises #RGB shorthand to #RRGGBB before appending the alpha byte
 *  (an alpha suffix on a 3-digit hex would be parsed as R/G/B/A nibbles).
 *  Returns null for missing/invalid input so callers can fall back to the default
 *  desk-accent tint class. */
export const hexTint = (hex?: string | null): string | null => {
  if (!hex) return null;
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h}1f`; // 0x1f = 31/255 ≈ 12% alpha
};
