// Deterministic per-user colour for the "who is viewing this profile" presence
// highlight (ported verbatim from ZTC's presence/user-color.ts). Stable per user id,
// no DB column — the colour also rides in the presence payload so all clients agree.
const PALETTE = [
  '#E11D48', '#7C3AED', '#2563EB', '#0891B2', '#059669',
  '#CA8A04', '#EA580C', '#DB2777', '#4F46E5', '#0D9488',
];

export function colorForUser(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
