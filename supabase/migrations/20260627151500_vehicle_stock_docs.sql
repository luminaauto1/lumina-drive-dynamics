-- Per-vehicle stock-in documents checklist.
-- Every car brought into stock tracks a fixed set of required documents
-- (NATIS copy, purchase invoice, inspection/DEKRA + roadworthy, service history).
-- Each row is one doc slot for one vehicle, with a status the owner can override
-- to 'not_needed' per car. Policy: WARN, never block — purely informational tracking.

create table if not exists public.vehicle_stock_docs (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  doc_key     text not null,                  -- natis | invoice | inspection | service_history
  status      text not null default 'missing'
                check (status in ('missing','uploaded','not_needed')),
  file_path   text,                           -- storage path in the 'documents' bucket (when uploaded)
  note        text,
  updated_at  timestamptz not null default now(),
  unique (vehicle_id, doc_key)
);

create index if not exists vehicle_stock_docs_vehicle_id_idx
  on public.vehicle_stock_docs (vehicle_id);

alter table public.vehicle_stock_docs enable row level security;

-- Authenticated staff read/write (page access is gated in-app by ProtectedRoute);
-- only admins may delete. Consistent with the other admin tables (e.g. otps).
drop policy if exists "Staff can view vehicle stock docs" on public.vehicle_stock_docs;
create policy "Staff can view vehicle stock docs"
  on public.vehicle_stock_docs for select to authenticated using (true);

drop policy if exists "Staff can insert vehicle stock docs" on public.vehicle_stock_docs;
create policy "Staff can insert vehicle stock docs"
  on public.vehicle_stock_docs for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "Staff can update vehicle stock docs" on public.vehicle_stock_docs;
create policy "Staff can update vehicle stock docs"
  on public.vehicle_stock_docs for update to authenticated using (true) with check (true);

drop policy if exists "Admins can delete vehicle stock docs" on public.vehicle_stock_docs;
create policy "Admins can delete vehicle stock docs"
  on public.vehicle_stock_docs for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- keep updated_at fresh on edits
create or replace function public.vehicle_stock_docs_touch_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vehicle_stock_docs_touch on public.vehicle_stock_docs;
create trigger vehicle_stock_docs_touch before update on public.vehicle_stock_docs
for each row execute function public.vehicle_stock_docs_touch_updated_at();
