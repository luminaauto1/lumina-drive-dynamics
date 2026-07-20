// Pipeline v2 lanes (a NEW Lumina artifact — NOT a 1:1 port of ZTC's Sheet tabs).
// Groups Lumina's finance_applications.status slugs into navigable lanes. The map is
// EXHAUSTIVE over STATUS_OPTIONS + every legacy/extra slug statusConfig/STATUS_STYLES knows.

export interface PipelineTabDef {
  key: string;
  label: string;
  statuses: string[];
  accent: string; // tailwind text colour for the active underline/count
  /** Default lane colour (hex) used to tint the ACTIVE tab + fill its count chip,
   *  chosen to match the finance statuses the lane groups (emerald = credit passed,
   *  blue = at the banks, red = declined…). Mirrors `accent`, but as a hex because
   *  the tint/underline are applied inline (Tailwind's JIT can't see runtime
   *  values). A per-lane colour saved in Settings → Pipeline Lanes overrides it. */
  defaultColor: string;
}

export const PIPELINE_TABS: PipelineTabDef[] = [
  // NOTE: the 'all' view-all pseudo-tab was removed (search finds anyone across
  // lanes, so it wasn't needed). No DATA is hidden: statusToTab routes every
  // application — including unknown statuses — to exactly one real lane ('intake'
  // by default). statusToTab/resolveStatusTab/inTab still handle 'all' harmlessly
  // (inTab's 'all' branch is simply unused now).
  { key: 'intake',     label: 'New Applications', statuses: ['pending', 'draft', 'needs_revision', 'revision_submitted'], accent: 'text-gray-300', defaultColor: '#a1a1aa' },
  // Wrong Info (owner 2026-07-20): a working lane for applications whose details
  // need correcting, sitting between intake and the credit check. Intentionally
  // ships with NO statuses mapped — the owner assigns which finance status(es)
  // land here via Settings → Statuses → "Moves the application to" (that writes
  // status_overrides.lane, which resolveStatusTab honours over this list). Until
  // then the lane is simply empty; no existing application is re-routed.
  { key: 'wrong_info', label: 'Wrong Info', statuses: [], accent: 'text-orange-400', defaultColor: '#fb923c' },
  // Credit check PASSED and the F&I outcome was set to "Ready to Load" (the
  // application_submitted slug, relabelled). Its own lane between New Applications
  // and Submitted so these leads don't sit in the bank-submission column.
  // application_submitted lives ONLY here now (removed from 'submitted') so
  // statusToTab routes it to this lane, not the later 'submitted' one.
  { key: 'credit_passed', label: 'Credit Check Passed', statuses: ['application_submitted'], accent: 'text-emerald-400', defaultColor: '#34d399' },
  { key: 'submitted',  label: 'Submitted',   statuses: ['ready_to_submit', 'sent_to_banks'], accent: 'text-blue-400', defaultColor: '#60a5fa' },
  { key: 'approved',   label: 'Approved',    statuses: ['pre_approved', 'documents_received', 'approved', 'vehicle_selected'], accent: 'text-yellow-400', defaultColor: '#facc15' },
  // Flexi = the non-traditional finance partner's track (owner, 2026-07-14).
  { key: 'flexi',      label: 'Flexi',       statuses: ['pre_approved_flexi', 'vals_submitted_flexi', 'validated_flexi'], accent: 'text-teal-400', defaultColor: '#2dd4bf' },
  // Contract lane removed: contract-signed deals stay grouped under Validations
  // ("Vals Done") rather than splitting into their own column. contract_sent /
  // contract_signed are VIEW-grouped here only — the status enum is unchanged so
  // OTP / mailer / deal-desk logic that depends on those slugs is unaffected.
  { key: 'validations', label: 'Validations', statuses: ['validations_pending', 'validations_complete', 'contract_sent', 'contract_signed'], accent: 'text-green-400', defaultColor: '#4ade80' },
  { key: 'delivered',  label: 'Delivered',   statuses: ['vehicle_delivered', 'finalized'], accent: 'text-amber-400', defaultColor: '#fbbf24' },
  { key: 'declined',   label: 'Declined',    statuses: ['declined', 'declined_conditional', 'blacklisted'], accent: 'text-red-400', defaultColor: '#f87171' },
  { key: 'closed',     label: 'Closed',      statuses: ['archived', 'client_cancelled'], accent: 'text-gray-500', defaultColor: '#71717a' },
];

// status slug -> lane key (exhaustive; unknown slugs fall to 'intake').
const STATUS_TO_TAB: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const t of PIPELINE_TABS) for (const s of t.statuses) m[s] = t.key;
  return m;
})();

export const statusToTab = (status: string | null | undefined): string =>
  (status && STATUS_TO_TAB[status]) || 'intake';

// Valid DESTINATION lane keys — every real PIPELINE_TABS id EXCEPT 'all'. 'all'
// is a view-all pseudo-tab, never a routing target: an app routed to 'all' would
// match no specific lane (inTab is false for every t.key !== 'all') and so would
// vanish from every working tab + count. Excluding it here means a stale/invalid
// lane='all' override falls back to the hardcoded default instead of orphaning.
const VALID_TAB_KEYS = new Set(PIPELINE_TABS.map((t) => t.key).filter((k) => k !== 'all'));

/**
 * Effective destination lane for a status, honouring a per-slug override map.
 * `overrides` maps a finance status slug -> a PIPELINE_TABS id (from the editable
 * status_overrides.lane column). The override wins ONLY when present AND a real
 * destination lane id (a real lane, not the 'all' pseudo-tab); otherwise we fall
 * back to the hardcoded statusToTab default. So an empty/missing/invalid override
 * === current behaviour. statusToTab itself is never mutated.
 */
export const resolveStatusTab = (
  status: string | null | undefined,
  overrides?: Record<string, string>,
): string => {
  const ov = status ? overrides?.[status] : undefined;
  if (ov && VALID_TAB_KEYS.has(ov)) return ov;
  return statusToTab(status);
};

/** Whether an application (by status) belongs in the given lane. 'all' matches everything.
 *  Pass `overrides` to honour editable per-slug lane routing (resolveStatusTab). */
export const inTab = (
  tabKey: string,
  status: string | null | undefined,
  overrides?: Record<string, string>,
): boolean =>
  tabKey === 'all' ? true : resolveStatusTab(status, overrides) === tabKey;
