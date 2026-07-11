// Built-in dispatch descriptor map — the single source the StatusEditModal reads
// to show, read-only, exactly WHICH built-in side-effects fire for a finance
// status. It is HAND-MAINTAINED documentation, not the dispatch itself.
//
// KEEP IN SYNC with:
//   • src/hooks/useFinanceApplications.ts  → useUpdateFinanceApplication
//       (notify-* client/staff WhatsApp triggers, EMAIL_ELIGIBLE_STATUSES +
//        STATUS_TEMPLATE_REMAP auto-mailer, NOTIFY_OWNED_STATUSES gate).
//   • supabase/functions/easysocial-tag-sync/index.ts → planForStatus
//       (the hardcoded EasySocial add/remove tag plan per status).
//
// Reflects behaviour AFTER the "Ready To Load" silencing:
// `application_submitted` fires NO client WhatsApp, NO auto-email, and is an
// EasySocial no-op (add:[]/remove:[]).

export interface StatusDispatchInfo {
  /** Client-facing WhatsApp sent by a dedicated notify-* function (undefined = none). */
  clientWhatsapp?: string;
  /** Internal/staff WhatsApp fan-out (NOT the client) (undefined = none). */
  staffWhatsapp?: string;
  /** Auto-email template that dispatches for this status (undefined = none). */
  email?: string;
  /** EasySocial tag NAMES added on apply (empty = none). */
  esAdd: string[];
  /**
   * EasySocial tag NAMES removed on apply, OR the 'MASTER_WIPE' sentinel when the
   * status removes every MASTER_PIPELINE_TAG (see MASTER_PIPELINE_TAGS below).
   */
  esRemove: string[] | 'MASTER_WIPE';
}

// The full pipeline-tag set a 'MASTER_WIPE' status clears (mirror of
// easysocial-tag-sync/index.ts MASTER_PIPELINE_TAGS). Exposed so the editor can
// spell out what "wipes all pipeline tags" means if it wants to.
export const MASTER_PIPELINE_TAGS: string[] = [
  'New Lead',
  'Application Received',
  'App Submitted',
  'Approved - Need Docs',
  'Validations Pending',
  'Vals Done',
  'Bad Credit',
  'Low Income',
  'No Licence',
];

// Per-slug descriptor. Only finance slugs are keyed here (client_* statuses never
// dispatch). A slug absent from this map has no documented built-in behaviour.
const STATUS_DISPATCH_INFO: Record<string, StatusDispatchInfo> = {
  // Intake — client is emailed the "pending / received" template; EasySocial
  // steps New Lead → Application Received.
  pending: {
    email: 'pending',
    esAdd: ['Application Received'],
    esRemove: ['New Lead'],
  },

  // "Ready To Load" (credit-check passed) — FULLY SILENT. No client WhatsApp,
  // no auto-email, EasySocial no-op. (application_submitted is still kept in
  // NOTIFY_OWNED_STATUSES so wa-status-send auto-send stays suppressed too.)
  application_submitted: {
    esAdd: [],
    esRemove: [],
  },

  // Ready to Submit — the ONLY status that now fires the notify-app-submitted
  // client "submission confirmation" WhatsApp (deduped across the submission phase).
  ready_to_submit: {
    clientWhatsapp: 'Submission confirmation (notify-app-submitted)',
    esAdd: ['App Submitted'],
    esRemove: ['New Lead', 'Application Received'],
  },

  sent_to_banks: {
    email: 'sent_to_banks',
    esAdd: ['App Submitted'],
    esRemove: ['New Lead', 'Application Received'],
  },

  revision_submitted: {
    esAdd: ['App Submitted'],
    esRemove: ['New Lead', 'Application Received'],
  },

  // Pre-Approved (Docs Req) — staff/F&I fan-out (notify-pre-approval-internal),
  // NOT the client. Auto-email is REMAPPED to the validations_pending template.
  pre_approved: {
    staffWhatsapp: 'Staff/F&I pre-approval fan-out (NOT the client) — notify-pre-approval-internal',
    email: 'validations_pending (remapped from pre_approved)',
    esAdd: ['Approved - Need Docs'],
    esRemove: ['New Lead', 'Application Received', 'App Submitted'],
  },

  // Legacy alias of pre_approved (email-eligible + same EasySocial plan; not in
  // the editable finance list, kept for accuracy if ever dispatched).
  approved: {
    email: 'approved',
    esAdd: ['Approved - Need Docs'],
    esRemove: ['New Lead', 'Application Received', 'App Submitted'],
  },

  documents_received: {
    email: 'documents_received',
    esAdd: ['Approved - Need Docs'],
    esRemove: ['New Lead', 'Application Received', 'App Submitted'],
  },

  validations_pending: {
    email: 'validations_pending',
    esAdd: ['Validations Pending'],
    esRemove: ['Approved - Need Docs', 'App Submitted', 'Application Received', 'New Lead'],
  },

  // Vals Done cluster — auto-email (where a template exists) + EasySocial master-wipe
  // then add "Vals Done".
  validations_complete: {
    email: 'validations_complete',
    esAdd: ['Vals Done'],
    esRemove: 'MASTER_WIPE',
  },
  vehicle_selected: {
    email: 'vehicle_selected',
    esAdd: ['Vals Done'],
    esRemove: 'MASTER_WIPE',
  },
  contract_sent: {
    email: 'contract_sent',
    esAdd: ['Vals Done'],
    esRemove: 'MASTER_WIPE',
  },
  contract_signed: {
    email: 'contract_signed',
    esAdd: ['Vals Done'],
    esRemove: 'MASTER_WIPE',
  },
  vehicle_delivered: {
    email: 'vehicle_delivered',
    esAdd: ['Vals Done'],
    esRemove: 'MASTER_WIPE',
  },
  finalized: {
    esAdd: ['Vals Done'],
    esRemove: 'MASTER_WIPE',
  },

  // Declines — hard `declined` fires the client "Decline notice" WhatsApp
  // (notify-declined); `declined_conditional` does NOT (email only).
  declined: {
    clientWhatsapp: 'Decline notice (notify-declined)',
    email: 'declined',
    esAdd: ['Application Declined'],
    esRemove: 'MASTER_WIPE',
  },
  declined_conditional: {
    email: 'declined_conditional',
    esAdd: ['Application Declined'],
    esRemove: 'MASTER_WIPE',
  },

  // Blacklisted / Bad Credit — client "Blacklist/bad-credit notice" WhatsApp
  // (notify-blacklisted). No auto-email.
  blacklisted: {
    clientWhatsapp: 'Blacklist/bad-credit notice (notify-blacklisted)',
    esAdd: ['Blacklisted'],
    esRemove: 'MASTER_WIPE',
  },

  // Client Cancelled / Ghosted — client WhatsApp (notify-client-cancelled);
  // EasySocial resets to "New Lead" after a master-wipe.
  client_cancelled: {
    clientWhatsapp: 'Cancellation / ghosted follow-up (notify-client-cancelled)',
    esAdd: ['New Lead'],
    esRemove: 'MASTER_WIPE',
  },

  // Archived — EasySocial master-wipe, adds nothing. No WhatsApp/email.
  archived: {
    esAdd: [],
    esRemove: 'MASTER_WIPE',
  },

  // Needs Revision — no built-in dispatch (no notify-*, not email-eligible, and
  // no EasySocial plan → planForStatus default of add:[]/remove:[]).
  needs_revision: {
    esAdd: [],
    esRemove: [],
  },
};

/**
 * Returns the documented built-in dispatch descriptor for a finance status slug,
 * or `null` when the slug has no documented behaviour (client_* statuses, or an
 * unmapped slug). Read-only — this drives the editor's "what fires" panel.
 */
export function getStatusDispatchInfo(slug: string): StatusDispatchInfo | null {
  return STATUS_DISPATCH_INFO[slug] ?? null;
}
