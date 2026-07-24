// Status keys an F&I user is allowed to set
export const F_AND_I_ALLOWED_STATUSES = [
  'ready_to_submit',
  'sent_to_banks',
  'pre_approved',
  'pre_approved_flexi',
  'validations_pending',
  'validations_complete',
  'vals_submitted_flexi',
  'validated_flexi',
  'contract_sent',
  'contract_signed',
  'declined',
  'declined_conditional',
  'blacklisted',
  'archived',
];

// Senior F&I = standard F&I PLUS the "App Submitted" stage.
export const SENIOR_F_AND_I_ALLOWED_STATUSES = [
  ...F_AND_I_ALLOWED_STATUSES,
  'application_submitted',
];

/**
 * Which statuses this user may SET.
 *
 * `perUser` is the owner's per-user override from Settings → Status
 * Permissions (app_visibility_rules.allowed_statuses). When set it wins over
 * the role default for EVERY role — including admins, so the owner can pin a
 * user to a narrow set. Null/empty falls back to the role default, which is
 * unrestricted for anyone who is not F&I.
 */
export function filterStatusOptionsForRole<T extends { value: string }>(
  options: T[],
  role: string | null | undefined,
  currentStatus?: string,
  perUser?: string[] | null,
  hiddenSlugs?: Set<string> | null,
): T[] {
  let result = options;

  // 1) Role / per-user allowlist. Unchanged; only runs when a restriction applies.
  const override = perUser && perUser.length > 0 ? perUser : null;
  if (override || role === 'f_and_i' || role === 'senior_f_and_i') {
    const base = override
      ?? (role === 'senior_f_and_i' ? SENIOR_F_AND_I_ALLOWED_STATUSES : F_AND_I_ALLOWED_STATUSES);
    const allowed = new Set(base);
    // Always include the current status (read-only fallback) so the trigger renders.
    if (currentStatus) allowed.add(currentStatus);
    result = result.filter(o => allowed.has(o.value));
  }

  // 2) Admin-hidden statuses (Settings → Statuses "delete"/hide). Applies to EVERY
  //    role, including unrestricted admins — a hidden finance status must not be
  //    offered anywhere. The current status is kept so a lead already sitting in a
  //    hidden status still renders its badge and can be moved OUT of it. Omitted /
  //    empty set => byte-for-byte the previous behaviour (backward compatible).
  if (hiddenSlugs && hiddenSlugs.size > 0) {
    result = result.filter(o => o.value === currentStatus || !hiddenSlugs.has(o.value));
  }

  return result;
}
