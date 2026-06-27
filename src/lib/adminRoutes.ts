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
  carsToBuy: "/admin/cars-to-buy",
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

/** Deal Room for a single finance application: `/admin/finance/:id`. */
export const dealRoomPath = (applicationId: string) => `/admin/finance/${applicationId}`;

/** Client profile page: `/admin/clients/:id`. */
export const clientProfilePath = (clientId: string) => `/admin/clients/${clientId}`;

/** Partner payout report for a deal: `/admin/reports/partner-payout/:dealId`. */
export const partnerPayoutPath = (dealId: string) =>
  `${ADMIN_ROUTES.partnerPayout}/${dealId}`;
