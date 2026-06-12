#!/usr/bin/env node
// ============================================================================
// Migration smoke test: frontend env -> Supabase REST / Auth / Storage ->
// Edge Functions.
//
// Run before AND after the Vercel cutover:
//   npm run test:connection
//
// Reads the same .env the Vite build uses, so it validates exactly what the
// deployed frontend will be configured with. Uses only the anon key — safe to
// run from anywhere; RLS still applies.
// ============================================================================
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// --- minimal .env loader (no dotenv dependency) -----------------------------
function loadEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...loadEnv(resolve(process.cwd(), ".env")), ...process.env };
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

let failures = 0;
const ok = (name, detail = "") => console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
const fail = (name, detail) => {
  failures++;
  console.error(`  ❌ ${name} — ${detail}`);
};

async function check(name, fn) {
  try {
    await fn();
  } catch (e) {
    fail(name, e.message);
  }
}

console.log("Lumina Drive Dynamics — Supabase connectivity test\n");

// 1. Env vars present and well-formed (what the Vite build will inline).
if (!SUPABASE_URL) fail("env: VITE_SUPABASE_URL", "missing — copy .env.example to .env");
else ok("env: VITE_SUPABASE_URL", SUPABASE_URL);
if (!ANON_KEY) fail("env: anon key", "missing VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY");
else ok("env: anon key", `${ANON_KEY.slice(0, 12)}…`);
if (failures) {
  console.error("\nEnvironment incomplete — aborting network checks.");
  process.exit(1);
}

const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };

// 2. Auth service health (also proves DNS + TLS to the project).
await check("auth: /auth/v1/health", async () => {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  ok("auth: /auth/v1/health", `HTTP ${r.status}`);
});

// 3. REST (PostgREST) with the anon key — the exact path every CRM read uses.
await check("rest: /rest/v1/", async () => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers });
  if (r.status === 401 || r.status === 403) throw new Error(`anon key rejected (HTTP ${r.status})`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  ok("rest: anon key accepted", `HTTP ${r.status}`);
});

// 4. RLS-visible public data: site_settings backs the public site chrome.
//    A 200 (even with zero rows) proves PostgREST + RLS policies respond.
await check("rest: site_settings query", async () => {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/site_settings?select=id&limit=1`,
    { headers },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`);
  ok("rest: site_settings query", `HTTP ${r.status}`);
});

// 5. Edge functions gateway. CORS preflights are unauthenticated, so an
//    OPTIONS 200/204 proves the function is deployed and reachable without
//    needing any secret. create-lead is the public lead-capture entrypoint.
for (const fn of ["create-lead", "submit-finance-app", "create-sell-request"]) {
  await check(`edge fn: ${fn} (preflight)`, async () => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://lumina-drive-dynamics.vercel.app",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type, x-lumina-key",
      },
    });
    if (r.status >= 400) throw new Error(`HTTP ${r.status} — function missing or not deployed`);
    ok(`edge fn: ${fn}`, `preflight HTTP ${r.status}`);
  });
}

// 6. Storage gateway (client document / sell-car photo uploads go through it).
await check("storage: /storage/v1", async () => {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, { headers });
  const body = await r.text();
  // Anon may be denied the bucket LIST (that's fine) — any JSON response
  // short of a 5xx proves the storage API is up. A corporate/sandbox egress
  // proxy 403 ("not in allowlist") is a local network problem, not Supabase.
  if (body.includes("allowlist")) throw new Error("blocked by local network egress policy");
  if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
  ok("storage: gateway reachable", `HTTP ${r.status}`);
});

console.log(
  failures
    ? `\n${failures} check(s) failed — fix before deploying to Vercel.`
    : "\nAll connectivity checks passed — safe to deploy.",
);
process.exit(failures ? 1 : 0);
