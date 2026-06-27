# Admin UX Overhaul — Living Plan & Progress

**Goal:** make the Lumina admin app calm, dense, and clean (Linear/Attio/ZTC feel); flatten navigation
(direct tabs, no dropdown sprawl); add the **contract-signed → Deal Desk** auto-population flow; adopt
ZTC's two-track status model + status selects; consolidate & make Settings customizable.

**Source of truth:** branch `main` (the local `lumina-drive-dynamics` working folder is a stale fork —
archive it). Each phase ships as its own PR → merge → deploy. Full diagnosis: see the redesign report
(session 2026-06-26).

**Legend:** `[x]` done · `[~]` in progress · `[ ]` todo · `[!]` blocked

---

## Open decisions — ALL CONFIRMED by owner 2026-06-27 (whole plan approved)

| # | Question | Final answer |
|---|---|---|
| 1 | Auto-create a Deal Desk draft when status becomes... | ✅ **`contract_signed`** |
| 2 | Who sees draft deals before finalize | ✅ **Admins only** (not all F&I) |
| 3 | Status editability | ✅ **ZTC-style**: status keys stay fixed, but **labels + their WhatsApp message bodies** (and colours) are editable in Settings — like Zinan Talks Cars |
| 4 | Density default | ✅ **Compact default** (the dense look) **+ per-user Comfortable toggle** (done — see Phase 2b) |
| 5 | Editable nav scope | ✅ owner's choice = mine: **light editable nav** (admins hide/show + reorder top-level via Settings) in Phase 5 |
| 6 | Phasing | ✅ **whole plan approved**; per-phase PRs; **deliver a final acceptance-checklist doc at the end** |

---

## Phase 1 — "Calm the Clutter" (visual only, no data risk) — [x] DONE (PR feat/admin-ux-phase1)
**Approach:** one `.desk-root` wrapper on AdminLayout's `<main>` + one scoped density block in `index.css`.
Higher specificity than the Tailwind utilities, so it retightens every admin page at once with zero
page edits and zero storefront impact. Fully reversible (delete the block).
- [x] Scope the heading-glow `text-shadow` out of admin (storefront keeps it)
- [x] Add a `.desk-root` wrapper on AdminLayout + scoped density CSS (`index.css`)
- [x] Compact admin data tables (th 36px / td ~0.4rem, uppercase micro-headers) via `.desk-root` scope
- [x] Tighten pages — `.p-6`->1rem, `.gap-6`->1rem, `.space-y-6`->1rem, `.text-3xl/2xl` smaller (covers Dashboard, Finance, **Deal Room**, all admin)
- [x] Shrink stat/KPI tiles (`.text-3xl`->1.5rem; `font-mono`->tabular-nums)
- [x] Fix the 2 broken `navigate("/admin/lead-analytics")` 404s -> `/admin/reports/lead-analytics`
- [x] Verify: `tsc` clean, `vite build` clean, before/after screenshot confirmed (~50% denser)

## Phase 2a — Sidebar flatten — [x] DONE (PR feat/admin-ux-phase2-nav)
- [x] Remove ALL collapsible dropdowns; every item is a direct link, grouped under quiet section headers (Main · Docs & Sales · Money · Insights · Network · System)
- [x] Reorder daily-use destinations first; denser nav items (py-1.5, 18px icons, w-60)
- [x] Added the new **OTP Generator** to the nav; homed the orphaned **Contacts** page
- [x] Preserved role filtering, Referrals badge, collapse-to-icon-rail, auto-collapse on Finance/Pipeline
- [x] Verify: tsc + build clean (live screenshot after merge — sidebar is auth-gated)

## Phase 2b — Shared primitives + in-page tabs — [~] in progress
- [x] **Per-user density toggle (Q4)** — `.desk-root` base = Comfortable (default); `.density-compact` = denser. `useAdminDensity` hook (localStorage) + sidebar footer toggle; AdminLayout applies `density-<mode>`. (PR feat/admin-ux-density-toggle)
- [x] Extract `<PageHeader>` + `<StatTile>` primitives; refactor Dashboard, Finance & Deal Room headers/KPI tiles onto them
- [ ] Fold Cars-to-Buy, CRM Sheet into in-page tabs (further reduce nav count)
- [x] Centralize admin route paths in `lib/adminRoutes.ts` (`ADMIN_ROUTES` map + `dealRoomPath`/`clientProfilePath`/`partnerPayoutPath` helpers)

## Phase 3 — Contract-signed → Deal Desk automation — ✅ done (FEATURE-FLAGGED OFF by default; drafts visible to **Admins only**)
- ✅ Feature flag `autoCreateDealOnContractSigned` (DEFAULT **false**) in `DocumentSettings` + a checkbox under a new **Deals** section in the Documents settings tab. Flag OFF → zero behaviour change.
- ✅ Idempotent draft `deal_records` create on `contract_signed` in `useUpdateFinanceApplication` (queries for an existing row by `application_id` first; never duplicates; all figures 0; no `sale_date`; wrapped in try/catch so it can never break the status update).
- ✅ Optional Postgres `AFTER UPDATE` trigger migration for non-hook write paths (`20260627090000_contract_signed_deal_draft_trigger.sql`) — same flag + idempotency logic; **written but NOT applied**.
- ✅ `FinalizeDealModal` enriches a pre-existing draft (`useUpdateDealRecord`) instead of creating a parallel row.
- ✅ "Awaiting finalize" filter in the Deal Desk Deals table; auto-created drafts are **admin-only** (filtered out for non-admins across the whole Deal Desk page).

## Phase 4 — Two-track status + shared status components — [x] DONE (branch feat/admin-ux-phases-2b-6)
- [x] Stored `deal_stage` text column on `deal_records` (nullable, default null; CHECK in `none|deal_started|contract_signed|in_delivery|delivered|cleared`) — migration `20260627100000_deal_records_deal_stage.sql` (written, **NOT applied**)
- [x] Shared `<StatusBadge track="finance"|"deal">` / `<StatusSelect>` (override-aware + role-filtered) — labels/colours from `statusConfig` (+ `status_overrides` merge) and the deal-stage map; both badges carry a track icon + distinct shape (never colour-only)
- [x] `StatusSelect` applies `filterStatusOptionsForRole` consistently → fixes `StatusChangeModal` (previously mapped `STATUS_OPTIONS` with **no** role filter)
- [x] Render BOTH tracks: Deal Desk rows/Overview/Drawer (deal-stage + finance badge, `deal_stage` surfaced via `fromDealRecord`) and Deal Room status controller (finance badge + derived deal-stage). Deal Desk badge now driven by `<StatusBadge track="deal">` instead of the hardcoded `badges.tsx` map.

## Phase 5 — Settings consolidation & customization — [x] DONE (branch feat/admin-ux-phases-2b-6)
- [x] **Editable statuses (ZTC-style)** — `status_overrides` gains an overridable `whatsapp_message` column (migration `20260627110000_status_overrides_whatsapp_message.sql`, **written, NOT applied**). `StatusesTab` now edits label + colour + sort/visibility **and** the per-status WhatsApp message body. `getWhatsAppMessage(status, name, count, customBody)` uses the editable body when present (with `{name}`/`{{clientName}}`/`{count}` interpolation via `renderWhatsAppTemplate`), else the built-in copy. Both `wa.me` send sites (AdminFinance, AdminDealRoom) pass `whatsappMessageFor(status)`. Status keys stay fixed.
- [x] **Fixed save model** — global "Save All Settings" bar now renders ONLY on form-bound tabs (`FORM_BOUND_TABS`: finance/sales/contact/location/branding/features); self-saving tabs (Banks, Team, Documents, Branches, EasySocial, WhatsApp, Statuses, Email, Appearance) keep their own Save controls and no longer show a misleading global bar.
- [x] **Grouped tab IA** — flat strip reorganised into labelled sections: Business Profile / Finance & Deals / Workflow / Communications / Access & Team / System. Active tab is controlled + synced to `?tab=` for deep links.
- [x] **Email Templates → tab** — extracted to `EmailTemplatesTab` inside the Settings hub (Communications group); `/admin/settings/email` is now a permanent redirect to `/admin/settings?tab=email`.
- [x] **Editable nav (light)** — new `navConfig` blob on `document_settings` (hide/show + reorder top-level nav sections & items). `AppearanceNavTab` edits it; `AdminSidebar` exports `NAV_SECTIONS` and applies the config via `lib/navConfig.applyNavConfig` BEFORE role filtering (config can only hide/reorder, never grant). Absent config => code defaults.

## Phase 6 — Power-user UX — [x] DONE (branch feat/admin-ux-phases-2b-6)
- [x] **Command palette actions + page nav** — `GlobalSearch` (⌘K) now lists quick **Actions** (new finance application, open Pipeline/Deal Desk/Settings) and **Go to page** navigation for every static admin route (driven by new `ADMIN_NAV_ENTRIES` in `lib/adminRoutes.ts`) alongside the existing record search. cmdk fuzzy-filters pages/actions by a value blob; record groups stay server-searched. Palette now has a useful default state before any query.
- [x] **Saved views / filter presets** — new `useSavedViews<P>(scope, userId)` hook (per-user localStorage, namespaced by scope) + presentational `<SavedViewsBar>` chip row with a "Save view" popover. Wired into **Pipeline** (lane/scope/sort/owner preset) and **Deal Desk** Deals table (month + awaiting-finalize preset). Search text is intentionally excluded from presets. Absent presets => zero behaviour change.
- [x] **Bulk modal: role filter + deal_stage track** — `BulkStatusModal` now renders via the shared role-aware `<StatusSelect>` (finance options filtered by `filterStatusOptionsForRole`, fixing the prior unfiltered `STATUS_OPTIONS` list) and accepts an optional `onApplyDealStage` updater that surfaces a second **Deal stage** track toggle (hidden where no safe deal-records write path is wired, e.g. the Pipeline page → finance track only).
- [x] **Empty + loading (skeleton) states** — new `DealsTableSkeleton`; Deal Desk renders the tab bar immediately and shows the skeleton inside Deals/Delivery/Reports while the list loads (replacing the full-page spinner). Deals table empty state is now designed (icon + distinct copy for "no deals yet" vs "no match for filters").
- [x] **Keyboard navigation** — dense `ApplicationTable` (Pipeline) and `DealsTable` (Deal Desk) rows are now focusable; ↑/↓ move row focus, Enter opens the row, Space toggles selection (Pipeline). Focus ring via `focus-visible:ring-inset`. No table rewrite.
- [~] Density-toggle persistence — already shipped in Phase 2b (`useAdminDensity`); not re-touched here.

---

## Changelog (most recent first)
- 2026-06-27 — **Admin v2: settings as routed pages + audit/optimize.** The Settings hub is now an **index page** (`AdminSettings`) — a grouped directory (Business Profile / Finance & Deals / Workflow / Communications / Access & Team / System) where each item LINKS to `/admin/settings/<key>`; the in-page tabs are gone. Each setting renders on **its own route** via a single `/admin/settings/:key` route (`AdminSettingPage`, gated `requireSuperAdmin` like the index, with a per-setting super-admin re-check + redirect for unknown/forbidden keys) inside a shared `SettingsPageLayout` (back-to-Settings link + `<PageHeader>` title/description + body). New `settingsRegistry.tsx` is the single source of truth (key/title/description/icon/group/gate/body); the index list and the routes are both derived from it. **Form-bound panels split out** — Finance/Sales/Contact/Location/Features no longer share one global form+save bar; each is a self-contained body (`SettingsFormBodies.tsx`) with its own `useForm` + Save scoped to just its own fields (saving one no longer rewrites another's). `SalesRepsTab` + `TestEmailButton` extracted to `components/admin/settings/`. `/admin/settings/email` (Email Templates) now resolves to a real page via the `:key` route; the dead `AdminEmailSettings.tsx` `?tab=` redirect removed and its `App.tsx` route/import dropped. New `settingPath(key)` helper in `lib/adminRoutes`. **Audit/optimize:** clearer titles + help text across the board (e.g. Finance "Calculator Defaults", Contact "blank to hide a link", finance_email "where alerts go", sales-reps "save instantly"); no settings removed (none confirmed dead-with-no-consumer were surfaced). Audit notes recorded in the task return. No schema changes (existing `site_settings` columns + `document_settings` JSON blob). tsc + build clean. (branch `feat/admin-ux-v2`)
- 2026-06-27 — **Cleanup: remove Email-Templates nav, CRM nav+route, Branding settings tab.** `AdminSidebar` drops the **Email Templates** item (redundant — it's a tab in Settings → Communications) and the **CRM** item (owner doesn't use the CRM kanban; the Pipeline manages client flow); now-unused `Users`/`Mail` icon imports removed. `App.tsx`: `/admin/crm`, `/admin/crm-sheet`, and the legacy `/admin/leads` alias now `<Navigate replace>` to `/admin/pipeline-v2`; `AdminCRM` left in the tree but unrouted (lazy import dropped). Dead links repointed at the Pipeline: AdminDashboard's "Pipeline"/View-All/lead-row/New-Leads navigations and `lib/adminRoutes` `ADMIN_NAV_ENTRIES` (CRM entry removed; its `crm`/`leads`/`clients`/`sheet` aliases folded into the Pipeline entry's keywords so ⌘K still finds them). `AdminSettings`: **Branding** tab trigger + content removed and dropped from `FORM_BOUND_TABS` (hero/maintenance fields stay registered on the form, just unsurfaced); unused `Palette`/`Settings` icon imports removed. No schema changes. tsc + build clean. (branch `feat/admin-ux-v2`)
- 2026-06-27 — **Phase 6: command palette actions, saved views, bulk+keyboard, empty/loading states.** `GlobalSearch` (⌘K) gains a **Go to page** group (all static admin routes via new `ADMIN_NAV_ENTRIES` in `lib/adminRoutes.ts`) and quick **Actions**, alongside record search. New `useSavedViews<P>(scope, userId)` hook (per-user localStorage) + `<SavedViewsBar>` chip row, wired into Pipeline (lane/scope/sort/owner) and Deal Desk Deals table (month + awaiting). `BulkStatusModal` now uses the shared role-aware `<StatusSelect>` (finance options role-filtered; fixes the prior unfiltered list) and supports an optional **Deal stage** track via `onApplyDealStage` (hidden where no deal-records write path is wired). New `DealsTableSkeleton` shown while the Deal Desk list loads (tab bar stays interactive), plus a designed empty state. Keyboard nav in `ApplicationTable` + `DealsTable` (↑/↓ focus, Enter opens, Space toggles select on Pipeline). tsc + build clean. (branch `feat/admin-ux-phases-2b-6`)
- 2026-06-27 — **Phase 5: editable statuses+WhatsApp, settings consolidation, editable nav.** `status_overrides` gains an overridable `whatsapp_message` column (NEW migration `20260627110000_status_overrides_whatsapp_message.sql`, **written, NOT applied**). `StatusesTab` now edits the per-status WhatsApp message body (label/colour/order/visibility unchanged); `getWhatsAppMessage` takes an optional `customBody` (interpolated via `renderWhatsAppTemplate` — `{name}`/`{{clientName}}`/`{count}`), and AdminFinance + AdminDealRoom pass `whatsappMessageFor(status)` so the editable body actually sends; blank => built-in copy. Settings hub: grouped tab IA (Business Profile / Finance & Deals / Workflow / Communications / Access & Team / System), the global Save bar now shows only on form-bound tabs (self-saving tabs hide it), active tab synced to `?tab=`. Email Templates moved IN as a tab (`EmailTemplatesTab`); `/admin/settings/email` → permanent redirect. New **Appearance & Navigation** tab (`AppearanceNavTab`) stores a `navConfig` blob on `document_settings`; `AdminSidebar` exports `NAV_SECTIONS` and applies the config (hide/show + reorder) via `lib/navConfig` before role filtering (falls back to code defaults when absent; role filtering intact). tsc + build clean. (branch `feat/admin-ux-phases-2b-6`)
- 2026-06-27 — **Phase 4: deal_stage track + shared StatusBadge/StatusSelect.** Added a stored `deal_stage` text column to `deal_records` (nullable, default null, CHECK over the 6 deal-stage values) as a NEW migration `20260627100000_deal_records_deal_stage.sql` (**written, NOT applied**). New shared `src/components/admin/StatusBadge.tsx` + `StatusSelect.tsx` (`track:'finance'|'deal'`) reading labels/colours from `lib/admin/statusTracks` (statusConfig + `status_overrides` merge for finance; deal-stage map for deal) — each track carries a leading icon + distinct badge shape (not colour-only). `StatusSelect` runs `filterStatusOptionsForRole` consistently, fixing `StatusChangeModal` which previously offered all `STATUS_OPTIONS` regardless of role. `fromDealRecord` now surfaces `deal_stage` (stored, else derived from `deal_status`) and `finance_status`; Deal Desk (table/overview/drawer) renders the deal-stage badge via `<StatusBadge track="deal">` plus the finance badge; the Deal Room status controller renders the finance badge plus a derived deal-stage badge. tsc + build clean. (branch `feat/admin-ux-phases-2b-6`)
- 2026-06-27 — **Phase 3: contract-signed → Deal Desk draft (feature-flagged, idempotent).** New `autoCreateDealOnContractSigned` document setting (**DEFAULT false** → zero behaviour change) with a checkbox in the Documents tab's new Deals section. When ON, `useUpdateFinanceApplication` creates a DRAFT `deal_records` row the first time an application reaches `contract_signed` — idempotent (existing-row check by `application_id`, never duplicates), all figures 0, no `sale_date` (so excluded from Accounting/Reports), wrapped in try/catch so it can never break the status update. `FinalizeDealModal` now enriches an existing draft instead of creating a parallel row. Deal Desk gains an "Awaiting finalize" filter; drafts are **admin-only**. Optional AFTER UPDATE trigger written as a separate migration (NOT applied). tsc + build clean. (branch `feat/admin-ux-phases-2b-6`)
- 2026-06-27 — **Phase 2b: shared primitives + route constants.** Added `<PageHeader>` and `<StatTile>` admin primitives and a centralized `lib/adminRoutes.ts` (`ADMIN_ROUTES` + param-path helpers). Refactored AdminDashboard, AdminFinance and AdminDealRoom to use them for their page headers and KPI/stat tiles (logic untouched). tsc + build clean. (branch `feat/admin-ux-phases-2b-6`)
- 2026-06-27 — **All decisions confirmed; whole plan approved.** Phase 2b started with the **density toggle** (`feat/admin-ux-density-toggle`): Comfortable default + per-user Compact toggle in the sidebar.
- 2026-06-26 — **Phase 2a merged** (PR #78): sidebar flattened to direct links under section headers (no dropdowns); OTP added, Contacts homed.
- 2026-06-26 — **Phase 1 merged** (`feat/admin-ux-phase1`, PR #77): `.desk-root` admin density theme + 404 fix. Verified before/after (~50% denser, glow removed).
- 2026-06-26 — Plan created; Phase 1 started on `feat/admin-ux-phase1`.
