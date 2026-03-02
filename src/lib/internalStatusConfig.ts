// Internal Status Configuration for Finance & Insurance Workflow
// These are admin-only statuses for granular F&I tracking

export const INTERNAL_STATUS_OPTIONS = [
  { value: 'new', label: 'New Application' },
  { value: 'awaiting_docs', label: 'Awaiting Client Docs' },
  { value: 'submitted_to_banks', label: 'Submitted to Banks' },
  { value: 'bank_query', label: 'Bank Query / Action Needed' },
  { value: 'pre_approved', label: 'Approved In Principle (AIP)' },
  { value: 'validation_pending', label: 'Validation Pending (FICA/NATIS)' },
  { value: 'finance_approved', label: 'Final Finance Approved' },
  { value: 'contract_generated', label: 'Contract Generated' },
  { value: 'contract_signed', label: 'Contract Signed' },
  { value: 'awaiting_payout', label: 'Awaiting Bank Payout' },
  { value: 'paid_out', label: 'Paid Out / Finalized' },
  { value: 'declined', label: 'Declined by Banks' },
  { value: 'lost', label: 'Lost / Dead File' },
];

// Urgency hierarchy for sorting (lower = more urgent = show first)
export const INTERNAL_STATUS_URGENCY: Record<string, number> = {
  finance_approved: 1,
  contract_signed: 1,
  awaiting_payout: 1,
  contract_generated: 2,
  validation_pending: 2,
  pre_approved: 3,
  bank_query: 3,
  submitted_to_banks: 4,
  awaiting_docs: 4,
  new: 5,
  paid_out: 6,
  declined: 7,
  lost: 8,
};

// Badge styling with distinct colors
export const INTERNAL_STATUS_STYLES: Record<string, string> = {
  new: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  awaiting_docs: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  submitted_to_banks: 'bg-blue-600/20 text-blue-500 border-blue-600/30',
  bank_query: 'bg-orange-500/20 text-orange-500 border-orange-500/30 animate-pulse',
  pre_approved: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  validation_pending: 'bg-yellow-600/20 text-yellow-600 border-yellow-600/30',
  finance_approved: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30 animate-pulse',
  contract_generated: 'bg-cyan-600/20 text-cyan-500 border-cyan-600/30',
  contract_signed: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  awaiting_payout: 'bg-green-500/20 text-green-400 border-green-500/30 animate-pulse',
  paid_out: 'bg-green-700/20 text-green-600 border-green-700/30',
  declined: 'bg-red-500/20 text-red-500 border-red-500/30',
  lost: 'bg-zinc-800/20 text-zinc-600 border-zinc-800/30',
  // Legacy fallbacks
  new_lead: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  searching_for_stock: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  negotiating: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  waiting_docs: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  waiting_client: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  prepping_delivery: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  delivered: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

// Normalize legacy internal statuses to new ones
export const normalizeInternalStatus = (status: string | null | undefined): string => {
  if (!status) return 'new';
  const s = status.toLowerCase().trim();
  // Direct match
  const directMatch = INTERNAL_STATUS_OPTIONS.find(o => o.value === s);
  if (directMatch) return directMatch.value;
  // Legacy mappings
  if (s === 'new_lead') return 'new';
  if (s === 'waiting_docs' || s === 'waiting_for_docs') return 'awaiting_docs';
  if (s === 'waiting_client') return 'awaiting_docs';
  if (s === 'searching_for_stock' || s === 'negotiating') return 'new';
  if (s === 'prepping_delivery') return 'awaiting_payout';
  if (s === 'delivered') return 'paid_out';
  return 'new';
};

// Get urgency level for sorting
export const getInternalStatusUrgency = (status: string | null): number => {
  if (!status) return 5;
  return INTERNAL_STATUS_URGENCY[status] ?? INTERNAL_STATUS_URGENCY[normalizeInternalStatus(status)] ?? 5;
};

// Sort applications by urgency
export const sortByUrgency = <T extends { internal_status?: string | null }>(applications: T[]): T[] => {
  return [...applications].sort((a, b) => {
    const urgencyA = getInternalStatusUrgency(a.internal_status);
    const urgencyB = getInternalStatusUrgency(b.internal_status);
    return urgencyA - urgencyB;
  });
};

// Check if status qualifies for delivery prep
export const canShowDeliveryPrep = (status: string): boolean => {
  const eligibleStatuses = [
    'pre_approved',
    'finance_approved',
    'contract_generated',
    'contract_sent',
    'contract_signed',
    'awaiting_payout',
    'paid_out',
    'documents_received',
    'validations_pending',
    'validations_complete',
    'vehicle_selected',
    'vehicle_delivered',
  ];
  return eligibleStatuses.includes(status);
};
