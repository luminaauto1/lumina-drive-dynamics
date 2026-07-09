// chat-refresh-stats â€” recompute dashboard numbers from EasySocial and store a
// snapshot (port of lumina-chat/api/refresh-stats.js). Auth: staff or internal.
// deno-lint-ignore-file no-explicit-any

import { svc, getChatConfig } from "../_shared/chat/kb.ts";
import * as es from "../_shared/chat/easysocial.ts";
import { requireStaff, corsHeaders } from "../_shared/chat/authz.ts";

const inc = (o: any, k: any) => { k = (k == null || k === "") ? "(none)" : String(k).trim(); o[k] = (o[k] || 0) + 1; };

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const guard = await requireStaff(req, cors);
  if (guard) return guard;
  if (req.method !== "POST") return json(cors, 405, { ok: false, error: "use POST" });

  const started = Date.now();
  const budgetMs = 100000; // edge functions get up to ~150s wall clock; keep margin
  const body = await req.json().catch(() => ({}));
  const maxPages = body.maxPages || 400;

  const cfg = await getChatConfig();
  if (!cfg.es_token) return json(cors, 200, { ok: false, error: "no_es_token", note: "Paste the EasySocial token in Control Panel settings first." });

  const S: any = { total: 0, read: 0, unread: 0, tags: {}, credit: {}, licence: {}, income: {}, journey: {} };
  let page = 1, partial = false;
  try {
    for (; page <= maxPages; page++) {
      if (Date.now() - started > budgetMs) { partial = true; break; }
      const { leads } = await es.listLeads(cfg, { page, limit: 20, tab: "all" });
      if (!leads.length) break;
      for (const l of leads) {
        S.total++; (l.unread === 0) ? S.read++ : S.unread++;
        (l.latest_tags || []).forEach((t: any) => inc(S.tags, t.title || t.name));
        inc(S.journey, l.journey);
        const d = l.lead_data || {};
        if (d.credit_profile_status) inc(S.credit, d.credit_profile_status);
        if (d.licence_status) inc(S.licence, d.licence_status);
        if (d.income_status) inc(S.income, d.income_status);
      }
    }

    const db = svc();
    const { count } = await db.from("escalation_queue").select("id", { count: "exact", head: true }).eq("status", "open");
    const snapshot = { ...S, openEscalations: count || 0, pagesScanned: page - 1, partial, tookMs: Date.now() - started, at: new Date().toISOString() };
    await db.from("stats_snapshot").insert({ data: snapshot });

    return json(cors, 200, { ok: true, snapshot });
  } catch (e) {
    return json(cors, 500, { ok: false, error: (e as Error).message, pagesScanned: page - 1 });
  }
});

function json(cors: Record<string, string>, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
