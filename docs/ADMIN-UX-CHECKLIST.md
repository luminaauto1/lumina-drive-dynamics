# Admin UX Overhaul — Acceptance Checklist (Phases 1–6)

**Who this is for:** the dealership owner. Walk through every box below in the admin app to confirm each
change landed and behaves the way it should. No coding needed — just click around and compare against the
**Expected result** under each item.

**Before you start:**
- Log in to the admin app as an **Admin** account (some checks are admin-only — they're marked).
- Have a second, non-admin staff login handy for the role-filtering checks (optional but recommended).
- Pick a quiet time. One section (Phase 3) involves turning on a new automation — there's a safe way to
  test it and a way to turn it straight back off, both spelled out below.
- Companion doc: `docs/ADMIN-UX-OVERHAUL.md` (the full plan and what shipped in each phase).

> **Note on database migrations.** Phases 3–5 ship optional database changes (a Postgres trigger and a few
> new columns) that are **written but NOT yet applied** to the live database. The app works without them
> because all the live behaviour runs in the app code. The migration files are there for later. Items that
> depend on an unapplied migration are flagged **[needs migration]** — if one doesn't behave as described,
> it's expected until the migration is applied, not a bug.

---

## Phase 1 — "Calm the Clutter" (look & feel only, no data risk)

- [ ] **Admin looks denser and calmer than before.**
  Steps: open the admin **Dashboard**, then **Finance / Pipeline**, then **Deal Room**, then a couple more
  admin pages.
  Expected: everything is tighter and cleaner than the old look (roughly half the wasted space). Tables,
  cards and headings sit closer together. Nothing is cut off or overlapping.

- [ ] **The glowing-text effect is gone from admin (but still on the public website).**
  Steps: look at the big headings inside admin. Then open the public storefront site.
  Expected: admin headings are plain and crisp (no glow). The public site keeps its glow — unchanged.

- [ ] **Data tables are compact and easy to scan.**
  Steps: open any admin table (e.g. Pipeline list).
  Expected: short row height, small UPPERCASE column headers, numbers line up neatly in columns.

- [ ] **The two broken "Lead Analytics" links now work.**
  Steps: find any link/button that goes to **Lead Analytics** (under Reports).
  Expected: it opens the Lead Analytics page — no "404 / page not found".

**How to roll back (Phase 1):** this is pure styling in one CSS block. If anything looks wrong, the density
theme can be removed and admin returns to the old spacing with zero data impact.

---

## Phase 2a — Flat sidebar (no more dropdowns)

- [ ] **Every sidebar item is a direct link — no expanding/collapsing menus.**
  Steps: open the left sidebar and scan top to bottom.
  Expected: a flat list grouped under quiet section labels (**Main · Docs & Sales · Money · Insights ·
  Network · System**). Nothing has to be expanded to reveal links; one click goes straight to the page.

- [ ] **Daily-use pages are near the top.**
  Expected: the things you use most are first; less-used items lower down. Items feel compact.

- [ ] **OTP Generator is in the nav, and Contacts has a home.**
  Steps: look for **OTP Generator** and **Contacts** in the sidebar.
  Expected: both are present and open their pages.

- [ ] **Role filtering still works.**
  Steps: log in as a non-admin staff member.
  Expected: that person only sees the sections their role allows (admin-only items stay hidden). The
  Referrals badge still shows its count.

- [ ] **Collapse-to-icons still works.**
  Steps: collapse the sidebar to the narrow icon rail and expand it again.
  Expected: it collapses/expands cleanly; it auto-collapses on Finance/Pipeline as before.

**How to roll back (Phase 2a):** revert the sidebar PR (`feat/admin-ux-phase2-nav`) to restore the previous
nav. No data is touched.

---

## Phase 2b — Shared building blocks + density toggle

- [ ] **Comfortable / Compact toggle works and remembers your choice.**
  Steps: find the density toggle in the **sidebar footer**. Switch between **Comfortable** and **Compact**.
  Refresh the page.
  Expected: Comfortable = roomier; Compact = denser. Your choice sticks after refresh and is **per-user**
  (your setting doesn't change anyone else's). Default for a new user is Comfortable.

- [ ] **Page headers and KPI tiles look consistent.**
  Steps: compare the top of **Dashboard**, **Finance**, and **Deal Room**.
  Expected: the page title area and the stat/number tiles share the same clean style across all three. The
  numbers shown are the same as before (only the styling changed).

- [ ] **Stat numbers are still correct.**
  Expected: KPI/stat tiles show the same values you'd expect — nothing reads zero or wrong.

**How to roll back (Phase 2b):** the density toggle and shared header/tile components are additive. Reverting
the relevant commits restores the prior per-page headers; data and totals are unaffected.

---

## Phase 3 — Contract-signed → Deal Desk automation (the big one — test safely)

**What it does:** when you turn the feature ON, the first time a finance application reaches the
**Contract Signed** status, the system quietly creates a **draft deal** in the Deal Desk for you — pre-linked
to that application, with all money figures at 0 and **no sale date** (so it never affects Accounting or
Reports until you finalize it). Drafts are **visible to Admins only**. The feature ships **OFF by default**,
so until you turn it on, nothing changes.

### Turn the feature ON (in Settings)

- [ ] **Find and enable the flag.**
  Steps: go to **Settings → Documents** tab. Look for the new **Deals** section and the checkbox
  **"Auto-create a Deal Desk draft when an application is marked Contract Signed"**
  (the setting `autoCreateDealOnContractSigned`). Tick it and save.
  Expected: the checkbox saves and stays ticked when you reload Settings.

### Test it safely

- [ ] **Use a test application, not a live customer deal.**
  Steps: pick (or create) a throwaway finance application you don't mind touching. Move its status to
  **Contract Signed**.
  Expected: a new **draft deal** appears in the Deal Desk linked to that application, with all amounts at 0
  and no sale date.

- [ ] **It never duplicates.**
  Steps: change the same application's status away from and back to **Contract Signed** (or save again).
  Expected: still only **one** draft for that application — no second copy is created.

- [ ] **Drafts are admin-only.**
  Steps: log in as a non-admin and open the Deal Desk.
  Expected: the auto-created draft does **not** show for them. Only admins see drafts.

- [ ] **Drafts don't pollute Accounting / Reports.**
  Steps: check Accounting and Reports totals.
  Expected: the draft (0 figures, no sale date) is excluded — totals are unchanged.

- [ ] **Finalizing enriches the draft (doesn't make a duplicate).**
  Steps: open the draft and run **Finalize Deal**, filling in the real figures.
  Expected: the **same** deal becomes the finalized deal — you do **not** end up with two deals for one
  application.

- [ ] **Confirm OFF means nothing changes.**
  Steps: untick the flag in Settings → Documents. Mark another test application **Contract Signed**.
  Expected: **no** draft is created. Behaviour is exactly as it was before this phase.

- [ ] **[needs migration]** Optional database trigger for non-app write paths.
  Note: a Postgres `AFTER UPDATE` trigger (`20260627090000_contract_signed_deal_draft_trigger.sql`) is
  written but **NOT applied**. Until applied, the automation runs only through the normal in-app status
  change (which is the usual path). No action needed unless/until you apply migrations.

**How to roll back (Phase 3):** this is the riskiest change, so it's gated behind the flag.
1. **Fastest:** untick **autoCreateDealOnContractSigned** in Settings → Documents — the automation stops
   immediately, no code change.
2. Any draft deals already created can be deleted from the Deal Desk (they carry 0 figures and no sale date,
   so deleting them affects nothing financial).
3. Full revert: revert the Phase 3 commit. Because the trigger migration was never applied, there's nothing
   to undo in the database.

---

## Phase 4 — Two status tracks (Finance + Deal stage)

**What it does:** deals now show **two** separate status labels — the **Finance** status (the application's
status) and the **Deal stage** (where the car is in the delivery journey: deal started → contract signed →
in delivery → delivered → cleared). Each track has its own icon and badge shape, so you can tell them apart
even without colour.

- [ ] **Both tracks show in the Deal Desk.**
  Steps: open the **Deal Desk** — look at the rows, the overview, and a row's side drawer.
  Expected: each deal shows a **Deal stage** badge **and** a **Finance** badge. They're visually distinct
  (different icon/shape, not just colour).

- [ ] **Both tracks show in the Deal Room.**
  Steps: open a **Deal Room** record and look at the status controller.
  Expected: the Finance badge plus a Deal-stage badge are both visible.

- [ ] **Status dropdowns respect roles everywhere.**
  Steps: as a non-admin, open a status-change dropdown (including the **Change Status** modal).
  Expected: only the statuses allowed for that role appear. (This fixes a spot where the Change Status modal
  used to show every status regardless of role.)

- [ ] **Badges are readable for colour-blind users.**
  Expected: you can tell finance vs deal-stage apart by icon/shape, not colour alone.

- [ ] **[needs migration]** Stored deal stage column.
  Note: a new `deal_stage` column on `deal_records` (`20260627100000_deal_records_deal_stage.sql`) is written
  but **NOT applied**. Until applied, the deal stage is **derived** from existing data, so the badge still
  shows correctly. Once the migration is applied, the stage can be stored explicitly.

**How to roll back (Phase 4):** the shared badge/select components are additive and the column migration was
never applied. Reverting the Phase 4 commit returns the old single-badge display with no database cleanup
needed.

---

## Phase 5 — Editable statuses, WhatsApp messages, Settings consolidation & editable nav

### Editable statuses + WhatsApp messages (ZTC-style)

- [ ] **You can edit status labels, colours, order and visibility.**
  Steps: go to **Settings → Statuses** (under the Workflow group). Change a status **label** and **colour**,
  reorder or hide one, and save.
  Expected: the change shows up wherever that status appears in admin. (The underlying status **keys** stay
  fixed — you're editing how they look, not breaking the workflow.)

- [ ] **You can edit the WhatsApp message for each status.**
  Steps: in **Settings → Statuses**, edit the **WhatsApp message** body for a status. You can use
  placeholders like `{name}` / `{{clientName}}` and `{count}`. Save.
  Expected: the field saves per status.

- [ ] **The edited WhatsApp message is what actually sends.**
  Steps: from **Finance** (AdminFinance) or the **Deal Room**, trigger the WhatsApp send for a client whose
  status you just edited.
  Expected: the WhatsApp draft uses **your** edited wording, with `{name}`/`{count}` filled in correctly.
  If you leave the message blank, it falls back to the built-in default copy.

- [ ] **[needs migration]** Stored WhatsApp message column.
  Note: the editable message lives in a new `whatsapp_message` column
  (`20260627110000_status_overrides_whatsapp_message.sql`), written but **NOT applied**. If saving the
  WhatsApp body doesn't persist after the migration is applied vs. not, that's expected until it's applied.

### Settings consolidation

- [ ] **Settings tabs are grouped into clear sections.**
  Steps: open **Settings** and look at the tab strip.
  Expected: tabs are organised under labelled groups — **Business Profile / Finance & Deals / Workflow /
  Communications / Access & Team / System** — instead of one long flat row.

- [ ] **The "Save All Settings" bar only appears where it makes sense.**
  Steps: open a form-style tab (e.g. Finance, Contact, Branding) then a self-saving tab (e.g. Banks, Team,
  Documents, WhatsApp, Statuses, Email, Appearance).
  Expected: the global **Save All Settings** bar shows on the form tabs only. Self-saving tabs have their own
  Save buttons and **don't** show the misleading global bar.

- [ ] **Email Templates is now a tab inside Settings.**
  Steps: open **Settings → Email Templates** (Communications group). Also try the old link
  `/admin/settings/email`.
  Expected: Email Templates lives inside the Settings hub. The old URL redirects to the new tab
  (`?tab=email`).

- [ ] **Deep links to a specific tab work.**
  Steps: note the URL adds `?tab=...` when you switch tabs; copy a tab URL and open it fresh.
  Expected: it opens directly on that tab.

### Editable navigation (light)

- [ ] **You can hide/show and reorder top-level nav from Settings.**
  Steps: go to **Settings → Appearance & Navigation**. Hide a nav section or item, reorder some items, save,
  then reload the admin app.
  Expected: the sidebar reflects your changes. **Important safety rule:** the config can only **hide or
  reorder** — it can **never** grant access to something a role isn't allowed to see. Role filtering still
  applies on top.

- [ ] **Clearing the nav config restores the defaults.**
  Steps: reset/clear the nav customisation.
  Expected: the sidebar returns to the built-in default layout.

**How to roll back (Phase 5):**
- **Status/WhatsApp edits:** clear the override fields in Settings → Statuses to fall back to built-in labels
  and default WhatsApp copy. The message column migration was never applied, so nothing to undo in the DB.
- **Editable nav:** clear the nav config in Settings → Appearance & Navigation → reverts to code defaults.
- **Settings IA / Email tab move:** revert the Phase 5 commit; the old flat settings + standalone email page
  return.

---

## Phase 6 — Power-user features

- [ ] **Command palette (⌘K / Ctrl-K) does more than search records.**
  Steps: press **⌘K** (Mac) or **Ctrl-K** (Windows). Look before typing, then type a page name.
  Expected: even before typing you see useful **Actions** (e.g. New finance application, open Pipeline / Deal
  Desk / Settings) and a **Go to page** list covering every admin page. Typing fuzzy-filters them. Record
  search still works as before.

- [ ] **Saved views / filter presets — Pipeline.**
  Steps: on **Pipeline**, set a lane/scope/sort/owner combination, then use **Save view** to save it. Reload
  and re-apply it from the chip row.
  Expected: the preset saves (per-user) and re-applies your filters. Note: your **search text** is
  intentionally NOT saved into a preset.

- [ ] **Saved views / filter presets — Deal Desk.**
  Steps: on the **Deal Desk** Deals table, set a month + the "Awaiting finalize" filter, save it as a view,
  reload, re-apply.
  Expected: the preset restores month + awaiting-finalize. With no presets saved, behaviour is unchanged.

- [ ] **Bulk status change respects roles and offers the deal-stage track where safe.**
  Steps: select multiple rows and open the **bulk status** modal.
  Expected: the finance status list is role-filtered (non-admins don't see disallowed statuses). Where a safe
  write path exists, a second **Deal stage** toggle appears; on Pipeline (finance-only) it stays finance-only.

- [ ] **"Awaiting finalize" filter works on the Deal Desk.**
  Steps: use the **Awaiting finalize** filter in the Deals table.
  Expected: it narrows to deals waiting to be finalized (the auto-created drafts from Phase 3, admin-only).

- [ ] **Loading and empty states look intentional.**
  Steps: open the **Deal Desk** and watch it load; also view it with filters that match nothing.
  Expected: the tab bar shows immediately and a tidy **skeleton** loads inside the list (no full-page
  spinner). Empty results show a designed message with an icon — distinct copy for "no deals yet" vs. "no
  match for your filters".

- [ ] **Keyboard navigation in the big tables.**
  Steps: click into the **Pipeline** table or **Deal Desk** Deals table, then use the keyboard:
  **↑ / ↓** to move between rows, **Enter** to open a row, **Space** to toggle selection (Pipeline).
  Expected: a visible focus outline follows the rows; the keys behave as described.

- [ ] **Density toggle still persists.**
  Expected: the Comfortable/Compact choice from Phase 2b still sticks (it wasn't re-touched here).

**How to roll back (Phase 6):** all Phase 6 features are additive and most are per-user localStorage (saved
views, density). Reverting the Phase 6 commit removes the palette extras, saved views, skeleton/empty states
and keyboard nav with no data impact; saved-view presets simply disappear from each user's browser.

---

## Final sign-off

- [ ] All boxes above checked, or any exceptions noted (especially **[needs migration]** items).
- [ ] Phase 3 flag is left in the state you want for go-live (**OFF** until you're ready to use the
      auto-draft flow).
- [ ] No console errors or broken pages encountered during the walkthrough.

**Owner sign-off:** _______________________  **Date:** ______________
