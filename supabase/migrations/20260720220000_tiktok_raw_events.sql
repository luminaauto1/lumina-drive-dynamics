-- Verbatim capture of TikTok lead webhook deliveries.
--
-- Context: every TikTok lead delivery was being rejected with HTTP 400 because
-- tiktok-receiver looked for the answers under data.form_data / field_data,
-- while TikTok actually sends them in entry[].changes[{field, value}]. Nothing
-- recorded the payload, so the mismatch was invisible — the campaign happened
-- to be paused, which is the only reason no real leads were lost.
--
-- This table stores each delivery before any parsing, so that:
--   * the payload schema can be read off a real delivery rather than guessed;
--   * a lead we fail to parse can be replayed instead of dropped;
--   * TikTok's x-open-signature can be verified in shadow mode before it is
--     enforced (enforcing an unverified HMAC would silently drop every lead).
--
-- Applied to gkghazemorbxmzzcbaty on 2026-07-20; this migration mirrors that
-- into the repo so a `deploy-functions` run cannot reintroduce the old code
-- against a database missing the table.

create table if not exists public.tiktok_raw_events (
  id           uuid primary key default gen_random_uuid(),
  received_at  timestamptz not null default now(),
  method       text,
  headers      jsonb,
  query        jsonb,
  body_text    text,          -- source of truth, verbatim, always populated
  body_json    jsonb,         -- best effort; null when the body is not JSON
  parsed       boolean not null default false,
  lead_id      text,
  note         text,
  sig_ok       boolean,       -- null = header absent or no secret configured
  sig_variant  text           -- which HMAC construction matched ('raw' | 'escaped_unicode')
);

-- Older deployments may predate the signature columns.
alter table public.tiktok_raw_events
  add column if not exists sig_ok      boolean,
  add column if not exists sig_variant text;

create index if not exists tiktok_raw_events_received_at_idx
  on public.tiktok_raw_events (received_at desc);

alter table public.tiktok_raw_events enable row level security;

-- Deliberately NO policies. The edge function uses the service role, which
-- bypasses RLS. Raw rows contain unredacted lead PII plus TikTok's request
-- headers, so they must not be readable by ordinary authenticated sessions.

comment on table public.tiktok_raw_events is
  'Verbatim capture of TikTok lead webhook POSTs. Added 2026-07-20 to diagnose HTTP 400s from tiktok-receiver and to make failed deliveries replayable.';
comment on column public.tiktok_raw_events.sig_ok is
  'HMAC-SHA256 of the body vs the x-open-signature header, keyed on TIKTOK_APP_SECRET. null = header absent or no secret configured. Enforcement is off until this is uniformly true on real traffic.';
