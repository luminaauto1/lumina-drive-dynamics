-- Offer to Purchase (OTP) records.
-- Settings (company details, vat_registered flag, default fees, ref sequence, line
-- toggles) reuse the existing site_settings.document_settings JSON blob — no separate
-- otp_settings table is created here on purpose, to avoid duplicating company config.

create table if not exists public.otps (
  id          uuid primary key default gen_random_uuid(),
  ref         text unique not null,            -- OTP-YYYY-NNNN
  data        jsonb not null,                  -- full OtpData snapshot
  client_name text,
  vehicle     text,                            -- "Make Model Year"
  balance     numeric,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists otps_created_at_idx on public.otps (created_at desc);

alter table public.otps enable row level security;

-- Authenticated staff read/write (page access is gated in-app by ProtectedRoute);
-- only admins may delete. Consistent with the other admin tables.
drop policy if exists "Staff can view OTPs" on public.otps;
create policy "Staff can view OTPs"   on public.otps for select to authenticated using (true);

drop policy if exists "Staff can insert OTPs" on public.otps;
create policy "Staff can insert OTPs" on public.otps for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "Staff can update OTPs" on public.otps;
create policy "Staff can update OTPs" on public.otps for update to authenticated using (true) with check (true);

drop policy if exists "Admins can delete OTPs" on public.otps;
create policy "Admins can delete OTPs" on public.otps for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- keep updated_at fresh on edits
create or replace function public.otps_touch_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists otps_touch on public.otps;
create trigger otps_touch before update on public.otps
for each row execute function public.otps_touch_updated_at();
