// Central catalogue of configurable app "sections" (areas of the admin) and the
// default access each staff role gets. The per-role allow-list is stored in the
// public.role_section_access table and edited by admins under Settings → Team →
// Roles & Permissions. The sidebar and route guards read the effective list.
//
// IMPORTANT: this controls NAVIGATION / page access only. Row-Level Security on
// every table remains the real security floor — granting a role a section it has
// no RLS access to just yields an empty/locked page, never a data leak.
// Super admins (the `admin` role) always have full access and are NOT stored here.

// DB role keys (the `admin` super-role is handled separately as full access).
export type ConfigurableRole = 'sales_agent' | 'f_and_i' | 'senior_f_and_i' | 'accountant';

export interface AppSection {
  key: string;
  label: string;
  description: string;
  /** Route path prefixes this section governs (exact match or `${path}/...`). */
  paths: string[];
  /** Primary landing path used when redirecting a user into this section. */
  home: string;
  /**
   * Match this section's paths EXACTLY only (no sub-path prefixing). Used by the
   * dashboard section — its '/admin' path would otherwise prefix-match every
   * admin route and leak nav visibility for non-section-gated pages.
   */
  exact?: boolean;
}

// Every section an admin can grant/revoke per role. Order = display order, and
// landingPathForSections prefers earlier entries — dashboard first makes the
// Command Center the staff landing page.
export const APP_SECTIONS: AppSection[] = [
  { key: 'dashboard',     label: 'Dashboard',        description: 'Command Center — the shared staff landing dashboard', paths: ['/admin'], home: '/admin', exact: true },
  { key: 'finance',       label: 'Finance',          description: 'Finance applications & deal room', paths: ['/admin/finance'], home: '/admin/finance' },
  { key: 'pipeline_v2',   label: 'Pipeline',         description: 'New pipeline view of finance applications (same data, fires same notifications)', paths: ['/admin/pipeline-v2'], home: '/admin/pipeline-v2' },
  { key: 'crm',           label: 'CRM / Leads',      description: 'Pipeline, leads and client management', paths: ['/admin/crm'], home: '/admin/crm' },
  { key: 'leads_cycle',   label: 'Leads Cycle',      description: 'TikTok lead intake stats (volume + blacklist split)', paths: ['/admin/lead-cycle'], home: '/admin/lead-cycle' },
  { key: 'inventory',     label: 'Inventory',        description: 'Active stock', paths: ['/admin/inventory'], home: '/admin/inventory' },
  { key: 'quotes',        label: 'Quote Generator',  description: 'Build customer quotes', paths: ['/admin/quotes'], home: '/admin/quotes' },
  { key: 'documents',     label: 'Documents Hub',    description: 'Document management', paths: ['/admin/documents'], home: '/admin/documents' },
  { key: 'juristic',      label: 'Juristic Capture', description: 'Company/juristic intake', paths: ['/admin/juristic'], home: '/admin/juristic' },
  { key: 'extra_incomes', label: 'Extra Incomes',    description: 'Additional income capture', paths: ['/admin/extra-incomes'], home: '/admin/extra-incomes' },
  { key: 'network',       label: 'Trade Network',    description: 'Dealer trade network', paths: ['/admin/network'], home: '/admin/network' },
  { key: 'referrals',     label: 'Referrals',        description: 'Referral tracking & payouts', paths: ['/admin/referrals'], home: '/admin/referrals' },
  // Deal Ledger folded into Deal Desk. Section retained so existing role grants
  // keep working, but its home now lands on the merged Deal Desk page.
  { key: 'deal_ledger',   label: 'Deal Ledger',      description: 'Finalised deals / aftersales ledger (now inside Deal Desk)', paths: ['/admin/aftersales'], home: '/admin/deal-desk' },
  { key: 'reports',       label: 'Reports',          description: 'Accounting & VAT, lead analytics, payouts', paths: ['/admin/reports'], home: '/admin/reports' },
  { key: 'vendors',       label: 'Vendors',          description: 'Suppliers & finance houses', paths: ['/admin/vendors'], home: '/admin/vendors' },
  { key: 'invoices',      label: 'Invoice Creator',  description: 'Standalone invoice builder', paths: ['/admin/invoices'], home: '/admin/invoices' },
  { key: 'analytics',     label: 'Analytics',        description: 'Business analytics dashboards', paths: ['/admin/analytics'], home: '/admin/analytics' },
  { key: 'export',        label: 'Export CSV',       description: 'Custom finance-application CSV export builder', paths: ['/admin/export'], home: '/admin/export' },
  { key: 'deal_desk',     label: 'Deal Desk',        description: 'Back-office cost sheet, delivery & Natis, payables (additive on finalized deals)', paths: ['/admin/deal-desk'], home: '/admin/deal-desk' },
  { key: 'chat_control',  label: 'Reply Suggester',  description: 'Offline reply brain: paste a client question, get a suggested answer to copy — no live chat connection', paths: ['/admin/chat-control'], home: '/admin/chat-control' },
];

export const SECTION_KEYS = APP_SECTIONS.map((s) => s.key);

// Defaults per role — mirror the access the app shipped with, so nothing changes
// until an admin edits the matrix. Admin (super) is implicitly "all".
export const DEFAULT_ROLE_SECTIONS: Record<ConfigurableRole, string[]> = {
  sales_agent:    ['dashboard', 'inventory', 'crm', 'finance', 'quotes'],
  f_and_i:        ['dashboard', 'finance'],
  senior_f_and_i: ['dashboard', 'finance', 'pipeline_v2', 'crm', 'quotes', 'deal_desk'],
  accountant:     ['dashboard', 'reports', 'vendors', 'invoices'],
};

export const ROLE_LABELS: Record<ConfigurableRole, string> = {
  sales_agent: 'Salesperson',
  f_and_i: 'F&I',
  senior_f_and_i: 'Senior F&I',
  accountant: 'Accountant',
};

/** The section key that governs a given admin route path (or null if not section-gated). */
export const sectionForPath = (pathname: string): string | null => {
  // Longest-prefix wins so e.g. /admin/finance/create resolves to "finance".
  // `exact` sections (dashboard's '/admin') only ever match their path verbatim.
  let best: { key: string; len: number } | null = null;
  for (const s of APP_SECTIONS) {
    for (const p of s.paths) {
      const matches = s.exact ? pathname === p : pathname === p || pathname.startsWith(p + '/');
      if (matches) {
        if (!best || p.length > best.len) best = { key: s.key, len: p.length };
      }
    }
  }
  return best?.key ?? null;
};

/** First reachable path for a set of allowed section keys (for post-login / redirect landing). */
export const landingPathForSections = (allowed: Set<string> | string[]): string => {
  const set = allowed instanceof Set ? allowed : new Set(allowed);
  for (const s of APP_SECTIONS) if (set.has(s.key)) return s.home;
  return '/admin/finance';
};
