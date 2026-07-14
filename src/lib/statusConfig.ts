// 9-Step Finance Flow Status Configuration
// Strategic status labels that guide the client through the finance journey

export const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'application_submitted', label: 'Ready To Load' },
  { value: 'ready_to_submit', label: 'Ready to Submit' },
  { value: 'sent_to_banks', label: 'Sent to banks' },
  { value: 'pre_approved', label: 'Pre-Approved (Docs Req)' },
  { value: 'pre_approved_flexi', label: 'Pre-Approved Flexi' },
  { value: 'documents_received', label: 'Docs Received' },
  { value: 'validations_pending', label: 'Validations Submitted' },
  { value: 'validations_complete', label: 'Validations Complete' },
  { value: 'validated_flexi', label: 'Validated Flexi' },
  { value: 'contract_sent', label: 'Contract Sent' },
  { value: 'contract_signed', label: 'Contract Signed' },
  { value: 'vehicle_delivered', label: 'Vehicle Delivered' },
  { value: 'declined', label: 'Declined' },
  { value: 'declined_conditional', label: 'Conditionally Declined' },
  { value: 'blacklisted', label: 'Blacklisted / Bad Credit / Judgements' },
  { value: 'vehicle_selected', label: 'Vehicle Selected' },
  { value: 'needs_revision', label: 'Needs Revision' },
  { value: 'revision_submitted', label: 'Revision Submitted' },
  { value: 'finalized', label: 'Finalized / Delivered' },
  { value: 'archived', label: 'Archived' },
  { value: 'client_cancelled', label: 'Client Cancelled / Ghosted' },
];

// Step order for progress tracking (0-indexed)
export const STATUS_STEP_ORDER: Record<string, number> = {
  pending: 0,
  application_submitted: 1,
  ready_to_submit: 1,
  sent_to_banks: 2,
  pre_approved: 2,
  pre_approved_flexi: 2, // Flexi (non-traditional) track mirrors pre_approved
  documents_received: 3,
  validations_pending: 4,
  validations_complete: 5,
  validated_flexi: 5, // Flexi track mirrors validations_complete
  contract_sent: 6,
  contract_signed: 7,
  vehicle_delivered: 8,
  declined: -1, // Exception state
  declined_conditional: -1, // Exception state — soft decline (deposit/condition required)
  blacklisted: -1, // Exception state — mirrors declined
  vehicle_selected: 3, // Parallel to documents_received
  approved: 2, // Legacy - maps to pre_approved
  finalized: 8, // Same as delivered
  needs_revision: 0, // Sent back for revision
  revision_submitted: 1, // Re-submitted after revision
  client_cancelled: -1, // Exception state — client cancelled / ghosted
};

// What the USER sees - strategic "hook" messaging
export const USER_STATUS_LABELS: Record<string, string> = {
  pending: 'Application Received - Analyzing Profile',
  application_submitted: 'Application Submitted - Under Review',
  ready_to_submit: 'Application Ready - Preparing Submission',
  sent_to_banks: 'Sent to Banks - Awaiting Response',
  pre_approved: 'Pre-Approved - Docs Required',
  pre_approved_flexi: 'Pre-Approved (Flexi Finance) - Docs Required',
  documents_received: 'Documents Received - Verifying',
  validations_pending: 'Submitted to Bank - Awaiting Response',
  validations_complete: 'Bank Approved - Preparing Contract',
  validated_flexi: 'Approved (Flexi Finance) - Preparing Next Steps',
  contract_sent: 'Contract Sent - Awaiting Signature',
  contract_signed: 'Contract Signed - Preparing Delivery',
  vehicle_delivered: '🎉 Vehicle Delivered - Congratulations!',
  declined: 'Application Unsuccessful',
  declined_conditional: 'Conditionally Declined',
  blacklisted: 'Application Unsuccessful',
  vehicle_selected: 'Vehicle Reserved - Preparing Contract',
  approved: 'Approved - Select Vehicle',
  finalized: '🎉 Deal Complete!',
  draft: 'Draft - Not Submitted',
  archived: 'Archived',
  needs_revision: '⚠️ Revision Required - Please Update Your Details',
  revision_submitted: 'Revision Submitted - Under Review',
  client_cancelled: 'Application Closed',
};

// Badge styling — DARK theme (obsidian). Brightened for legibility: text on the
// -300 tier, bg /15, border /40. `pending` is an ACTIVE state → amber, not gray;
// gray is reserved for truly-closed states (draft / archived / client_cancelled).
// No animate-pulse (distracting in a dense table).
export const STATUS_STYLES: Record<string, string> = {
  pending:               'bg-amber-500/15 text-amber-300 border-amber-500/40',
  application_submitted: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
  ready_to_submit:       'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  sent_to_banks:         'bg-sky-500/15 text-sky-300 border-sky-500/40',
  pre_approved:          'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  pre_approved_flexi:    'bg-teal-500/15 text-teal-300 border-teal-500/40',
  documents_received:    'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  validations_pending:   'bg-orange-500/15 text-orange-300 border-orange-500/40',
  validations_complete:  'bg-green-500/15 text-green-300 border-green-500/40',
  validated_flexi:       'bg-lime-500/15 text-lime-300 border-lime-500/40',
  contract_sent:         'bg-violet-500/15 text-violet-300 border-violet-500/40',
  contract_signed:       'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  vehicle_delivered:     'bg-amber-400/15 text-amber-300 border-amber-400/40',
  declined:              'bg-red-500/15 text-red-300 border-red-500/40',
  declined_conditional:  'bg-rose-500/15 text-rose-300 border-rose-500/40',
  blacklisted:           'bg-red-500/15 text-red-300 border-red-500/40',
  vehicle_selected:      'bg-violet-500/15 text-violet-300 border-violet-500/40',
  approved:              'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  finalized:             'bg-amber-400/15 text-amber-300 border-amber-400/40',
  draft:                 'bg-gray-500/12 text-gray-400 border-gray-500/25',
  archived:              'bg-gray-500/12 text-gray-400 border-gray-500/25',
  needs_revision:        'bg-pink-500/15 text-pink-300 border-pink-500/40',
  revision_submitted:    'bg-indigo-500/15 text-indigo-300 border-indigo-500/40',
  client_cancelled:      'bg-gray-500/12 text-gray-400 border-gray-500/25',
};

// Badge styling — LIGHT (admin paper) theme. Same status keys, ZTC-style soft bg
// + dark text so each status stays legible on white. Resolved per theme by
// `statusBadgeClass(status, theme)`; the public client dashboard never uses this.
export const STATUS_STYLES_LIGHT: Record<string, string> = {
  pending:               'bg-amber-100 text-amber-800 border-amber-300',
  application_submitted: 'bg-blue-100 text-blue-800 border-blue-300',
  ready_to_submit:       'bg-emerald-100 text-emerald-800 border-emerald-300',
  sent_to_banks:         'bg-sky-100 text-sky-800 border-sky-300',
  pre_approved:          'bg-emerald-100 text-emerald-800 border-emerald-300',
  pre_approved_flexi:    'bg-teal-100 text-teal-800 border-teal-300',
  documents_received:    'bg-cyan-100 text-cyan-800 border-cyan-300',
  validations_pending:   'bg-orange-100 text-orange-800 border-orange-300',
  validations_complete:  'bg-green-100 text-green-800 border-green-300',
  validated_flexi:       'bg-lime-100 text-lime-800 border-lime-300',
  contract_sent:         'bg-violet-100 text-violet-800 border-violet-300',
  contract_signed:       'bg-emerald-100 text-emerald-800 border-emerald-300',
  vehicle_delivered:     'bg-amber-100 text-amber-800 border-amber-300',
  declined:              'bg-red-100 text-red-800 border-red-300',
  declined_conditional:  'bg-rose-100 text-rose-800 border-rose-300',
  blacklisted:           'bg-red-100 text-red-800 border-red-300',
  vehicle_selected:      'bg-violet-100 text-violet-800 border-violet-300',
  approved:              'bg-emerald-100 text-emerald-800 border-emerald-300',
  finalized:             'bg-amber-100 text-amber-800 border-amber-300',
  draft:                 'bg-gray-100 text-gray-600 border-gray-300',
  archived:              'bg-gray-100 text-gray-600 border-gray-300',
  needs_revision:        'bg-pink-100 text-pink-800 border-pink-300',
  revision_submitted:    'bg-indigo-100 text-indigo-800 border-indigo-300',
  client_cancelled:      'bg-gray-100 text-gray-600 border-gray-300',
};

/** Resolve a status badge class for the active admin theme. Falls back to the
 *  dark map when a key is missing from the light map. Pure presentation. */
export const statusBadgeClass = (status: string, theme: 'light' | 'dark' = 'dark'): string =>
  (theme === 'light' ? STATUS_STYLES_LIGHT[status] : STATUS_STYLES[status]) || STATUS_STYLES[status] || '';

// Admin labels (internal view)
export const ADMIN_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  application_submitted: 'Ready To Load',
  ready_to_submit: 'Ready to Submit',
  sent_to_banks: 'Sent to banks',
  pre_approved: 'Pre-Approved - Docs Required',
  pre_approved_flexi: 'Pre-Approved Flexi',
  documents_received: 'Docs Received',
  validations_pending: 'Validations Submitted',
  validations_complete: 'Validations Complete',
  validated_flexi: 'Validated Flexi',
  contract_sent: 'Contract Sent',
  contract_signed: 'Contract Signed',
  vehicle_delivered: '🎉 Delivered',
  declined: 'Declined',
  declined_conditional: 'Conditionally Declined',
  blacklisted: 'Blacklisted / Bad Credit / Judgements',
  vehicle_selected: 'Vehicle Selected',
  approved: 'Approved - Select Vehicle',
  finalized: 'Finalized',
  draft: 'Draft',
  archived: 'Archived',
  needs_revision: '⚠️ Needs Revision',
  revision_submitted: 'Revision Submitted',
  client_cancelled: 'Client Cancelled / Ghosted',
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

// Interpolate the admin-editable placeholders into a custom WhatsApp body.
// Supports {name} / {{name}} / {{clientName}} (client first name) and
// {count} / {{count}} (matched-vehicle count) so the editable message can mirror
// the built-in copy. Unknown placeholders are left untouched.
export const renderWhatsAppTemplate = (
  body: string,
  name: string,
  matchedVehiclesCount?: number
): string =>
  body
    .replace(/\{\{?\s*(name|clientName)\s*\}?\}/gi, name)
    .replace(/\{\{?\s*count\s*\}?\}/gi, String(matchedVehiclesCount ?? ''));

// Strategic WhatsApp messages - secretive tone.
// `customBody` (when non-blank) is the admin-editable override from
// status_overrides.whatsapp_message; blank/undefined falls back to the built-in
// copy below, so an empty override = current behaviour.
export const getWhatsAppMessage = (
  status: string,
  name: string,
  matchedVehiclesCount?: number,
  customBody?: string | null
): string => {
  const dashboardUrl = 'https://luminaauto.co.za/dashboard';

  if (customBody && customBody.trim()) {
    return renderWhatsAppTemplate(customBody, name, matchedVehiclesCount);
  }

  switch (status) {
    case 'pending':
      return `Hi ${name}, we have received your finance application and are currently analyzing your profile. We will be in touch shortly with an update.`;
    case 'application_submitted':
      return `Hi ${name}, thank you for submitting your finance application. Our team is reviewing your details and will be in touch soon.`;
    case 'pre_approved':
      return `Great news ${name}! 🎉 You've been pre-approved! To proceed, we need you to upload the following documents:\n\n• ID Card\n• Driver's License\n• Latest 3 Months Payslips\n• Latest 3 Months Bank Statements\n\nPlease upload them here: ${dashboardUrl}`;
    case 'pre_approved_flexi':
      return `Great news ${name}! 🎉 You've been pre-approved through our flexible finance partner! To proceed, we need you to send us the following documents:\n\n• ID Card\n• Driver's License\n• Latest 3 Months Payslips\n• Latest 3 Months Bank Statements\n\nPlease upload them here: ${dashboardUrl}`;
    case 'validated_flexi':
      return `Excellent news ${name}! 🎉 Your flexible finance application has been approved and validated! Our team will contact you shortly with the next steps.`;
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
    case 'declined_conditional':
      return `Hi ${name}, your finance application can be approved on condition — typically a larger deposit or additional security. Our F&I team will reach out shortly to discuss your options.`;
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
    'pre_approved_flexi',
    'validated_flexi',
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
