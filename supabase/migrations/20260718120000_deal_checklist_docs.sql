-- Deal Desk: 3-section configurable checklist (Car Preparation / Delivery
-- Preparation / Payout) with per-item status + document uploads.
-- Item CONFIG lives in site_settings.document_settings.dealChecklistConfig;
-- this table stores the per-deal STATE (one row per deal + section + item).
-- The old 1-row deal_checklist table is untouched (still used for
-- delivery_ready / pickup_or_delivery); its 8 step columns are simply no
-- longer written by the rebuilt Checklist tab — fresh start, no data migration.

create table if not exists public.deal_checklist_docs (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references public.deal_records(id) on delete cascade,
  section    text not null,   -- car_prep | delivery_prep | payout (config-driven)
  item_key   text not null,   -- item key from document_settings.dealChecklistConfig
  status     text not null default 'not_started'
               check (status in ('not_started','requested','in_progress','done','not_applicable')),
  file_path  text,            -- storage path in the 'documents' bucket (when uploaded)
  file_name  text,            -- original file name, for display
  updated_by uuid,
  updated_at timestamptz default now(),
  unique (deal_id, section, item_key)
);

create index if not exists deal_checklist_docs_deal_id_idx
  on public.deal_checklist_docs (deal_id);

alter table public.deal_checklist_docs enable row level security;

-- RLS mirrors deal_checklist (20260622130000): Deal Desk staff only
-- (admin + senior_f_and_i via can_deal_desk()).
drop policy if exists "deal_checklist_docs select" on public.deal_checklist_docs;
create policy "deal_checklist_docs select"
  on public.deal_checklist_docs for select to authenticated
  using (public.can_deal_desk());

drop policy if exists "deal_checklist_docs write" on public.deal_checklist_docs;
create policy "deal_checklist_docs write"
  on public.deal_checklist_docs for all to authenticated
  using (public.can_deal_desk()) with check (public.can_deal_desk());

-- keep updated_at fresh on edits (same pattern as vehicle_stock_docs)
create or replace function public.deal_checklist_docs_touch_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists deal_checklist_docs_touch on public.deal_checklist_docs;
create trigger deal_checklist_docs_touch before update on public.deal_checklist_docs
for each row execute function public.deal_checklist_docs_touch_updated_at();

-- Storage: checklist files live in the private 'documents' bucket under
-- deal/{dealId}/checklist/{section}/{itemKey}/... . The bucket's base policies
-- (20260613120500) are admin-only; extend read/upload/update to Deal Desk staff
-- for the deal/ prefix ONLY, so senior F&I can attach and view checklist docs.
-- Additive + idempotent; admin access is unchanged.
drop policy if exists "Deal desk read deal documents" on storage.objects;
create policy "Deal desk read deal documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents' and name like 'deal/%' and public.can_deal_desk());

drop policy if exists "Deal desk upload deal documents" on storage.objects;
create policy "Deal desk upload deal documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and name like 'deal/%' and public.can_deal_desk());

drop policy if exists "Deal desk update deal documents" on storage.objects;
create policy "Deal desk update deal documents"
  on storage.objects for update to authenticated
  using (bucket_id = 'documents' and name like 'deal/%' and public.can_deal_desk())
  with check (bucket_id = 'documents' and name like 'deal/%' and public.can_deal_desk());

-- Delete too (deal/ prefix only): the upload hooks roll the storage object back
-- when the DB row write fails after a successful upload — without this, that
-- cleanup silently no-ops for senior F&I and orphans the object. Admin-wide
-- delete (20260613120500) is unchanged.
drop policy if exists "Deal desk delete deal documents" on storage.objects;
create policy "Deal desk delete deal documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and name like 'deal/%' and public.can_deal_desk());
