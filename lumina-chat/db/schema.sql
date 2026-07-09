-- =====================================================================
-- schema.sql  —  Lumina Auto standalone WhatsApp chat responder
-- Target: Supabase (PostgreSQL). Run in the Supabase SQL editor, or via
--   supabase db push / psql. Then run seed.sql to load the knowledge base.
--
-- Design notes
--  * KB tables (quick_reply, wa_template, funnel_node, intent, escalation_rule,
--    business_rule, lead_tag) hold the "brain" mined from your real chats.
--  * Operational tables (conversation_state, reply_log, escalation_queue,
--    run_log) track live activity so nothing is answered twice and every
--    auto-reply is auditable.
--  * No AI. The engine is deterministic regex/keyword + funnel state.
-- =====================================================================

-- ---------- KNOWLEDGE BASE ----------

create table if not exists quick_reply (
  id         bigint generated always as identity primary key,
  keyword    text not null unique,           -- the "/shortcut" in EasySocial
  message    text not null,                  -- exact canned answer (agent's words)
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists wa_template (
  id           bigint generated always as identity primary key,
  template_id  bigint not null unique,        -- EasySocial / WhatsApp template id
  name         text not null,
  category     text,                          -- opener | reminder | status | closer | advice | ops | info
  body         text not null,
  buttons      jsonb not null default '[]',   -- array of button titles
  usage_count  int not null default 0,        -- how often it was used in the sample
  active       boolean not null default true
);

create table if not exists funnel_node (
  id        bigint generated always as identity primary key,
  code      text not null unique,             -- start | licence | credit | timeline | income | ...
  question  text not null,                    -- the interactive message body
  options   jsonb not null default '[]'       -- [{title, next, set:{...}}]
);

create table if not exists intent (
  id        bigint generated always as identity primary key,
  name      text not null unique,
  priority  int  not null,                    -- lower = evaluated first
  action    text not null,                    -- qr | template | funnel | escalate
  target    text,                             -- quick_reply.keyword OR funnel code OR template name
  patterns  jsonb not null default '[]',      -- array of lowercase regex fragments (OR-ed)
  min_hits  int not null default 1,           -- distinct pattern groups required to fire
  note      text,
  active    boolean not null default true
);

create table if not exists escalation_rule (
  id       bigint generated always as identity primary key,
  name     text not null unique,
  reason   text not null,
  patterns jsonb not null default '[]',
  hard     boolean not null default false,
  active   boolean not null default true
);

create table if not exists business_rule (
  key   text primary key,
  value jsonb not null
);

create table if not exists lead_tag (
  id           bigint generated always as identity primary key,
  name         text not null unique,
  meaning      text,
  sample_count int not null default 0
);


-- Ordered multi-message human flows (e.g. credit diagnostic: ask "why is your
-- score low?" then "/arrears" before advising). steps = quick_reply keywords.
create table if not exists reply_sequence (
  id     bigint generated always as identity primary key,
  name   text not null unique,
  steps  jsonb not null default '[]',
  note   text,
  active boolean not null default true
);

-- ---------- LIVE / OPERATIONAL ----------

-- One row per lead (WhatsApp contact). Mirrors what we know from EasySocial
-- lead fields + funnel answers so the engine has full context per person.
create table if not exists conversation_state (
  lead_id              bigint primary key,     -- EasySocial lead id
  phone                text,
  name                 text,
  licence              text,                   -- yes | no | learners | unknown
  credit               text,                   -- good | improving | unsure | debt_review | missed | none | unknown
  income               text,                   -- yes | no | complicated | unknown
  timeline             text,                   -- asap | month | later | unknown
  funnel_node          text default 'start',   -- where they are in the funnel
  tags                 jsonb not null default '[]',
  last_user_message_at timestamptz,            -- drives the 24h window
  last_bot_reply_at    timestamptz,
  last_inbound_text    text,
  answered             boolean not null default false,
  escalated            boolean not null default false,
  updated_at           timestamptz not null default now()
);

-- Every decision the engine makes (auto-send OR dry-run OR escalate) is logged.
create table if not exists reply_log (
  id             bigint generated always as identity primary key,
  lead_id        bigint,
  phone          text,
  inbound_text   text,
  matched_intent text,
  action         text,                         -- qr | template | funnel | escalate | none
  reply_ref      text,                         -- keyword / template_id / funnel code
  outbound_text  text,
  confidence     numeric,                      -- 0..1
  within_window  boolean,                      -- was it inside the 24h window
  status         text not null default 'planned', -- planned | sent | dry_run | skipped | error | escalated
  error          text,
  created_at     timestamptz not null default now()
);

-- Anything the engine is NOT confident about lands here for a human.
create table if not exists escalation_queue (
  id           bigint generated always as identity primary key,
  lead_id      bigint,
  phone        text,
  name         text,
  inbound_text text,
  reason       text,                            -- which escalation_rule / low_confidence / no_match
  chat_url     text,                            -- deep link to the chat in EasySocial
  status       text not null default 'open',    -- open | handled | dismissed
  created_at   timestamptz not null default now(),
  handled_at   timestamptz,
  handled_by   text
);

-- One row per "press the button" / scheduled run.
create table if not exists run_log (
  id            bigint generated always as identity primary key,
  run_type      text not null default 'batch',  -- batch | realtime | test
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  chats_scanned int not null default 0,
  replied       int not null default 0,
  escalated     int not null default 0,
  skipped       int not null default 0,
  errors        int not null default 0,
  dry_run       boolean not null default true,
  notes         text
);

-- ---------- INDEXES ----------
create index if not exists idx_reply_log_lead     on reply_log(lead_id);
create index if not exists idx_reply_log_created  on reply_log(created_at);
create index if not exists idx_escq_status        on escalation_queue(status);
create index if not exists idx_convstate_answered on conversation_state(answered);
create index if not exists idx_intent_priority    on intent(priority);


-- Human-taught answers from the dashboard (exact-message memory). When the bot
-- was unsure and a human typed an answer, we store it here and reuse it verbatim
-- next time the same message arrives. Deterministic — match_key is a normalized
-- form of the inbound text (lowercase, punctuation/emoji stripped, spaces collapsed).
create table if not exists learned_reply (
  id             bigint generated always as identity primary key,
  match_key      text not null unique,
  sample_inbound text,
  message        text not null,
  created_by     text,
  hits           int not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz
);
create index if not exists idx_learned_key on learned_reply(match_key);


-- Point-in-time dashboard numbers (written by /api/refresh-stats, read by /api/stats).
create table if not exists stats_snapshot (
  id         bigint generated always as identity primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_stats_created on stats_snapshot(created_at);

-- ---------- ROW LEVEL SECURITY ----------
-- These tables are only ever touched by the server (service-role key), never
-- from the browser. Enable RLS and add NO public policies => client is locked out.
alter table quick_reply        enable row level security;
alter table wa_template        enable row level security;
alter table funnel_node        enable row level security;
alter table intent             enable row level security;
alter table escalation_rule    enable row level security;
alter table business_rule      enable row level security;
alter table lead_tag           enable row level security;
alter table reply_sequence     enable row level security;
alter table conversation_state enable row level security;
alter table reply_log          enable row level security;
alter table escalation_queue   enable row level security;
alter table run_log            enable row level security;
alter table learned_reply      enable row level security;
alter table stats_snapshot     enable row level security;
-- (service-role bypasses RLS automatically; add authenticated-read policies
--  later if you build an internal dashboard.)
