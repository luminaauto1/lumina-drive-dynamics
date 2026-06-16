// Shared CRM stage taxonomy for the unified CRM (Board + Table views).
// IMPORTANT: these stage IDs are a data contract. pipeline_stage values are read
// by AdminAnalytics + AdminDashboard, so the underlying string values must not
// change. We only add presentation (labels, colors, phase grouping) on top.

export interface CrmStage {
  id: string;
  label: string;
  /** Tailwind border colour class for the column accent. */
  color: string;
  /** Higher-level phase this stage belongs to (for grouping + KPIs). */
  phase: CrmPhaseId;
}

export type CrmPhaseId = 'inbox' | 'working' | 'bank' | 'validation' | 'contract' | 'delivery' | 'closed';

export interface CrmPhase {
  id: CrmPhaseId;
  label: string;
  color: string; // text/badge accent
}

export const CRM_PHASES: CrmPhase[] = [
  { id: 'inbox',      label: 'Inbox',         color: 'text-zinc-300' },
  { id: 'working',    label: 'Working',       color: 'text-blue-400' },
  { id: 'bank',       label: 'With Banks',    color: 'text-yellow-400' },
  { id: 'validation', label: 'Validation',    color: 'text-orange-400' },
  { id: 'contract',   label: 'Contract',      color: 'text-cyan-400' },
  { id: 'delivery',   label: 'Delivery',      color: 'text-emerald-400' },
  { id: 'closed',     label: 'Closed / Lost', color: 'text-red-400' },
];

// The 15 canonical pipeline stages (IDs unchanged from the original board).
export const CRM_STAGES: CrmStage[] = [
  { id: 'new',                 label: 'Inbox (New)',        color: 'border-zinc-700',   phase: 'inbox' },
  { id: 'actioned',            label: 'Actioned',           color: 'border-zinc-500',   phase: 'working' },
  { id: 'docs_collected',      label: 'Docs Collected',     color: 'border-blue-900',   phase: 'working' },
  { id: 'submitted_to_banks',  label: 'Submitted to Banks', color: 'border-blue-600',   phase: 'bank' },
  { id: 'pre_approved',        label: 'Pre-Approved',       color: 'border-yellow-600', phase: 'bank' },
  { id: 'finance_approved',    label: 'Finance Approved',   color: 'border-yellow-400', phase: 'bank' },
  { id: 'validation_pending',  label: 'Validation Pending', color: 'border-orange-600', phase: 'validation' },
  { id: 'validated',           label: 'Validated',          color: 'border-emerald-600',phase: 'validation' },
  { id: 'contract_generated',  label: 'Contract Generated', color: 'border-cyan-700',   phase: 'contract' },
  { id: 'contract_sent',       label: 'Contract Sent',      color: 'border-cyan-500',   phase: 'contract' },
  { id: 'contract_signed',     label: 'Contract Signed',    color: 'border-cyan-300',   phase: 'contract' },
  { id: 'prepping_delivery',   label: 'Prepping Delivery',  color: 'border-green-400',  phase: 'delivery' },
  { id: 'delivered',           label: 'Delivered',          color: 'border-green-600',  phase: 'delivery' },
  { id: 'declined',            label: 'Declined',           color: 'border-red-600',    phase: 'closed' },
  { id: 'lost',                label: 'Lost / Dead',        color: 'border-zinc-800',   phase: 'closed' },
];

export const stageById = (id: string): CrmStage | undefined => CRM_STAGES.find((s) => s.id === id);

// Brute-force normalizer — maps any historical/finance status string to a stage id.
// Ported verbatim from the original AdminLeads board so behaviour is identical.
export const normalizeStage = (status: string | null | undefined): string => {
  if (!status) return 'new';
  const s = String(status).toLowerCase().trim();

  if (s.includes('archive')) return 'archived';
  if (s.includes('lost') || s.includes('dead')) return 'lost';
  if (s.includes('decline') || s.includes('reject')) return 'declined';
  if (s.includes('deliver') || s.includes('sold') || s.includes('won')) return 'delivered';
  if (s.includes('prep')) return 'prepping_delivery';
  if (s.includes('signed')) return 'contract_signed';
  if (s.includes('sent')) return 'contract_sent';
  if (s.includes('generat')) return 'contract_generated';
  if (s.includes('validat') && !s.includes('pending')) return 'validated';
  if (s.includes('validation') || (s.includes('valid') && s.includes('pending'))) return 'validation_pending';
  if (s.includes('pre') && s.includes('approv')) return 'pre_approved';
  if (s.includes('approv')) return 'finance_approved';
  if (s.includes('submit')) return 'submitted_to_banks';
  if (s.includes('doc')) return 'docs_collected';
  if (s.includes('action')) return 'actioned';

  const clean = s.replace(/[\s-]/g, '_').replace(/[^a-z0-9_]/g, '');
  if (clean === 'otp_verified' || clean === 'application_started' || clean === 'pending') return 'new';
  if (CRM_STAGES.some((col) => col.id === clean)) return clean;
  return 'new';
};
