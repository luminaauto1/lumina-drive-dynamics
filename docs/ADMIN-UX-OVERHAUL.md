# Admin UX Overhaul — Living Plan & Progress

**Goal:** make the Lumina admin app calm, dense, and clean (Linear/Attio/ZTC feel); flatten navigation
(direct tabs, no dropdown sprawl); add the **contract-signed → Deal Desk** auto-population flow; adopt
ZTC's two-track status model + status selects; consolidate & make Settings customizable.

**Source of truth:** branch `main` (the local `lumina-drive-dynamics` working folder is a stale fork —
archive it). Each phase ships as its own PR → merge → deploy. Full diagnosis: see the redesign report
(session 2026-06-26).

**Legend:** `[x]` done · `[~]` in progress · `[ ]` todo · `[!]` blocked

---

## Open decisions (defaults chosen so work isn't blocked — confirm when convenient)

| # | Question | Default in use | Confirmed? |
|---|---|---|---|
| 1 | Auto-create a Deal Desk draft on `contract_signed` (not `contract_sent`) | **contract_signed** | ✅ confirmed |
| 2 | Who sees draft deals before finalize | same admin/senior-F&I gate as today | ✅ confirmed |
| 3 | Status keys fixed; only labels/colours/wording editable | **keys fixed** | ✅ confirmed |
| 4 | Density default | **Compact default + per-user Comfortable toggle** | ⬜ |
| 5 | Editable nav scope | start with fixed 8-tab rail; editable nav later (Phase 5) | ⬜ |
| 6 | Phasing | per-phase PRs, merge as each is approved | ✅ (proceeding) |

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

## Phase 2b — Shared primitives + in-page tabs — ⬜ (next)
- ⬜ Extract `<PageHeader compact>` + `<StatTile>` primitives; refactor pages onto them
- ⬜ Fold Cars-to-Buy, CRM Sheet into in-page tabs (further reduce nav count)
- ⬜ Centralize admin route paths in `lib/adminRoutes.ts`; keep old routes as redirects

## Phase 3 — Contract-signed → Deal Desk automation — ⬜ (Q1–Q3 ✅ confirmed; ready to build)
- ⬜ Idempotent draft `deal_records` create on `contract_signed` in `useUpdateFinanceApplication`
- ⬜ Optional Postgres `AFTER UPDATE` trigger for non-hook write paths
- ⬜ Repurpose `FinalizeDealModal` to enrich the existing draft (no parallel row)
- ⬜ "Awaiting finalize" filter + Pipeline↔Deal-Desk deep link
- ⬜ Feature-flag + idempotency tests (writes the financial ledger — highest risk)

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
- 2026-06-26 — **Phase 2a** (`feat/admin-ux-phase2-nav`): sidebar flattened to direct links under section headers (no dropdowns); OTP added, Contacts homed. Q1–Q3 confirmed (defaults). Phase 3 unblocked.
- 2026-06-26 — **Phase 1 merged** (`feat/admin-ux-phase1`, PR #77): `.desk-root` admin density theme + 404 fix. Verified before/after (~50% denser, glow removed).
- 2026-06-26 — Plan created; Phase 1 started on `feat/admin-ux-phase1`.
