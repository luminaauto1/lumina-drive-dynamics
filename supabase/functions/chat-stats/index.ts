// chat-stats — dashboard numbers (port of lumina-chat/api/stats.js).
// Fast read of the latest stats_snapshot + live open-escalation count +
// responder run/reply counters. Auth: staff JWT or internal key.
// deno-lint-ignore-file no-explicit-any

import { svc, getChatConfig } from "../_shared/chat/kb.ts";
import { requireStaff, corsHeaders } from "../_shared/chat/authz.ts";

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const guard = await requireStaff(req, cors);
  if (guard) return guard;

  try {
    const db = svc();
    const cfg = await getChatConfig();
    const [{ data: snap }, { count: openEsc }, { data: lastRun }, { count: learned }, { count: replies24 }] = await Promise.all([
      db.from("stats_snapshot").select("data,created_at").order("created_at", { ascending: false }).limit(1),
      db.from("escalation_queue").select("id", { count: "exact", head: true }).eq("status", "open"),
      db.from("run_log").select("*").order("started_at", { ascending: false }).limit(1),
      db.from("learned_reply").select("id", { count: "exact", head: true }).eq("active", true),
      db.from("reply_log").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 24 * 3.6e6).toISOString()),
    ]);

    const base = snap && snap.length
      ? { ...snap[0].data, snapshotAt: snap[0].created_at, source: "snapshot" }
      : { total: 0, read: 0, unread: 0, tags: {}, credit: {}, licence: {}, income: {}, journey: {}, snapshotAt: null, source: "none" };

    return json(cors, 200, {
      ok: true,
      stats: {
        ...base,
        openEscalations: openEsc || 0,
        learnedReplies: learned || 0,
        decisionsLast24h: replies24 || 0,
        lastRun: lastRun && lastRun.length ? lastRun[0] : null,
        dryRun: cfg.dry_run,
        responderActive: cfg.active,
        esTokenConfigured: !!cfg.es_token,
      },
    });
  } catch (e) {
    return json(cors, 500, { ok: false, error: (e as Error).message });
  }
});

function json(cors: Record<string, string>, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
