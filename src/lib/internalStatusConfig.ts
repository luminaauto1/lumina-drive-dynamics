// Internal Status Configuration for Deal Pulse
// These are admin-only statuses for granular workflow tracking

export const INTERNAL_STATUS_OPTIONS = [
  { value: 'new_lead', label: 'New Lead' },
  { value: 'searching_for_stock', label: 'Searching for Stock' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'waiting_docs', label: 'Waiting for Docs' },
  { value: 'waiting_client', label: 'Waiting on Client' },
  { value: 'finance_approved', label: 'Finance Approved' },
  { value: 'contract_signed', label: 'Contract Signed' },
  { value: 'prepping_delivery', label: 'Prepping Delivery' },
  { value: 'delivered', label: 'Delivered' },
];

// Urgency hierarchy for sorting (lower = more urgent = show first)
export const INTERNAL_STATUS_URGENCY: Record<string, number> = {
  finance_approved: 1,    // Highest - Needs immediate action
  contract_signed: 1,     // Highest - Ready to prep
  prepping_delivery: 2,   // Urgent - Active prep
  searching_for_stock: 3, // Active work
  negotiating: 3,         // Active work
  waiting_docs: 4,        // Waiting state
  waiting_client: 4,      // Waiting state
  new_lead: 5,            // New - needs attention but not urgent
  delivered: 6,           // Complete - lowest priority
};

// Badge styling with distinct colors
export const INTERNAL_STATUS_STYLES: Record<string, string> = {
  new_lead: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  searching_for_stock: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  negotiating: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  waiting_docs: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  waiting_client: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  finance_approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse',
  contract_signed: 'bg-green-600/20 text-green-400 border-green-600/30',
  prepping_delivery: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  delivered: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

// Get urgency level for sorting
export const getInternalStatusUrgency = (status: string | null): number => {
  if (!status) return 5; // Default to new_lead urgency
  return INTERNAL_STATUS_URGENCY[status] ?? 5;
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
    'documents_received',
    'validations_pending',
    'validations_complete',
    'contract_sent',
    'contract_signed',
    'vehicle_selected',
    'vehicle_delivered',
  ];
  return eligibleStatuses.includes(status);
};
