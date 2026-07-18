/**
 * Centralized admin route paths.
 *
 * Single source of truth for `/admin/*` URLs so links can't go stale when a
 * route moves. Mirrors the `<Route>` table in `src/App.tsx`. Static paths live
 * in `ADMIN_ROUTES`; parameterized paths have builder helpers below.
 */
export const ADMIN_ROUTES = {
  // Main
  dashboard: "/admin",
  crm: "/admin/crm",
  inventory: "/admin/inventory",
  contacts: "/admin/contacts",
  pipelineV2: "/admin/pipeline-v2",

  // Docs & Sales
  quotes: "/admin/quotes",
  quoteBuilder: "/admin/quote",
  otp: "/admin/otp",
  documents: "/admin/documents",
  juristic: "/admin/juristic",

  // Money
  finance: "/admin/finance",
  financeCreate: "/admin/finance/create",
  dealDesk: "/admin/deal-desk",
  invoices: "/admin/invoices",
  aftersales: "/admin/aftersales",
  extraIncomes: "/admin/extra-incomes",
  partnerPayout: "/admin/reports/partner-payout",

  // Insights
  reports: "/admin/reports",
  leadAnalytics: "/admin/reports/lead-analytics",
  analytics: "/admin/analytics",
  export: "/admin/export",

  // Network
  vendors: "/admin/vendors",
  network: "/admin/network",
  referrals: "/admin/referrals",

  // System
  settings: "/admin/settings",
  emailSettings: "/admin/settings/email",
} as const;

export type AdminRouteKey = keyof typeof ADMIN_ROUTES;

/**
 * Human labels + section grouping for each static admin route. Powers the
 * command-palette "Go to page" navigation (GlobalSearch). Keep in sync with the
 * sidebar's section grouping; `keywords` widen fuzzy matching (aliases).
 */
export interface AdminNavEntry {
  key: AdminRouteKey;
  path: string;
  label: string;
  section: string;
  keywords?: string;
}

export const ADMIN_NAV_ENTRIES: AdminNavEntry[] = [
  { key: 'dashboard', path: ADMIN_ROUTES.dashboard, label: 'Dashboard', section: 'Main', keywords: 'home overview' },
  // CRM retired from nav/search — the Pipeline manages client flow. Pipeline
  // carries the 'leads'/'crm' aliases so the command palette still finds it.
  { key: 'inventory', path: ADMIN_ROUTES.inventory, label: 'Inventory', section: 'Main', keywords: 'vehicles cars stock' },
  { key: 'contacts', path: ADMIN_ROUTES.contacts, label: 'Contacts', section: 'Main' },
  { key: 'pipelineV2', path: ADMIN_ROUTES.pipelineV2, label: 'Pipeline', section: 'Main', keywords: 'applications finance flow crm leads clients sheet' },
  { key: 'quotes', path: ADMIN_ROUTES.quotes, label: 'Quotes', section: 'Docs & Sales' },
  { key: 'otp', path: ADMIN_ROUTES.otp, label: 'OTP Generator', section: 'Docs & Sales', keywords: 'offer to purchase' },
  { key: 'documents', path: ADMIN_ROUTES.documents, label: 'Documents', section: 'Docs & Sales' },
  { key: 'juristic', path: ADMIN_ROUTES.juristic, label: 'Juristic', section: 'Docs & Sales' },
  { key: 'finance', path: ADMIN_ROUTES.finance, label: 'Finance', section: 'Money', keywords: 'applications deals' },
  { key: 'dealDesk', path: ADMIN_ROUTES.dealDesk, label: 'Deal Desk', section: 'Money', keywords: 'cost sheet delivery natis payables deal ledger profit commissions aftersales follow-ups customer follow ups' },
  { key: 'invoices', path: ADMIN_ROUTES.invoices, label: 'Invoices', section: 'Money' },
  // Deal Ledger / Aftersales folded into Deal Desk — no standalone palette entry.
  { key: 'extraIncomes', path: ADMIN_ROUTES.extraIncomes, label: 'Extra Incomes', section: 'Money' },
  { key: 'reports', path: ADMIN_ROUTES.reports, label: 'Reports', section: 'Insights' },
  { key: 'leadAnalytics', path: ADMIN_ROUTES.leadAnalytics, label: 'Lead Analytics', section: 'Insights' },
  { key: 'analytics', path: ADMIN_ROUTES.analytics, label: 'Analytics', section: 'Insights' },
  { key: 'export', path: ADMIN_ROUTES.export, label: 'Export', section: 'Insights' },
  { key: 'vendors', path: ADMIN_ROUTES.vendors, label: 'Vendors', section: 'Network' },
  { key: 'network', path: ADMIN_ROUTES.network, label: 'Network', section: 'Network' },
  { key: 'referrals', path: ADMIN_ROUTES.referrals, label: 'Referrals', section: 'Network' },
  { key: 'settings', path: ADMIN_ROUTES.settings, label: 'Settings', section: 'System' },
];

/** Quote builder, optionally prefilled from a finance application: `/admin/quote?app=<id>`. */
export const quoteBuilderPath = (applicationId?: string) =>
  applicationId ? `${ADMIN_ROUTES.quoteBuilder}?app=${applicationId}` : ADMIN_ROUTES.quoteBuilder;

/** Deal Room for a single finance application: `/admin/finance/:id`. */
export const dealRoomPath = (applicationId: string) => `/admin/finance/${applicationId}`;

/** Client profile page: `/admin/clients/:id`. */
export const clientProfilePath = (clientId: string) => `/admin/clients/${clientId}`;

/** Partner payout report for a deal: `/admin/reports/partner-payout/:dealId`. */
export const partnerPayoutPath = (dealId: string) =>
  `${ADMIN_ROUTES.partnerPayout}/${dealId}`;

/** Individual setting page: `/admin/settings/:key` (e.g. settingPath('email')). */
export const settingPath = (key: string) => `${ADMIN_ROUTES.settings}/${key}`;
