// Pipeline v2 lanes (a NEW Lumina artifact — NOT a 1:1 port of ZTC's Sheet tabs).
// Groups Lumina's finance_applications.status slugs into navigable lanes. The map is
// EXHAUSTIVE over STATUS_OPTIONS + every legacy/extra slug statusConfig/STATUS_STYLES knows.

export interface PipelineTabDef {
  key: string;
  label: string;
  statuses: string[];
  accent: string; // tailwind text colour for the active underline/count
}

export const PIPELINE_TABS: PipelineTabDef[] = [
  { key: 'all',        label: 'All',         statuses: [], accent: 'text-foreground' },
  { key: 'intake',     label: 'New Applications', statuses: ['pending', 'draft', 'needs_revision', 'revision_submitted'], accent: 'text-gray-300' },
  { key: 'submitted',  label: 'Submitted',   statuses: ['application_submitted', 'ready_to_submit', 'sent_to_banks'], accent: 'text-blue-400' },
  { key: 'approved',   label: 'Approved',    statuses: ['pre_approved', 'documents_received', 'approved', 'vehicle_selected'], accent: 'text-yellow-400' },
  { key: 'validations', label: 'Validations', statuses: ['validations_pending', 'validations_complete'], accent: 'text-green-400' },
  { key: 'contract',   label: 'Contract',    statuses: ['contract_sent', 'contract_signed'], accent: 'text-purple-400' },
  { key: 'delivered',  label: 'Delivered',   statuses: ['vehicle_delivered', 'finalized'], accent: 'text-amber-400' },
  { key: 'declined',   label: 'Declined',    statuses: ['declined', 'declined_conditional', 'blacklisted'], accent: 'text-red-400' },
  { key: 'closed',     label: 'Closed',      statuses: ['archived', 'client_cancelled'], accent: 'text-gray-500' },
];

// status slug -> lane key (exhaustive; unknown slugs fall to 'intake').
const STATUS_TO_TAB: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const t of PIPELINE_TABS) for (const s of t.statuses) m[s] = t.key;
  return m;
})();

export const statusToTab = (status: string | null | undefined): string =>
  (status && STATUS_TO_TAB[status]) || 'intake';

/** Whether an application (by status) belongs in the given lane. 'all' matches everything. */
export const inTab = (tabKey: string, status: string | null | undefined): boolean =>
  tabKey === 'all' ? true : statusToTab(status) === tabKey;
