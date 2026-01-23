// 9-Step Finance Flow Status Configuration
// Strategic status labels that guide the client through the finance journey

export const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'application_submitted', label: 'Application Submitted' },
  { value: 'pre_approved', label: 'Pre-Approved (Docs Req)' },
  { value: 'documents_received', label: 'Docs Received' },
  { value: 'validations_pending', label: 'Validations Submitted' },
  { value: 'validations_complete', label: 'Validations Complete' },
  { value: 'contract_sent', label: 'Contract Sent' },
  { value: 'contract_signed', label: 'Contract Signed' },
  { value: 'vehicle_delivered', label: 'Vehicle Delivered' },
  { value: 'declined', label: 'Declined' },
  { value: 'vehicle_selected', label: 'Vehicle Selected' },
];

// Step order for progress tracking (0-indexed)
export const STATUS_STEP_ORDER: Record<string, number> = {
  pending: 0,
  application_submitted: 1,
  pre_approved: 2,
  documents_received: 3,
  validations_pending: 4,
  validations_complete: 5,
  contract_sent: 6,
  contract_signed: 7,
  vehicle_delivered: 8,
  declined: -1, // Exception state
  vehicle_selected: 3, // Parallel to documents_received
  approved: 2, // Legacy - maps to pre_approved
  finalized: 8, // Same as delivered
};

// What the USER sees - strategic "hook" messaging
export const USER_STATUS_LABELS: Record<string, string> = {
  pending: 'Application Received - Analyzing Profile',
  application_submitted: 'Application Submitted - Under Review',
  pre_approved: 'Pre-Approved! Please Upload Documents',
  documents_received: 'Documents Received - Verifying',
  validations_pending: 'Submitted to Bank - Awaiting Response',
  validations_complete: 'Bank Approved - Preparing Contract',
  contract_sent: 'Contract Sent - Awaiting Signature',
  contract_signed: 'Contract Signed - Preparing Delivery',
  vehicle_delivered: '🎉 Vehicle Delivered - Congratulations!',
  declined: 'Application Unsuccessful',
  vehicle_selected: 'Vehicle Reserved - Preparing Contract',
  approved: 'Budget Confirmed - Preparing Vehicle Options',
  finalized: '🎉 Deal Complete!',
  draft: 'Draft - Not Submitted',
  archived: 'Archived',
};

// Badge styling with distinct colors for each step
export const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  application_submitted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pre_approved: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse',
  documents_received: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  validations_pending: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  validations_complete: 'bg-green-500/20 text-green-400 border-green-500/30',
  contract_sent: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  contract_signed: 'bg-emerald-600/20 text-emerald-500 border-emerald-600/30',
  vehicle_delivered: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  declined: 'bg-red-500/20 text-red-400 border-red-500/30',
  vehicle_selected: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  finalized: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  archived: 'bg-gray-600/20 text-gray-500 border-gray-600/30',
};

// Admin labels (internal view)
export const ADMIN_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  application_submitted: 'App Submitted',
  pre_approved: 'Pre-Approved (Docs Req)',
  documents_received: 'Docs Received',
  validations_pending: 'Validations Submitted',
  validations_complete: 'Validations Complete',
  contract_sent: 'Contract Sent',
  contract_signed: 'Contract Signed',
  vehicle_delivered: '🎉 Delivered',
  declined: 'Declined',
  vehicle_selected: 'Vehicle Selected',
  approved: 'Budget Confirmed',
  finalized: 'Finalized',
  draft: 'Draft',
  archived: 'Archived',
};

// Steps for the visual stepper component
export const FINANCE_STEPS = [
  { key: 'pending', label: 'Received', shortLabel: '1' },
  { key: 'application_submitted', label: 'Submitted', shortLabel: '2' },
  { key: 'pre_approved', label: 'Pre-Approved', shortLabel: '3' },
  { key: 'documents_received', label: 'Docs Received', shortLabel: '4' },
  { key: 'validations_pending', label: 'At Bank', shortLabel: '5' },
  { key: 'validations_complete', label: 'Approved', shortLabel: '6' },
  { key: 'contract_sent', label: 'Contract Sent', shortLabel: '7' },
  { key: 'contract_signed', label: 'Signed', shortLabel: '8' },
  { key: 'vehicle_delivered', label: 'Delivered', shortLabel: '9' },
];

// Strategic WhatsApp messages - secretive tone
export const getWhatsAppMessage = (
  status: string,
  name: string,
  matchedVehiclesCount?: number
): string => {
  const dashboardUrl = 'https://lumina-auto.lovable.app/dashboard';
  
  switch (status) {
    case 'pending':
      return `Hi ${name}, we have received your finance application and are currently analyzing your profile. We will be in touch shortly with an update.`;
    case 'application_submitted':
      return `Hi ${name}, thank you for submitting your finance application. Our team is reviewing your details and will be in touch soon.`;
    case 'pre_approved':
      return `Great news ${name}! 🎉 You've been pre-approved! To proceed, we need you to upload the following documents:\n\n• ID Card\n• Driver's License\n• Latest 3 Months Payslips\n• Latest 3 Months Bank Statements\n\nPlease upload them here: ${dashboardUrl}`;
    case 'documents_received':
      return `Hi ${name}, we have received your documents and are now verifying them. We will update you shortly.`;
    case 'validations_pending':
      return `Hi ${name}, your application has been submitted to the bank for final approval. We are awaiting their response and will update you as soon as we hear back.`;
    case 'validations_complete':
      return `Excellent news ${name}! 🎉 The bank has approved your finance application! We are now preparing your contract and will send it to you shortly.`;
    case 'contract_sent':
      return `Hi ${name}, your contract has been sent! Please review and sign it at your earliest convenience. Contact us if you have any questions.`;
    case 'contract_signed':
      return `Hi ${name}, thank you for signing the contract! We are now preparing your vehicle for delivery. We'll be in touch with delivery details soon.`;
    case 'vehicle_delivered':
      return `Congratulations ${name}! 🎉🚗 Your vehicle has been delivered! Thank you for choosing Lumina Auto. We hope you enjoy your new car!`;
    case 'declined':
      return `Hi ${name}, unfortunately we were unable to approve your finance application at this time. Please feel free to contact us to discuss alternative options or reapply in the future.`;
    case 'vehicle_selected':
      return `Hi ${name}, great choice! Your vehicle has been reserved. We are now preparing the contract and will be in touch shortly.`;
    case 'approved':
      return `Great news ${name}! Your budget is confirmed. We have selected ${matchedVehiclesCount || 'several'} vehicle${matchedVehiclesCount === 1 ? '' : 's'} that match your profile perfectly.\n\nView your exclusive options here: ${dashboardUrl}`;
    default:
      return `Hi ${name}, regarding your finance application...`;
  }
};

// Check if a status qualifies for Podium/Finalize actions
export const canShowDealActions = (status: string): boolean => {
  const eligibleStatuses = [
    'pre_approved',
    'documents_received',
    'validations_pending',
    'validations_complete',
    'contract_sent',
    'contract_signed',
    'vehicle_selected',
    'approved',
  ];
  return eligibleStatuses.includes(status);
};
