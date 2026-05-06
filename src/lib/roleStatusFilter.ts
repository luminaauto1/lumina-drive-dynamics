// Status keys an F&I user is allowed to set
export const F_AND_I_ALLOWED_STATUSES = [
  'pre_approved',
  'validations_pending',
  'validations_complete',
  'contract_sent',
  'contract_signed',
];

export function filterStatusOptionsForRole<T extends { value: string }>(
  options: T[],
  role: string | null | undefined,
  currentStatus?: string
): T[] {
  if (role !== 'f_and_i') return options;
  const allowed = new Set(F_AND_I_ALLOWED_STATUSES);
  // Always include the current status (read-only fallback) so the trigger renders
  if (currentStatus) allowed.add(currentStatus);
  return options.filter(o => allowed.has(o.value));
}
