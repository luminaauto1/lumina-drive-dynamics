export const INTERNAL_STATUSES = {
  attention_needed: { label: "Attention Needed", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  give_attention: { label: "Give Attention", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  attention_given: { label: "Attention Given", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  new_lead: { label: "New Lead", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  feedback_received: { label: "Feedback Received", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  resolved_ready_for_f_and_i: { label: "Resolved - Ready for F&I", color: "bg-amber-400/15 text-amber-300 border-amber-400/30" },
} as const;

export type InternalStatus = keyof typeof INTERNAL_STATUSES;

// Legacy map kept for normalization callers; all keys now exist canonically,
// so this is effectively a passthrough but preserved for API stability.
export const LEGACY_INTERNAL_STATUS_MAP: Record<string, InternalStatus> = {};

export function normalizeInternalStatus(value: string | null | undefined): InternalStatus | null {
  if (!value) return null;
  const v = String(value).trim();
  if ((INTERNAL_STATUSES as any)[v]) return v as InternalStatus;
  return LEGACY_INTERNAL_STATUS_MAP[v] || null;
}
