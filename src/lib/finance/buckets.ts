// The ONE counting system for the Finance page (redesign P2). Replaces the old
// FNI_PIPELINE strip + 9 StatTiles, which counted the same rows two different
// ways. Every status maps to exactly one KPI bucket; the strip is clickable and
// filters the table. Status SLUGS and their labels are untouched (owner rule) —
// bucket captions are just groupings for the strip.

export interface KpiBucket {
  key: string;
  label: string;
  statuses: string[];
  /** tailwind classes for the tile accent */
  color: string;
}

export const KPI_BUCKETS: KpiBucket[] = [
  { key: 'pending',         label: 'Pending',         statuses: ['pending'],                                    color: 'text-amber-400 border-amber-500/30' },
  { key: 'ready_to_load',   label: 'Ready To Load',   statuses: ['application_submitted'],                      color: 'text-indigo-400 border-indigo-500/30' },
  { key: 'ready_to_submit', label: 'Ready to Submit', statuses: ['ready_to_submit'],                            color: 'text-emerald-300 border-emerald-500/30' },
  { key: 'sent_to_banks',   label: 'Sent to Banks',   statuses: ['sent_to_banks'],                              color: 'text-sky-400 border-sky-500/30' },
  { key: 'pre_approved',    label: 'Pre-Approved',    statuses: ['pre_approved'],                               color: 'text-teal-400 border-teal-500/30' },
  { key: 'docs_received',   label: 'Docs Received',   statuses: ['documents_received'],                         color: 'text-cyan-400 border-cyan-500/30' },
  { key: 'validations',     label: 'Validations',     statuses: ['validations_pending', 'validations_complete'], color: 'text-blue-400 border-blue-500/30' },
  { key: 'contracts',       label: 'Contracts',       statuses: ['contract_sent', 'contract_signed'],           color: 'text-violet-400 border-violet-500/30' },
  { key: 'flexi',           label: 'Flexi',           statuses: ['pre_approved_flexi', 'vals_submitted_flexi', 'validated_flexi'], color: 'text-lime-400 border-lime-500/30' },
  { key: 'declined',        label: 'Declined (30d)',  statuses: ['declined', 'declined_conditional', 'blacklisted'], color: 'text-red-400 border-red-500/30' },
];

const STATUS_TO_BUCKET = new Map<string, string>();
for (const b of KPI_BUCKETS) for (const s of b.statuses) STATUS_TO_BUCKET.set(s, b.key);

/** Bucket key for an app's current status, or null when it has no tile
 *  (needs_revision, vehicle_delivered, archived, ... — mostly archive-scope). */
export function bucketOf(app: { status?: string | null }): string | null {
  return STATUS_TO_BUCKET.get((app?.status || '').toLowerCase().trim()) ?? null;
}

export function bucketStatuses(key: string): string[] {
  return KPI_BUCKETS.find((b) => b.key === key)?.statuses ?? [];
}

const isToday = (d?: string | null) => {
  if (!d) return false;
  const x = new Date(d), n = new Date();
  return x.getFullYear() === n.getFullYear() && x.getMonth() === n.getMonth() && x.getDate() === n.getDate();
};

/** Daily high-water mark: did this app ENTER one of these statuses today at any
 *  point (status_history), regardless of where it is now? One app contributes
 *  at most +1. `useCreated` also counts brand-new rows created today. */
export function enteredStatusesToday(
  app: any,
  statuses: string[],
  useCreated = false,
): boolean {
  const history = Array.isArray(app?.status_history) ? app.status_history : [];
  const set = new Set(statuses);
  if (history.some((e: any) => set.has(e?.status) && isToday(e?.timestamp))) return true;
  if (set.has(app?.status)) {
    if (app?.status_updated_at && isToday(app.status_updated_at)) return true;
    if (useCreated && isToday(app?.created_at)) return true;
  }
  return false;
}
