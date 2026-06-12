// ============================================================================
// MIGRATION BRIDGE (temporary) — deploy into the OLD (Lovable Cloud) project.
//
// Purpose: Lovable Cloud exposes no connection string, pg_dump, or dashboard,
// but edge functions running INSIDE the project receive SUPABASE_DB_URL and
// SUPABASE_SERVICE_ROLE_KEY from the platform. This function uses that inside
// position to hand the data over the wall, in JSON batches, to the new
// self-owned Supabase project.
//
// Security:
//   - Fail-closed shared-secret guard: every request must carry
//     `x-migration-key` matching the LUMINA_INTERNAL_API_KEY secret that is
//     already configured in this project.
//   - Read-only: this function never writes to the source database.
//   - DELETE THIS FUNCTION after the migration is verified.
//
// Actions (POST JSON):
//   {action:"inventory"}                          -> tables + row counts, buckets, auth count
//   {action:"dump-table", table, offset?, limit?} -> {rows:[...], done:bool}
//   {action:"dump-auth",  offset?, limit?}        -> {users:[...], identities:[...]}
//   {action:"list-storage", bucket, offset?, limit?} -> {objects:[{path, signedUrl, ...}]}
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-migration-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Only tables in these schemas may be dumped; everything else is refused.
const ALLOWED_SCHEMAS = ["public"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // --- fail-closed auth gate -------------------------------------------------
  const expected = Deno.env.get("LUMINA_INTERNAL_API_KEY");
  if (!expected || expected.trim() === "") {
    return json({ error: "LUMINA_INTERNAL_API_KEY not configured — refusing (fail-closed)" }, 500);
  }
  if (req.headers.get("x-migration-key") !== expected) {
    return json({ error: "Forbidden" }, 403);
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const action = String(body.action ?? "");
  const limit = Math.min(Number(body.limit ?? 500), 1000);
  const offset = Math.max(Number(body.offset ?? 0), 0);

  // Direct Postgres connection: the only way to read auth.users (with
  // password hashes) and to read tables without RLS interference. `max: 1`
  // because each invocation is short-lived; the platform pools upstream.
  const sql = dbUrl ? postgres(dbUrl, { max: 1, prepare: false }) : null;

  try {
    switch (action) {
      case "inventory": {
        if (!sql) return json({ error: "SUPABASE_DB_URL not available in this runtime" }, 500);
        const tables = await sql`
          select schemaname as schema, relname as table, n_live_tup as approx_rows
          from pg_stat_user_tables
          where schemaname = any(${ALLOWED_SCHEMAS})
          order by relname`;
        // Exact counts (tables here are small; approx counts can be stale)
        const exact: Record<string, number> = {};
        for (const t of tables) {
          const [{ c }] = await sql.unsafe(
            `select count(*)::int as c from ${quoteIdent(t.schema)}.${quoteIdent(t.table)}`,
          );
          exact[t.table] = c;
        }
        const [{ c: authUsers }] = await sql`select count(*)::int as c from auth.users`;
        const buckets = await sql`
          select b.id, b.name, b.public, count(o.id)::int as objects
          from storage.buckets b left join storage.objects o on o.bucket_id = b.id
          group by b.id, b.name, b.public order by b.id`;
        return json({ tables: exact, auth_users: authUsers, buckets });
      }

      case "dump-table": {
        if (!sql) return json({ error: "SUPABASE_DB_URL not available in this runtime" }, 500);
        const table = String(body.table ?? "");
        const schema = String(body.schema ?? "public");
        if (!ALLOWED_SCHEMAS.includes(schema)) return json({ error: "schema not allowed" }, 400);
        if (!/^[a-z_][a-z0-9_]*$/.test(table)) return json({ error: "bad table name" }, 400);
        // Deterministic order so offset pagination never skips/duplicates rows
        const rows = await sql.unsafe(
          `select row_to_json(t) as r
           from (select * from ${quoteIdent(schema)}.${quoteIdent(table)} order by 1) t
           offset ${offset} limit ${limit}`,
        );
        return json({ rows: rows.map((x: { r: unknown }) => x.r), done: rows.length < limit });
      }

      case "dump-auth": {
        if (!sql) return json({ error: "SUPABASE_DB_URL not available in this runtime" }, 500);
        // Full rows including encrypted_password (bcrypt) so users keep their
        // passwords after migration. Identities preserve OAuth links.
        const users = await sql.unsafe(
          `select row_to_json(u) as r from (select * from auth.users order by created_at) u
           offset ${offset} limit ${limit}`,
        );
        const identities = await sql.unsafe(
          `select row_to_json(i) as r from (select * from auth.identities order by created_at) i
           offset ${offset} limit ${limit}`,
        );
        return json({
          users: users.map((x: { r: unknown }) => x.r),
          identities: identities.map((x: { r: unknown }) => x.r),
          done: users.length < limit && identities.length < limit,
        });
      }

      case "list-storage": {
        if (!supabaseUrl || !serviceKey) return json({ error: "service credentials unavailable" }, 500);
        const bucket = String(body.bucket ?? "");
        const admin = createClient(supabaseUrl, serviceKey);
        const { data: objects, error } = await admin.storage.from(bucket).list("", {
          limit,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
        if (error) return json({ error: error.message }, 500);
        // Recurse one level is not enough for nested folders — callers should
        // use the `prefix` param to walk folders (folders come back with null id)
        const prefix = String(body.prefix ?? "");
        const listed = prefix
          ? (await admin.storage.from(bucket).list(prefix, { limit, offset })).data ?? []
          : objects ?? [];
        const result = [];
        for (const o of listed) {
          const path = prefix ? `${prefix}/${o.name}` : o.name;
          if (o.id === null) {
            result.push({ path, folder: true });
            continue;
          }
          const { data: signed } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24);
          result.push({ path, size: o.metadata?.size ?? null, contentType: o.metadata?.mimetype ?? null, signedUrl: signed?.signedUrl ?? null });
        }
        return json({ objects: result, done: listed.length < limit });
      }

      default:
        return json({ error: `unknown action "${action}"` }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  } finally {
    if (sql) await sql.end({ timeout: 2 });
  }
});

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}
