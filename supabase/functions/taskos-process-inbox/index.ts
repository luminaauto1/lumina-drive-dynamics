// LuminaTaskOS — AI intelligence layer (P2 reliability edition).
// Modes:
//   { inbox_item_id }  -> classify ONE captured item (webhook/panel; internal-key gated)
//   { mode: "sweep" }  -> retry stuck/failed items + backfill embeddings (cron-gated)
// Per-user isolation: user_id is ALWAYS read from the trusted inbox row, NEVER the
// caller. AI: Flash-Lite first; escalate to Pro when confidence is low. Spend is
// logged to taskos_ai_runs and capped per user/day. New rows get embeddings
// (semantic memory) and knowledge-graph links.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";
import { callGemini, checkDailyCap, FAST, GUARDRAIL, HEAVY, logAiRun, wrapUntrusted } from "../_shared/taskos/gemini.ts";
import { checkCronSecret } from "../_shared/taskos/cron.ts";
import { embedText, toVectorLiteral } from "../_shared/taskos/embeddings.ts";

const ENTITY_KINDS = ["note","memory","idea","opportunity","decision","risk","reference","journal","contact","reminder","goal","project","person","event","meeting","deadline"];
const ALLOWED_TYPES = new Set(["task", ...ENTITY_KINDS]);
const REL_ENUM = ["assigned_to","about","blocks","part_of","relates_to","scheduled_for","mentions","depends_on"];
const DEFAULT_DAILY_CAP_USD = 2.0;

const CLASSIFY_SYSTEM = `${GUARDRAIL}

You are the classification and extraction engine for LuminaTaskOS, a private second brain used by ONE dealership staff member. Classify a single captured item into one or MORE entities, extract structured fields, and resolve relative dates against the provided now+timezone. Propose links ONLY between temp_ids you create or ids present in existing_entities. Assign initial urgency/importance (1-5) and a confidence score (0-1).
Allowed types (exact strings): task, reminder, goal, project, person, contact, event, meeting, deadline, memory, note, idea, opportunity, decision, risk, reference, journal.
A single item often yields multiple entities (e.g. "Call John Friday about the proposal" => a person 'John', a task 'Call John about the proposal' due Friday, and a link task->person). If unsure of a type, use "note" and set needs_review:true.
Dates must be ISO 8601 with offset; if a date is vague, set the field best-effort AND needs_review:true.
remind_at: set it ONLY when the user clearly wants to be nudged at a time (an explicit reminder, a deadline, a meeting, or a time-critical task). It is usually equal to due_at or shortly before. Leave it unset for notes/ideas/reference.`;

const CLASSIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["entities", "links", "confidence", "needs_review"],
  properties: {
    entities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["temp_id", "type", "title"],
        properties: {
          temp_id: { type: "string" },
          type: { type: "string", enum: ["task", ...ENTITY_KINDS] },
          title: { type: "string" },
          body: { type: "string" },
          due_at: { type: "string", format: "date-time" },
          remind_at: { type: "string", format: "date-time" },
          urgency: { type: "integer", enum: [1, 2, 3, 4, 5] },
          importance: { type: "integer", enum: [1, 2, 3, 4, 5] },
          tags: { type: "array", items: { type: "string" } },
        },
      },
    },
    links: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "relation"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          relation: { type: "string", enum: REL_ENUM },
        },
      },
    },
    confidence: { type: "number" },
    needs_review: { type: "boolean" },
  },
};

const nowISO = () => new Date().toISOString();
const isoOrNull = (v: any) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

// ---- classify a single inbox row, persist its entities/tasks/links/embeddings ----
async function processOne(svc: any, inboxId: string): Promise<{ status: string; created: number }> {
  // Atomic claim: only one worker processes a pending/failed item.
  const { data: row } = await svc.from("taskos_inbox_items")
    .update({ status: "processing", claimed_at: nowISO() })
    .eq("id", inboxId).in("status", ["pending", "failed"])
    .select("*").maybeSingle();
  if (!row) return { status: "skipped", created: 0 };

  const ownerUserId: string = row.user_id;
  try {
    if (!row.raw_text || !row.raw_text.trim()) {
      await svc.from("taskos_inbox_items").update({ status: "needs_review", processed_at: nowISO(), ai_result: { note: "empty text" } }).eq("id", inboxId);
      return { status: "needs_review", created: 0 };
    }

    const { data: settings } = await svc.from("taskos_user_settings").select("timezone, settings").eq("user_id", ownerUserId).maybeSingle();
    const tz = settings?.timezone ?? "Africa/Johannesburg";
    const capUsd = Number(settings?.settings?.daily_ai_cap_usd ?? DEFAULT_DAILY_CAP_USD);

    // Spend guard — fail soft into needs_review so nothing is lost.
    const cap = await checkDailyCap(svc, ownerUserId, capUsd);
    if (cap.over) {
      await svc.from("taskos_inbox_items").update({
        status: "needs_review", processed_at: nowISO(),
        ai_result: { note: `Daily AI budget reached ($${cap.spentUsd.toFixed(2)}/$${capUsd.toFixed(2)}). Captured but not auto-organised; raise the cap in Settings to resume.` },
      }).eq("id", inboxId);
      return { status: "needs_review", created: 0 };
    }

    const { data: ctxEntities } = await svc.from("taskos_entities")
      .select("id, kind, title").eq("user_id", ownerUserId)
      .in("kind", ["project", "goal", "person", "contact"]).order("created_at", { ascending: false }).limit(40);

    const payload = {
      now: nowISO(),
      timezone: tz,
      item: wrapUntrusted(row.raw_text),
      existing_entities: (ctxEntities ?? []).map((e: any) => ({ id: e.id, kind: e.kind, title: e.title })),
    };

    // Flash-Lite first (cheap), escalate to Pro when low-confidence / flagged.
    let parsed: any, modelUsed = FAST;
    {
      const r = await callGemini({ model: FAST, system: CLASSIFY_SYSTEM, schema: CLASSIFY_SCHEMA, effort: "medium", maxTokens: 2048, userPayload: payload });
      parsed = r.parsed;
      await logAiRun(svc, ownerUserId, "classify", FAST, r.usage);
    }
    const lowConf = typeof parsed?.confidence !== "number" || parsed.confidence < 0.6 || parsed?.needs_review === true;
    if (lowConf) {
      try {
        const r = await callGemini({ model: HEAVY, system: CLASSIFY_SYSTEM, schema: CLASSIFY_SCHEMA, effort: "high", maxTokens: 2048, userPayload: payload });
        parsed = r.parsed; modelUsed = HEAVY;
        await logAiRun(svc, ownerUserId, "classify", HEAVY, r.usage);
      } catch (e) {
        console.error("[taskos-process-inbox] opus escalation failed, keeping haiku result", e instanceof Error ? e.message : e);
      }
    }

    const entities: any[] = Array.isArray(parsed?.entities) ? parsed.entities : [];
    // temp_id / existing-id -> { kind, id } so we can resolve links.
    const idMap = new Map<string, { kind: "task" | "entity"; id: string }>();
    for (const e of ctxEntities ?? []) idMap.set(e.id, { kind: "entity", id: e.id });

    let created = 0;
    for (const ent of entities) {
      const type = String(ent?.type ?? "").toLowerCase();
      if (!ALLOWED_TYPES.has(type)) continue; // whitelist — drop hallucinated types
      const title = String(ent?.title ?? "").slice(0, 500) || "(untitled)";
      const body = typeof ent?.body === "string" ? ent.body : "";
      const dueAt = isoOrNull(ent?.due_at);
      const remindAt = isoOrNull(ent?.remind_at);
      const urgency = [1, 2, 3, 4, 5].includes(ent?.urgency) ? ent.urgency : 3;
      const importance = [1, 2, 3, 4, 5].includes(ent?.importance) ? ent.importance : 3;
      const tags = Array.isArray(ent?.tags) ? ent.tags.map((t: any) => String(t)).slice(0, 20) : [];
      const emb = await embedText(`${title}\n${body}`);
      const embLit = emb ? toVectorLiteral(emb) : null;

      if (type === "task") {
        const { data: ins } = await svc.from("taskos_tasks").insert({
          user_id: ownerUserId, title, description: body || null, due_at: dueAt,
          remind_at: remindAt ?? dueAt, urgency, importance, tags, source_inbox_id: inboxId,
          ...(embLit ? { embedding: embLit } : {}),
        }).select("id").maybeSingle();
        if (ins?.id && ent?.temp_id) idMap.set(String(ent.temp_id), { kind: "task", id: ins.id });
      } else {
        const { data: ins } = await svc.from("taskos_entities").insert({
          user_id: ownerUserId, kind: type, title, body,
          due_at: dueAt, remind_at: remindAt, importance, tags, source_inbox_id: inboxId,
          ...(embLit ? { embedding: embLit } : {}),
        }).select("id").maybeSingle();
        if (ins?.id && ent?.temp_id) idMap.set(String(ent.temp_id), { kind: "entity", id: ins.id });
      }
      created++;
    }

    // Knowledge-graph edges (only when both ends resolved; ignore dup unique-violations).
    const links: any[] = Array.isArray(parsed?.links) ? parsed.links : [];
    for (const ln of links) {
      const f = idMap.get(String(ln?.from));
      const t = idMap.get(String(ln?.to));
      const relation = REL_ENUM.includes(ln?.relation) ? ln.relation : null;
      if (!f || !t || !relation || (f.id === t.id)) continue;
      const { error } = await svc.from("taskos_links").insert({
        user_id: ownerUserId, from_kind: f.kind, from_id: f.id, to_kind: t.kind, to_id: t.id, relation,
      });
      if (error && (error as any).code !== "23505") console.error("[taskos-process-inbox] link insert", error.message);
    }

    const needsReview = parsed?.needs_review === true || (typeof parsed?.confidence === "number" && parsed.confidence < 0.5) || created === 0;
    await svc.from("taskos_inbox_items").update({
      status: needsReview ? "needs_review" : "processed",
      processed_at: nowISO(),
      ai_result: { ...parsed, _model: modelUsed },
    }).eq("id", inboxId).eq("user_id", ownerUserId);

    return { status: needsReview ? "needs_review" : "processed", created };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[taskos-process-inbox]", msg);
    await svc.from("taskos_inbox_items").update({
      status: "failed", error_text: msg.slice(0, 1000), error_count: (row.error_count ?? 0) + 1,
    }).eq("id", inboxId);
    return { status: "failed", created: 0 };
  }
}

// ---- sweep: retry stuck/failed items + backfill missing embeddings (cron) ----
async function sweep(svc: any): Promise<any> {
  const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
  const twoMinAgo = new Date(Date.now() - 2 * 60_000).toISOString();
  const ids = new Set<string>();
  const { data: failed } = await svc.from("taskos_inbox_items")
    .select("id").eq("status", "failed").lt("error_count", 3).order("created_at", { ascending: true }).limit(15);
  for (const r of failed ?? []) ids.add(r.id);
  const { data: stuck } = await svc.from("taskos_inbox_items")
    .select("id").eq("status", "processing").lt("claimed_at", tenMinAgo).limit(10);
  for (const r of stuck ?? []) ids.add(r.id);
  // Stale 'pending' — captured but the browser's processing call never landed
  // (e.g. transient network/preflight). Older than 2 min so we don't race the
  // normal fire-and-forget path. This makes capture self-healing.
  const { data: stalePending } = await svc.from("taskos_inbox_items")
    .select("id").eq("status", "pending").lt("created_at", twoMinAgo).order("created_at", { ascending: true }).limit(15);
  for (const r of stalePending ?? []) ids.add(r.id);

  // Reset to pending so processOne can re-claim, then process sequentially.
  const idList = [...ids];
  if (idList.length) await svc.from("taskos_inbox_items").update({ status: "pending" }).in("id", idList);
  let retried = 0;
  for (const id of idList) { await processOne(svc, id); retried++; }

  // Backfill embeddings for rows created before semantic memory existed.
  let embedded = 0;
  const { data: noEmbTasks } = await svc.from("taskos_tasks").select("id, title, description").is("embedding", null).limit(40);
  for (const t of noEmbTasks ?? []) {
    const v = await embedText(`${t.title ?? ""}\n${t.description ?? ""}`);
    if (v) { await svc.from("taskos_tasks").update({ embedding: toVectorLiteral(v) }).eq("id", t.id); embedded++; }
  }
  const { data: noEmbEnts } = await svc.from("taskos_entities").select("id, title, body").is("embedding", null).limit(40);
  for (const e of noEmbEnts ?? []) {
    const v = await embedText(`${e.title ?? ""}\n${e.body ?? ""}`);
    if (v) { await svc.from("taskos_entities").update({ embedding: toVectorLiteral(v) }).eq("id", e.id); embedded++; }
  }

  return { ok: true, retried, embedded };
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"), req.headers.get("access-control-request-headers"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(SUPABASE_URL, SERVICE);

  let bodyJson: any = {};
  try { bodyJson = await req.json(); } catch { /* ignore */ }

  // Auth: internal key (webhook/panel) OR cron secret (sweep). Try cron first when
  // the key guard would reject, so a cron call still passes even if the internal
  // key is mid-rotation.
  const keyGuard = checkInternalKey(req);
  if (keyGuard) {
    const cronOk = await checkCronSecret(req, svc);
    if (!cronOk) return keyGuard;
  }

  if (bodyJson?.mode === "sweep") {
    try { return json(await sweep(svc)); }
    catch (e) { console.error("[taskos-process-inbox] sweep", e instanceof Error ? e.message : e); return json({ error: "sweep failed" }, 500); }
  }

  const inboxId = bodyJson?.inbox_item_id;
  if (!inboxId) return json({ error: "inbox_item_id required" }, 400);
  const result = await processOne(svc, String(inboxId));
  return json({ ok: true, ...result });
});
