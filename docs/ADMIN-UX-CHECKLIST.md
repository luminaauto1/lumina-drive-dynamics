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

## Phase 7 — Admin v2: nav cleanup, settings-as-pages, customizable dashboard

**What changed:** three things shipped together on the `feat/admin-ux-v2` branch.
1. **Nav slimming** — the **CRM** and **Email Templates** items were removed from the sidebar; the
   **Pipeline** now manages client flow.
2. **Settings became real pages** — each setting opens on its own URL (`/admin/settings/<key>`) instead of an
   in-page tab. The Settings landing page is now a grouped **directory of links**.
3. **A new customizable, month-filtered dashboard** (the "Command Center").

> **Supersedes parts of Phase 5.** The Phase 5 items about a Settings **tab strip**, the **"Save All
> Settings"** bar, and Email Templates being a **`?tab=email` tab** no longer apply — settings are pages now,
> each form has its **own** Save button, and Email Templates is a page at `/admin/settings/email`. Use the
> Phase 7 items below instead where they overlap.

### Nav: CRM and Email-Templates removed; CRM URLs redirect to Pipeline

- [ ] **CRM and Email Templates are gone from the sidebar.**
  Steps: scan the left sidebar (Main and System groups).
  Expected: there's **no** "CRM" item and **no** "Email Templates" item. Pipeline, Finance, Deal Desk and
  Inventory are still under **Main**; **Settings** is still under **System**.

- [ ] **Old CRM links still land somewhere sensible (redirect to Pipeline).**
  Steps: in the browser address bar visit `/admin/crm`, then `/admin/crm-sheet`, then `/admin/leads`.
  Expected: each one lands on the **Pipeline** (`/admin/pipeline-v2`) — no 404, no blank page.

- [ ] **Command palette / search no longer offers a dead "CRM" page, and lead results open the Pipeline.**
  Steps: press **⌘K / Ctrl-K** and type "CRM"; also search a lead name and click a **Leads** result.
  Expected: typing "CRM" surfaces the **Pipeline** (it carries the crm/leads keywords); clicking a lead
  result opens the **Pipeline**, not a dead CRM page.

- [ ] **Non-admin staff are not stranded by the CRM removal. _(needs a non-admin login)_**
  Steps: log in as a **non-admin** staff member (e.g. a Salesperson) and click the **"Admin"** button in the
  public site's top nav; also try opening `/admin/crm` directly.
  Expected: you land on a page you're **allowed** to see (the Pipeline if your role permits it, otherwise your
  first allowed section) — you are **never** bounced back and forth between two pages and never see a blank
  screen. _(This was the bug fixed during review: a role granted the legacy "CRM" access is now also allowed
  into the Pipeline it redirects to.)_

### Settings as individual pages

- [ ] **The Settings landing page is a directory of links.**
  Steps: open **Settings** from the sidebar.
  Expected: a grouped list of settings (**Business Profile / Finance & Deals / Workflow / Communications /
  Access & Team / System**), each a clickable card that opens its **own page**. No in-page tab strip.

- [ ] **Every setting opens at its own URL and shows the right form.**
  Steps: click each setting in turn (Contact & Social, Location, Documents, Finance Calculator, Banks, Sales
  Team & Target, Bank Branch Codes, Statuses, Appearance & Navigation, Email Templates, WhatsApp Templates,
  EasySocial, Team & Permissions, Features & Diagnostics).
  Expected: each opens at `/admin/settings/<key>` with the correct title and controls. **Nothing from the old
  tabbed Settings is missing** except **Branding** (intentionally removed — see the note below).

- [ ] **Each settings form saves on its own — saving one never overwrites another.**
  Steps: change a value on **Contact & Social** and Save; then change a value on **Finance Calculator** and
  Save.
  Expected: each page has its **own** Save button; saving one page only writes that page's fields. (No single
  global "Save All" bar anymore.)

- [ ] **A made-up settings URL doesn't break anything.**
  Steps: visit `/admin/settings/does-not-exist`.
  Expected: you're sent back to the Settings landing page (no crash, no blank screen).

- [ ] **Admin-only settings stay admin-only — by link AND by URL. _(needs a non-admin login)_**
  Steps: as a **non-admin**, open Settings (if your role can) and note which settings are listed; then try to
  open an admin-only one directly by URL (e.g. `/admin/settings/team`, `/admin/settings/statuses`,
  `/admin/settings/email`).
  Expected: admin-only settings are **not listed** for them, and typing the URL bounces them back to the
  Settings landing page rather than opening the page.

- [ ] **Branding settings were intentionally removed — confirm you don't need them.**
  Steps: there is no longer a Branding page. The old Branding tab edited the homepage **Hero Headline**,
  **Hero Subheadline**, and a **Maintenance Mode** toggle.
  Expected: confirm you're OK losing the **in-admin editor** for the hero text. _(The hero text still shows on
  the public homepage from its saved values; it just can't be edited from admin anymore. Maintenance Mode was
  not wired to anything, so losing its toggle has no effect.)_ If you DO want to edit hero text again, flag it
  — it needs a small page added back.

### Command Center dashboard (customizable + month filter)

- [ ] **The dashboard shows real KPIs, not placeholder numbers.**
  Steps: open the **Dashboard** (Command Center) and read the KPI tiles (Total GP, Total Units, New Apps
  Today, Approvals, Valuations Done, Client Deposits, Closed Deals, Pending Apps, Avg Yield, Total Turnover).
  Expected: the numbers match what you'd expect from real deals/applications — spot-check one or two against
  Finance / Deal Desk. Nothing is a fixed or obviously fake figure.

- [ ] **The period (month) filter changes the figures.**
  Steps: use the period dropdown at the top right. Switch between **this month**, a **previous month**, and
  **Overall (All-Time)**.
  Expected: the period-based KPIs recompute for the chosen month; the subtitle shows the selected period.
  ("New Apps Today" always shows **today's** count regardless of period — that's intended.)

- [ ] **Empty / quiet periods don't break the dashboard.**
  Steps: pick a past month with little or no activity (or use a fresh environment).
  Expected: tiles read **0** (or **R 0**), "Avg Yield" doesn't error, the "Requires Action" panel shows
  **"Inbox Zero"** — no crash, no blank page, no `NaN`.

- [ ] **You can customize which widgets show, their size, and their order — and it sticks.**
  Steps: click **Customize**. Use **Show / Hide widgets** to hide one, click a widget's **size** icon to
  resize it, and **drag** a widget to reorder. Click **Done**, then **reload** the page.
  Expected: your hidden/resized/reordered layout is exactly as you left it after reload. Layout is **per-user**
  (your changes don't affect anyone else).

- [ ] **Reset restores the default layout.**
  Steps: in Customize mode click **Reset**.
  Expected: all widgets return to their default visibility, size and order.

- [ ] **The action panels still work.**
  Steps: check **Requires Action** (urgent leads) and **Lead & Communication Activity (Today)**; click a few
  of their links/buttons.
  Expected: the urgent-leads list and today's volume/leads/apps figures show; the links open the right pages
  (Pipeline, Finance, Lead Analytics).

**How to roll back (Phase 7):** all three changes are revertable on the branch with no database impact.
- **Dashboard:** layout customizations are per-user localStorage; reverting the dashboard commit restores the
  old dashboard and the saved layouts simply stop being read.
- **Settings-as-pages:** revert the settings commit to bring back the tabbed Settings page.
- **Nav/CRM:** revert the nav commit to restore the CRM and Email-Templates nav items and the CRM route.

---

## Phase 8 — Deal Desk unified (stock-in docs, guided stage flow + in-desk finalize, Ledger merge)

> Theme: fold the back-office finance flow into a single place. Three commits — a per-vehicle
> **stock-in documents** checklist, an **embedded finalize + guided stage flow** inside the Deal Desk
> drawer, and the **Deal Ledger merged** into the Deal Desk as two tabs. The one rule throughout:
> **profit math is never recomputed here** — `deal_records.gross_profit`, written at Finalize time,
> stays the single authoritative number, and `finance_applications.status` is never touched by the
> deal-stage track.

### Stock-in documents checklist (per vehicle)

- [ ] **[needs migration]** Every car tracks its required documents.
  Steps: open **Inventory**, edit a real (non-sourcing) vehicle, open the new **Documents** tab; also open
  the **Stock-In** modal and check its new **Docs** tab. Migration:
  `supabase/migrations/20260627151500_vehicle_stock_docs.sql`.
  Expected: four slots — **NATIS copy, purchase invoice, inspection/roadworthy, service history** — each
  showing **Missing / Uploaded / Not needed**. Setting a status or uploading a file persists across reload.

- [ ] **The checklist is additive and warn-only — it NEVER blocks anything.**
  Steps: leave one or more documents **Missing**, then go to the Deal Desk drawer's **Stage** tab for a deal
  on that car and try to **Finalize**.
  Expected: you see an **amber warning** ("car not fully stocked, N documents outstanding") but the
  **Finalize button still works**. No document state ever disables finalize, delivery, or stage advance.

- [ ] **Per-car override works and uploads are private.**
  Steps: mark a slot **Not needed**; upload a file to another slot and click to view it.
  Expected: "Not needed" no longer counts as outstanding; uploaded files open via a short-lived signed URL
  (documents bucket). A failed row write rolls back the orphaned upload.

### Guided stage flow + in-desk finalize

- [ ] **The drawer opens on a guided Stage bar.**
  Steps: open any deal in the **Deal Desk**.
  Expected: a 5-step bar — **Contract signed → ① Stock the car → ② Finalize → ③ Delivery & NATIS → ④ Cleared**
  — with done steps green, the current step highlighted. The **Stage** tab is the default; Overview / Cost
  Sheet / Checklist / Delivery / Activity are all still present and unchanged.

- [ ] **Finalize happens in place and ENRICHES the existing draft (no duplicate row).**
  Steps: open a **draft awaiting finalize** (admin-only), on the Stage tab click **Finalize this deal**,
  complete the calculator, save.
  Expected: the embedded calculator is the same FinalizeDealModal; on save it **updates the existing
  `deal_records` row by id** — it does **not** create a second row. Spot-check: the deal count for that
  application stays the same; the `deal_records_application_id_unique` index is not violated.

- [ ] **Finalizing advances the stage without corrupting the finance status.**
  Steps: after finalizing, watch the Stage bar; then check the deal in **Finance / Pipeline**.
  Expected: the bar moves forward to **③ Delivery & NATIS** (deal-stage → `in_delivery`); the deal's
  **finance application status is unchanged**. The two tracks stay parallel.

- [ ] **Delivery and NATIS advance the stage forward only (never backward).**
  Steps: mark **Delivery ready**, then **NATIS sent** (drawer Delivery tab or the Delivery board).
  Expected: stage goes **delivered → cleared**; re-saving or toggling never moves the stage backward, and a
  failed stage write is non-fatal (the underlying delivery/NATIS save still succeeds).

- [ ] **Profit is never recomputed by stage actions.**
  Steps: advance a finalized deal through delivery/NATIS and re-open it.
  Expected: **gross profit is identical** before and after every stage change. Only Finalize sets profit.

### Deal Ledger merged into Deal Desk

- [ ] **The old Deal Ledger lives inside Deal Desk with no lost features.**
  Steps: open **Deal Desk** → **Ledger / Profit** and **Customer Follow-ups** tabs.
  Expected: everything the old `/admin/aftersales` page had is present — **month-grouped profit totals,
  performance bar, commission boards, lock / undo, PDF export, and the customer service / trade-in
  follow-ups** table. Figures read the same authoritative `gross_profit` — **no second/ drifting profit
  number** is introduced.

- [ ] **The Deal Ledger nav item is gone and the old URL redirects.**
  Steps: scan the sidebar **Money** group; in the address bar visit `/admin/aftersales`; press **⌘K / Ctrl-K**
  and search "ledger" / "follow-ups".
  Expected: **no** standalone "Deal Ledger" sidebar item; `/admin/aftersales` **redirects to**
  `/admin/deal-desk` (no 404, no blank); the palette surfaces **Deal Desk** for ledger/aftersales/follow-up
  keywords.

- [ ] **Legacy `deal_ledger`-only roles are NOT stranded by the merge. _(needs a non-admin login)_**
  Steps: log in as a non-admin whose role holds the legacy **Deal Ledger** access but **not** Deal Desk; open
  `/admin/aftersales` and `/admin/deal-desk` directly.
  Expected: you reach the **merged Deal Desk** page — never bounced back and forth, never a blank screen.
  _(Gating fix, mirroring the Phase-7 CRM fix: `/admin/deal-desk` admits **either** `deal_desk` **or**
  `deal_ledger`, and the `deal_ledger` section's home now points at Deal Desk.)_

**How to roll back (Phase 8):** revert the three Deal Desk commits.
- **Stock docs:** the `vehicle_stock_docs` table is additive and unread by anything else — leaving it applied
  is harmless; reverting the commits just stops the checklist UI from rendering.
- **Stage flow / finalize:** purely a presentation layer over the existing `deal_stage` column — no schema
  change in these commits. Reverting restores the prior drawer.
- **Ledger merge:** reverting restores the standalone `/admin/aftersales` page and its nav item.

---

## Final sign-off

- [ ] All boxes above checked, or any exceptions noted (especially **[needs migration]** items).
- [ ] Phase 3 flag is left in the state you want for go-live (**OFF** until you're ready to use the
      auto-draft flow).
- [ ] No console errors or broken pages encountered during the walkthrough.

**Owner sign-off:** _______________________  **Date:** ______________
