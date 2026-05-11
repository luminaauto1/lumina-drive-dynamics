// Status keys an F&I user is allowed to set
export const F_AND_I_ALLOWED_STATUSES = [
  'sent_to_banks',
  'pre_approved',
  'validations_pending',
  'validations_complete',
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

export function filterStatusOptionsForRole<T extends { value: string }>(
  options: T[],
  role: string | null | undefined,
  currentStatus?: string
): T[] {
  if (role !== 'f_and_i' && role !== 'senior_f_and_i') return options;
  const base = role === 'senior_f_and_i'
    ? SENIOR_F_AND_I_ALLOWED_STATUSES
    : F_AND_I_ALLOWED_STATUSES;
  const allowed = new Set(base);
  // Always include the current status (read-only fallback) so the trigger renders
  if (currentStatus) allowed.add(currentStatus);
  return options.filter(o => allowed.has(o.value));
}
