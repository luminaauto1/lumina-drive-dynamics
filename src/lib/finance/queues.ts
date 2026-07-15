// Declarative work-queue definitions for the Finance page (redesign P2).
// One generic QueuePanel renders each of these — a queue per WAITING stage,
// with the exact next action(s) as one-click buttons. Every set_status action
// executes through AdminFinance's requestFinanceStatusChange, i.e. the SAME
// interceptor chain as the inline dropdown (bank-ref modal, comment gate,
// hook side-effects) — no new write paths, no new client sends.
//
// Status slugs and labels are NEVER renamed here (owner rule): queue titles
// use the existing labels; grouping copy ("Docs Chase") is UI-only.

import { isContactFresh } from './shared';

const isContactStale = (a: any) => !isContactFresh(a);

export interface QueueAction {
  key: string;
  label: string;
  /** icon key resolved to a lucide icon inside QueuePanel */
  icon: 'check' | 'bank' | 'approve' | 'decline' | 'docs_in' | 'validated' | 'contacted' | 'contract';
  kind: 'set_status' | 'contacted';
  targetStatus?: string;
  className?: string;
  title?: string;
  /** optionally hide the action for some rows */
  show?: (app: any) => boolean;
}

export interface QueueDef {
  key: string;
  title: string;
  hint: string;
  icon: 'scan' | 'load' | 'package' | 'bank' | 'chase' | 'docs' | 'validate' | 'contract' | 'flexi' | 'stalled';
  /** tailwind classes for the header accent */
  accent: string;
  /** membership among ACTIVE apps (archive rule applied by the section) */
  match: (app: any) => boolean;
  /** Status whose SLA shows in the header badge — resolved at render time via
   *  slaHoursFor so owner overrides apply live; breaches land in Stalled. */
  slaStatus: string | null;
  /** stale-first ordering: bigger = more urgent (default: age in status) */
  urgency?: (app: any) => number;
  actions: QueueAction[];
  /** show the ✓ contacted / ⚠ never contacted line (docs chase) */
  showContactStatus?: boolean;
  /** show the manual docs checklist chip */
  showDocsChecklist?: boolean;
  /** render the credit-scan button on each row */
  showCreditScan?: boolean;
}

const active = (a: any) => a?.is_archived !== true;

export const FINANCE_QUEUES: QueueDef[] = [
  {
    key: 'triage',
    title: 'Triage — Credit Check Not Run',
    hint: 'New files with no credit scan yet',
    icon: 'scan',
    accent: 'text-amber-400',
    match: (a) => active(a) && a.status === 'pending' && !a.credit_check_status,
    slaStatus: 'pending',
    actions: [],
    showCreditScan: true,
  },
  {
    key: 'ready_to_load',
    title: 'Ready To Load',
    hint: 'Credit passed — load and mark Ready to Submit',
    icon: 'load',
    accent: 'text-indigo-400',
    match: (a) => active(a) && a.status === 'application_submitted',
    slaStatus: 'application_submitted',
    actions: [
      { key: 'rts', label: 'Ready to Submit', icon: 'check', kind: 'set_status', targetStatus: 'ready_to_submit', className: 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10' },
    ],
  },
  {
    key: 'ready_to_submit',
    title: 'Ready to Submit',
    hint: 'Packaged — submit to the banks',
    icon: 'package',
    accent: 'text-emerald-300',
    match: (a) => active(a) && a.status === 'ready_to_submit',
    slaStatus: 'ready_to_submit',
    actions: [
      { key: 'stb', label: 'Sent to Banks', icon: 'bank', kind: 'set_status', targetStatus: 'sent_to_banks', className: 'border-sky-500/40 text-sky-400 hover:bg-sky-500/10' },
    ],
  },
  {
    key: 'sent_to_banks',
    title: 'Sent to Banks — Awaiting Feedback',
    hint: 'Record the bank outcome',
    icon: 'bank',
    accent: 'text-sky-400',
    match: (a) => active(a) && a.status === 'sent_to_banks',
    slaStatus: 'sent_to_banks',
    actions: [
      { key: 'pre', label: 'Pre-Approved', icon: 'approve', kind: 'set_status', targetStatus: 'pre_approved', className: 'border-teal-500/40 text-teal-400 hover:bg-teal-500/10' },
      { key: 'dec', label: 'Declined', icon: 'decline', kind: 'set_status', targetStatus: 'declined', className: 'border-red-500/40 text-red-400 hover:bg-red-500/10', title: 'Hard decline — fires the standard declined flow' },
    ],
  },
  {
    key: 'docs_chase',
    title: 'Docs Chase — Pre-Approvals',
    hint: 'Chase documents; tick what arrives on WhatsApp',
    icon: 'chase',
    accent: 'text-teal-400',
    match: (a) => active(a) && (a.status === 'pre_approved' || a.status === 'pre_approved_flexi') && !!a.phone,
    slaStatus: 'pre_approved',
    // Never-contacted / stale-contact rows first, then oldest contact first.
    urgency: (a) => (isContactStale(a) ? Number.MAX_SAFE_INTEGER : -new Date(a.docs_contacted_at || 0).getTime()),
    actions: [
      { key: 'contacted', label: 'Contacted', icon: 'contacted', kind: 'contacted', title: 'Mark contacted (call / WhatsApp — however you reached them)' },
      { key: 'docs_in', label: 'Docs in', icon: 'docs_in', kind: 'set_status', targetStatus: 'documents_received', className: 'border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10', title: 'Documents received — move to Docs Received' },
    ],
    showContactStatus: true,
    showDocsChecklist: true,
  },
  {
    key: 'docs_received',
    title: 'Docs Received',
    hint: 'Docs in — submit validations',
    icon: 'docs',
    accent: 'text-cyan-400',
    match: (a) => active(a) && a.status === 'documents_received',
    slaStatus: 'documents_received',
    actions: [
      { key: 'val', label: 'Validations Submitted', icon: 'validated', kind: 'set_status', targetStatus: 'validations_pending', className: 'border-blue-500/40 text-blue-400 hover:bg-blue-500/10' },
    ],
    showDocsChecklist: true,
  },
  {
    key: 'validations',
    title: 'Validations Submitted',
    hint: 'Awaiting validation results',
    icon: 'validate',
    accent: 'text-blue-400',
    match: (a) => active(a) && a.status === 'validations_pending',
    slaStatus: 'validations_pending',
    actions: [
      { key: 'vc', label: 'Validations Complete', icon: 'check', kind: 'set_status', targetStatus: 'validations_complete', className: 'border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10' },
    ],
  },
  {
    key: 'contracts',
    title: 'Contract Sent',
    hint: 'Awaiting the signed contract',
    icon: 'contract',
    accent: 'text-violet-400',
    match: (a) => active(a) && a.status === 'contract_sent',
    slaStatus: 'contract_sent',
    actions: [
      { key: 'signed', label: 'Contract Signed', icon: 'contract', kind: 'set_status', targetStatus: 'contract_signed', className: 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10' },
    ],
  },
  {
    key: 'flexi',
    title: 'Flexi Deals — Non-Traditional Finance',
    hint: 'The Flexi partner track',
    icon: 'flexi',
    accent: 'text-lime-400',
    match: (a) => active(a) && (a.status === 'pre_approved_flexi' || a.status === 'vals_submitted_flexi' || a.status === 'validated_flexi'),
    slaStatus: null,
    // Earliest stage first: pre-approved → vals submitted → validated.
    urgency: (a) => (a.status === 'pre_approved_flexi' ? 2 : a.status === 'vals_submitted_flexi' ? 1 : 0),
    actions: [
      { key: 'vsf', label: 'Vals Submitted', icon: 'check', kind: 'set_status', targetStatus: 'vals_submitted_flexi', className: 'border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10', title: 'Move to Flexi Vals Submitted', show: (a) => a.status === 'pre_approved_flexi' },
      { key: 'vf', label: 'Validated', icon: 'validated', kind: 'set_status', targetStatus: 'validated_flexi', className: 'border-lime-500/40 text-lime-400 hover:bg-lime-500/10', title: 'Move to Validated Flexi', show: (a) => a.status === 'pre_approved_flexi' || a.status === 'vals_submitted_flexi' },
    ],
  },
];
