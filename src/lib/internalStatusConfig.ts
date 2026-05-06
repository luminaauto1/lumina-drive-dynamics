export const INTERNAL_STATUSES = {
  attention_needed: { label: "Attention Needed", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  feedback_received: { label: "Feedback Received", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  resolved_ready_for_f_and_i: { label: "Resolved - Ready for F&I", color: "bg-amber-400/15 text-amber-300 border-amber-400/30" },
} as const;

export type InternalStatus = keyof typeof INTERNAL_STATUSES;

// Legacy keys mapped to canonical ones for backwards compatibility with
// existing rows that still hold the old values.
export const LEGACY_INTERNAL_STATUS_MAP: Record<string, InternalStatus> = {
  give_attention: 'attention_needed',
  attention_given: 'attention_needed',
  new_lead: 'attention_needed',
};

export function normalizeInternalStatus(value: string | null | undefined): InternalStatus | null {
  if (!value) return null;
  const v = String(value).trim();
  if ((INTERNAL_STATUSES as any)[v]) return v as InternalStatus;
  return LEGACY_INTERNAL_STATUS_MAP[v] || null;
}
