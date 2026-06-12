// ============================================================================
// MIGRATION BRIDGE (temporary) — deploy into the NEW (self-owned) project.
//
// Pulls storage objects from the OLD (Lovable Cloud) project using signed
// URLs minted by its migrate-export function, and uploads them into the same
// bucket/path here using this project's auto-injected service role key.
//
// Security:
//   - Guarded by a one-time secret stored in the RLS-locked table
//     `public._migration_secret` (no policies — only service role can read it;
//     PostgREST does not expose custom schemas, hence a public-schema table).
//     Fail-closed.
//   - Only downloads from URLs on the configured source host.
//   - DELETE THIS FUNCTION (and the _migration_secret table) after migration.
//
// Request (POST JSON):
//   { key, sourceHost, bucket, objects: [{ path, signedUrl }] }
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let body: {
    key?: string;
    sourceHost?: string;
    bucket?: string;
    objects?: { path: string; signedUrl: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // Fail-closed: secret must exist in the RLS-locked migration table and match.
  const { data: secretRow, error: secretErr } = await admin
    .from("_migration_secret")
    .select("value")
    .limit(1)
    .maybeSingle();
  if (secretErr || !secretRow?.value) return json({ error: "migration secret not configured" }, 500);
  if (!body.key || body.key !== secretRow.value) return json({ error: "Forbidden" }, 403);

  const sourceHost = String(body.sourceHost ?? "");
  const bucket = String(body.bucket ?? "");
  const objects = body.objects ?? [];
  if (!sourceHost || !bucket || objects.length === 0) {
    return json({ error: "sourceHost, bucket, and objects are required" }, 400);
  }

  const results: { path: string; ok: boolean; error?: string; size?: number }[] = [];
  for (const obj of objects) {
    try {
      const url = new URL(obj.signedUrl);
      if (url.host !== sourceHost) throw new Error(`URL host ${url.host} != expected ${sourceHost}`);
      const res = await fetch(obj.signedUrl);
      if (!res.ok) throw new Error(`download HTTP ${res.status}`);
      const blob = await res.blob();
      const { error } = await admin.storage.from(bucket).upload(obj.path, blob, {
        upsert: true,
        contentType: res.headers.get("content-type") ?? undefined,
      });
      if (error) throw new Error(error.message);
      results.push({ path: obj.path, ok: true, size: blob.size });
    } catch (e) {
      results.push({ path: obj.path, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const failed = results.filter((r) => !r.ok);
  return json({ copied: results.length - failed.length, failed });
});
