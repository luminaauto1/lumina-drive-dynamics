export const INTERNAL_STATUSES = {
  no_notes: { label: "No Notes", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  updates_needed: { label: "Updates Needed", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  info_updated: { label: "Info Updated", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  note_to_f_and_i: { label: "Note to F&I", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  note_to_sales: { label: "Note to Sales", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
} as const;

export type InternalStatus = keyof typeof INTERNAL_STATUSES;

// Legacy keys collapse to one of the canonical statuses for backwards
// compatibility with rows still holding deprecated values.
export const LEGACY_INTERNAL_STATUS_MAP: Record<string, InternalStatus> = {
  attention_needed: 'updates_needed',
  feedback_provided: 'info_updated',
  give_attention: 'updates_needed',
  attention_given: 'no_notes',
  new_lead: 'updates_needed',
  feedback_received: 'info_updated',
  resolved_ready_for_f_and_i: 'info_updated',
};

export function normalizeInternalStatus(value: string | null | undefined): InternalStatus | null {
  if (!value) return null;
  const v = String(value).trim();
  if ((INTERNAL_STATUSES as any)[v]) return v as InternalStatus;
  return LEGACY_INTERNAL_STATUS_MAP[v] || null;
}
