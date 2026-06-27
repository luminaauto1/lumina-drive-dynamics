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

## Phase 4 — Two-track status + shared status components — ⬜ (needs Q3)
- ⬜ Stored `deal_stage` enum (mirrors `DealStatus`); render as a second badge
- ⬜ Shared `<StatusBadge>` / `<StatusSelect>` (override-aware + role-filtered) used everywhere

## Phase 5 — Settings consolidation & customization — ⬜ (needs Q5)
- ⬜ Fix save model (form tabs vs self-saving tabs); grouped tab IA
- ⬜ Email Templates → tab (+ redirect)
- ⬜ Promote statuses (labels/wording/colours/messages), fee/cost-sheet/NaTIS/delivery/export defaults to editable
- ⬜ Editable nav config (reorder/rename/hide)

## Phase 6 — Power-user UX — ⬜
- ⬜ Command palette (⌘K), saved views, bulk actions, keyboard nav, empty/loading states, density-toggle persistence

---

## Changelog (most recent first)
- 2026-06-27 — **Phase 3: contract-signed → Deal Desk draft (feature-flagged, idempotent).** New `autoCreateDealOnContractSigned` document setting (**DEFAULT false** → zero behaviour change) with a checkbox in the Documents tab's new Deals section. When ON, `useUpdateFinanceApplication` creates a DRAFT `deal_records` row the first time an application reaches `contract_signed` — idempotent (existing-row check by `application_id`, never duplicates), all figures 0, no `sale_date` (so excluded from Accounting/Reports), wrapped in try/catch so it can never break the status update. `FinalizeDealModal` now enriches an existing draft instead of creating a parallel row. Deal Desk gains an "Awaiting finalize" filter; drafts are **admin-only**. Optional AFTER UPDATE trigger written as a separate migration (NOT applied). tsc + build clean. (branch `feat/admin-ux-phases-2b-6`)
- 2026-06-27 — **Phase 2b: shared primitives + route constants.** Added `<PageHeader>` and `<StatTile>` admin primitives and a centralized `lib/adminRoutes.ts` (`ADMIN_ROUTES` + param-path helpers). Refactored AdminDashboard, AdminFinance and AdminDealRoom to use them for their page headers and KPI/stat tiles (logic untouched). tsc + build clean. (branch `feat/admin-ux-phases-2b-6`)
- 2026-06-27 — **All decisions confirmed; whole plan approved.** Phase 2b started with the **density toggle** (`feat/admin-ux-density-toggle`): Comfortable default + per-user Compact toggle in the sidebar.
- 2026-06-26 — **Phase 2a merged** (PR #78): sidebar flattened to direct links under section headers (no dropdowns); OTP added, Contacts homed.
- 2026-06-26 — **Phase 1 merged** (`feat/admin-ux-phase1`, PR #77): `.desk-root` admin density theme + 404 fix. Verified before/after (~50% denser, glow removed).
- 2026-06-26 — Plan created; Phase 1 started on `feat/admin-ux-phase1`.
