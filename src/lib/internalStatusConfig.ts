export const INTERNAL_STATUSES = {
  no_notes: { label: "No Notes", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  note_to_admin: { label: "Note to Admin", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  note_to_f_and_i: { label: "Note to F&I", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  note_to_senior_f_and_i: { label: "Note to Senior F&I", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
} as const;

export type InternalStatus = keyof typeof INTERNAL_STATUSES;

// Legacy keys collapse to the new 3-tier directed routing model.
// The old "Updates Needed / Info Updated / Note to Sales" semantics are
// absorbed into Admin/Senior F&I/F&I notes.
export const LEGACY_INTERNAL_STATUS_MAP: Record<string, InternalStatus> = {
  // Old sales→F&I escalations and admin chase tasks → Admin
  updates_needed: 'note_to_admin',
  attention_needed: 'note_to_admin',
  give_attention: 'note_to_admin',
  note_to_sales: 'note_to_admin',
  // Old F&I-resolved pings → Senior F&I review queue
  info_updated: 'note_to_senior_f_and_i',
  feedback_provided: 'note_to_senior_f_and_i',
  feedback_received: 'note_to_senior_f_and_i',
  resolved_ready_for_f_and_i: 'note_to_senior_f_and_i',
  // Neutral / cleared
  attention_given: 'no_notes',
  new_lead: 'no_notes',
};

export function normalizeInternalStatus(value: string | null | undefined): InternalStatus | null {
  if (!value) return null;
  const v = String(value).trim();
  if ((INTERNAL_STATUSES as any)[v]) return v as InternalStatus;
  return LEGACY_INTERNAL_STATUS_MAP[v] || null;
}
