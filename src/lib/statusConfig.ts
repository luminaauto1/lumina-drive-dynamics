// Strategic status labels that don't reveal approval status
// This prevents clients from shopping around

export const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'validations_pending', label: 'Validations Pending' },
  { value: 'approved', label: 'Budget Confirmed' },
  { value: 'declined', label: 'Declined' },
];

// What the USER sees - strategic "hook" messaging
export const USER_STATUS_LABELS: Record<string, string> = {
  pending: 'Application Received - Analyzing Profile',
  validations_pending: 'Validation Documents Required',
  approved: 'Budget Confirmed - Preparing Vehicle Options',
  declined: 'Application Unsuccessful',
};

// Badge styling
export const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  validations_pending: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  declined: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// Admin labels (internal view)
export const ADMIN_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  validations_pending: 'Validations Pending',
  approved: 'Budget Confirmed',
  declined: 'Declined',
};

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
    case 'validations_pending':
      return `Hi ${name}, great news! Your profile checks out. We just need to validate your documents to confirm the final budget. Please send us the following:\n\n• 3 months bank statements\n• Copy of ID\n• Valid Driver's License\n• 3 months payslips\n\nReply to this message with your documents.`;
    case 'approved':
      return `Great news ${name}! Your budget is confirmed. We have selected ${matchedVehiclesCount || 'several'} vehicle${matchedVehiclesCount === 1 ? '' : 's'} that match your profile perfectly.\n\nView your exclusive options here: ${dashboardUrl}`;
    case 'declined':
      return `Hi ${name}, unfortunately we were unable to approve your finance application at this time. Please feel free to contact us to discuss alternative options or reapply in the future.`;
    default:
      return `Hi ${name}, regarding your finance application...`;
  }
};
