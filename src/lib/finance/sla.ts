// SLA / time-in-status rules for the Finance work queues (redesign P2).
// status_updated_at is stamped on every status change (client hook + the
// stamp_status_change DB trigger from P1), so age-in-status is reliable.
// Thresholds here are DEFAULTS — Phase 4 makes them owner-tunable per status.

export const DEFAULT_SLA_HOURS: Record<string, number> = {
  pending: 24,                 // fresh lead — triage within a day
  application_submitted: 48,   // Ready To Load — load it
  ready_to_submit: 24,         // packaged — submit it
  sent_to_banks: 72,           // bank feedback expected within 3 days
  pre_approved: 48,            // docs chase cadence
  pre_approved_flexi: 48,
  documents_received: 48,      // docs in — start validations
  validations_pending: 120,    // 5 days
  validations_complete: 72,    // move to contract
  contract_sent: 120,          // 5 days
};

/** Milliseconds this app has been sitting in its current status. */
export function ageInStatusMs(app: {
  status_updated_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}): number {
  const t = app?.status_updated_at || app?.updated_at || app?.created_at;
  if (!t) return 0;
  return Math.max(0, Date.now() - new Date(t).getTime());
}

// Owner-tunable overrides (status_overrides.sla_hours, P4). Synced from the
// settings query by the Finance page on load; empty until then, so the
// defaults above always apply as the fallback.
let SLA_OVERRIDES: Record<string, number> = {};
export function setSlaOverrides(map: Record<string, number>) {
  SLA_OVERRIDES = map || {};
}

export function slaHoursFor(status: string | null | undefined): number | null {
  if (!status) return null;
  return SLA_OVERRIDES[status] ?? DEFAULT_SLA_HOURS[status] ?? null;
}

/** How far past its status SLA this app is, in ms. 0 = within SLA or no SLA. */
export function slaOverrunMs(app: { status?: string | null } & Parameters<typeof ageInStatusMs>[0]): number {
  const hours = slaHoursFor(app?.status);
  if (hours == null) return 0;
  return Math.max(0, ageInStatusMs(app) - hours * 3600_000);
}

/** True when the app's current status has an SLA and the app has breached it. */
export function isStalled(app: { status?: string | null } & Parameters<typeof ageInStatusMs>[0]): boolean {
  return slaOverrunMs(app) > 0;
}

/** Compact human age: "45m", "7h", "3d 4h". */
export function formatAge(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}
