export const INTERNAL_STATUSES = {
  attention_needed: { label: "Attention Needed", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  feedback_provided: { label: "Feedback Provided", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
} as const;

export type InternalStatus = keyof typeof INTERNAL_STATUSES;

// Legacy keys collapse to one of the two canonical statuses for backwards
// compatibility with rows still holding deprecated values.
export const LEGACY_INTERNAL_STATUS_MAP: Record<string, InternalStatus> = {
  give_attention: 'attention_needed',
  attention_given: 'attention_needed',
  new_lead: 'attention_needed',
  feedback_received: 'feedback_provided',
  resolved_ready_for_f_and_i: 'feedback_provided',
};

export function normalizeInternalStatus(value: string | null | undefined): InternalStatus | null {
  if (!value) return null;
  const v = String(value).trim();
  if ((INTERNAL_STATUSES as any)[v]) return v as InternalStatus;
  return LEGACY_INTERNAL_STATUS_MAP[v] || null;
}
