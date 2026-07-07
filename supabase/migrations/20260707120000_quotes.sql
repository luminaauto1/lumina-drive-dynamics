-- Quotation records.
-- Mirrors public.otps: settings (company details, vat_registered flag, quote ref
-- sequence, sales executive) reuse the existing site_settings.document_settings JSON
-- blob — no separate quote_settings table is created here on purpose, to avoid
-- duplicating company config.

create table if not exists public.quotes (
  id          uuid primary key default gen_random_uuid(),
  ref         text unique not null,            -- LA-Q-NNNN (no year)
  data        jsonb not null,                  -- full QuoteData snapshot
  client_name text,
  vehicle     text,                            -- "Make Model Year"
  total       numeric,                         -- grand total due
  valid_until date,                            -- quote expiry date
  status      text not null default 'draft',   -- draft | sent | accepted | expired
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.quotes is 'Quotation documents (Quote Builder). Mirrors public.otps; full QuoteData snapshot in data jsonb.';
comment on column public.quotes.ref is 'Human-facing quote number, e.g. LA-Q-0147 (4-digit, no year).';
comment on column public.quotes.data is 'Full QuoteData snapshot rendered by the quote document.';
comment on column public.quotes.total is 'Grand total due (retail + accessories + value added products), denormalised for list views.';
comment on column public.quotes.valid_until is 'Quote expiry date, denormalised for list views.';
comment on column public.quotes.status is 'Lifecycle status: draft | sent | accepted | expired.';

create index if not exists quotes_created_at_idx on public.quotes (created_at desc);

alter table public.quotes enable row level security;

-- Authenticated staff read/write (page access is gated in-app by ProtectedRoute);
-- only admins may delete. Consistent with public.otps and the other admin tables.
drop policy if exists "Staff can view quotes" on public.quotes;
create policy "Staff can view quotes"   on public.quotes for select to authenticated using (true);

drop policy if exists "Staff can insert quotes" on public.quotes;
create policy "Staff can insert quotes" on public.quotes for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "Staff can update quotes" on public.quotes;
create policy "Staff can update quotes" on public.quotes for update to authenticated using (true) with check (true);

drop policy if exists "Admins can delete quotes" on public.quotes;
create policy "Admins can delete quotes" on public.quotes for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- keep updated_at fresh on edits
create or replace function public.quotes_touch_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists quotes_touch on public.quotes;
create trigger quotes_touch before update on public.quotes
for each row execute function public.quotes_touch_updated_at();
