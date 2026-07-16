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

// ONE archive rule for EVERY role (owner 2026-07-15: "why is blacklisted and
// declined not in archive??"): an app is archived when its is_archived flag is
// set OR its status is terminal — including declined/blacklisted, which the old
// F&I rule kept in Active and which older rows never had the flag set for.
// declined_conditional stays ACTIVE (soft decline — still actionable).
// AdminFinance's tab filter and its stat counters both call this.
const TERMINAL_STATUSES = [
  'finalized', 'delivered', 'vehicle_delivered', 'archived',
  'client_cancelled', 'declined', 'blacklisted', 'lost',
];

export function isArchivedApp(
  app: { status?: string | null; is_archived?: boolean | null },
  _role: string | null | undefined,
): boolean {
  const s = (app?.status || '').toLowerCase().trim();
  return app?.is_archived === true || TERMINAL_STATUSES.includes(s);
}

// ── Per-user application visibility (Settings → Team, app_visibility_rules) ──
// Asymmetric by design: user A can be granted user B's apps without B being
// granted A's. Finance AND Pipeline both filter through this ONE function so
// the two pages can never disagree.
export interface AppVisibilityRule {
  user_id: string;
  mode: 'default' | 'all' | 'own' | 'custom';
  visible_user_ids: string[];
}

export function canSeeApplication(opts: {
  /** assigned_f_and_i of the application */
  owner: string | null | undefined;
  /** unassigned OR owned by a senior (senior "ownership" = who captured it) */
  effectivelyUnassigned: boolean;
  role: string | null | undefined;
  userId: string | null | undefined;
  rule: AppVisibilityRule | null | undefined;
}): boolean {
  const { owner, effectivelyUnassigned, role, userId, rule } = opts;
  // Admins are never lockable — the owner can't hide apps from themselves.
  if (role === 'super_admin') return true;
  const mode = rule?.mode && rule.mode !== 'default'
    ? rule.mode
    // Legacy defaults: normal F&I sees own + unassigned; everyone else sees all.
    : role === 'f_and_i' ? 'own' : 'all';
  switch (mode) {
    case 'all':
      return true;
    case 'own':
      return effectivelyUnassigned || owner === userId;
    case 'custom':
      // STRICT (owner rule 2026-07-15): ONLY own apps + the granted users'
      // apps. No unassigned/new pool, no senior-captured claimables.
      return owner === userId
        || (!!owner && (rule?.visible_user_ids || []).includes(owner));
    default:
      return true;
  }
}
