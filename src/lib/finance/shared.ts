// Shared Finance-process rules (redesign P1). Every surface that reasons about
// "was this client contacted recently?" or "does this app belong in Archive?"
// must import from here — the pre-P1 bug class was each surface hand-rolling
// its own copy (20h here, same-calendar-day there; is_archived here,
// status-list there) and silently disagreeing.

// How long a docs-chase "contacted" tick stays fresh before the client must be
// chased again. Mirrored server-side in taskos-preapproval-digest (20h).
export const CONTACT_TTL_MS = 20 * 60 * 60 * 1000;

/** True while the docs-contacted stamp is present AND younger than the TTL. */
export function isContactFresh(app: {
  docs_contacted?: boolean | null;
  docs_contacted_at?: string | null;
}): boolean {
  if (!app?.docs_contacted || !app?.docs_contacted_at) return false;
  const at = new Date(app.docs_contacted_at).getTime();
  return !!at && Date.now() - at < CONTACT_TTL_MS;
}

// Statuses that read as "archived" per role. F&I deliberately keeps
// declined/blacklisted in Active (they still work those files); other roles
// use the legacy is_archived-flag-or-terminal rule. One function, one truth —
// AdminFinance's tab filter and its stat counters both call this.
const FNI_ARCHIVED_STATUSES = ['archived', 'vehicle_delivered', 'finalized', 'client_cancelled'];
const LEGACY_TERMINAL_STATUSES = ['finalized', 'delivered', 'vehicle_delivered', 'archived', 'client_cancelled'];

export function isArchivedApp(
  app: { status?: string | null; is_archived?: boolean | null },
  role: string | null | undefined,
): boolean {
  const s = (app?.status || '').toLowerCase().trim();
  if (role === 'f_and_i' || role === 'senior_f_and_i') {
    return FNI_ARCHIVED_STATUSES.includes(s);
  }
  return app?.is_archived === true || LEGACY_TERMINAL_STATUSES.includes(s);
}
