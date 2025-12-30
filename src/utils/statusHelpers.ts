// Strategic status labels for client-facing display
// These labels prevent clients from seeing "Approved" directly

/**
 * Get the client-facing status label
 * This hides the actual approval status to keep clients engaged
 */
export const getClientStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'Application Received',
    validations_pending: 'Validation Documents Pending',
    approved: 'Budget Confirmed',
    declined: 'Application Unsuccessful',
  };
  
  return labels[status] || status;
};

/**
 * Get the full descriptive status for user dashboard
 */
export const getClientStatusDescription = (status: string): string => {
  const descriptions: Record<string, string> = {
    pending: 'Application Received - Analyzing Profile',
    validations_pending: 'Validation Documents Required',
    approved: 'Budget Confirmed - Preparing Vehicle Options',
    declined: 'Application Unsuccessful',
  };
  
  return descriptions[status] || status;
};

/**
 * Get badge styling for status
 */
export const getStatusBadgeStyle = (status: string): string => {
  const styles: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    validations_pending: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    declined: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  
  return styles[status] || styles.pending;
};
