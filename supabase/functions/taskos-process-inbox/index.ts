// LuminaTaskOS — AI intelligence layer. Takes { inbox_item_id } ONLY; reads
// user_id from the row (never the caller). Classifies the captured text with
// Claude into one or more entities and persists them under that user.
// verify_jwt=false; gated by the internal shared key (anti-abuse only — the real
// boundary is that user_id is read from the trusted row, not the request).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";
import { callClaude, GUARDRAIL, OPUS, wrapUntrusted } from "../_shared/taskos/anthropic.ts";

const ENTITY_KINDS = ["note","memory","idea","opportunity","decision","risk","reference","journal","contact","reminder","goal","project","person","event","meeting","deadline"];
const ALLOWED_TYPES = new Set(["task", ...ENTITY_KINDS]);

const CLASSIFY_SYSTEM = `${GUARDRAIL}

You are the classification and extraction engine for LuminaTaskOS, a private second brain used by ONE dealership staff member. Classify a single captured item into one or MORE entities, extract structured fields, and resolve relative dates against the provided now+timezone. Propose links ONLY to ids present in existing_entities. Assign initial urgency/importance (1-5) and a confidence score (0-1).
Allowed types (exact strings): task, reminder, goal, project, person, contact, event, meeting, deadline, memory, note, idea, opportunity, decision, risk, reference, journal.
A single item often yields multiple entities (e.g. "Call John Friday about the proposal" => a person 'John', a task 'Call John about the proposal' due Friday, and a link task->person). If unsure of a type, use "note" and set needs_review:true. Dates must be ISO 8601 with offset; if a date is vague, set the field best-effort AND needs_review:true.`;

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
          relation: { type: "string", enum: ["assigned_to", "about", "blocks", "part_of", "relates_to", "scheduled_for", "mentions", "depends_on"] },
        },
      },
    },
    confidence: { type: "number" },
    needs_review: { type: "boolean" },
  },
};

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(SUPABASE_URL, SERVICE);

  let inboxId: string | undefined;
  try {
    ({ inbox_item_id: inboxId } = await req.json());
  } catch { /* ignore */ }
  if (!inboxId) return json({ error: "inbox_item_id required" }, 400);

  // Atomic claim: only one worker processes a pending/failed item.
  const { data: row } = await svc.from("taskos_inbox_items")
    .update({ status: "processing", claimed_at: new Date().toISOString() })
    .eq("id", inboxId).in("status", ["pending", "failed"])
    .select("*").maybeSingle();
  if (!row) return json({ ok: true, skipped: "already claimed or not found" });

  const ownerUserId: string = row.user_id;

  try {
    if (!row.raw_text || !row.raw_text.trim()) {
      await svc.from("taskos_inbox_items").update({ status: "needs_review", processed_at: new Date().toISOString(), ai_result: { note: "empty text" } }).eq("id", inboxId);
      return json({ ok: true });
    }

    // Context: a few of this user's existing linkable entities (Phase 1: names only).
    const { data: settings } = await svc.from("taskos_user_settings").select("timezone").eq("user_id", ownerUserId).maybeSingle();
    const tz = settings?.timezone ?? "Africa/Johannesburg";
    const { data: ctxEntities } = await svc.from("taskos_entities")
      .select("id, kind, title").eq("user_id", ownerUserId)
      .in("kind", ["project", "goal", "person"]).order("created_at", { ascending: false }).limit(40);

    const { parsed } = await callClaude({
      model: OPUS,
      system: CLASSIFY_SYSTEM,
      schema: CLASSIFY_SCHEMA,
      effort: "high",
      maxTokens: 2048,
      userPayload: {
        now: new Date().toISOString(),
        timezone: tz,
        item: wrapUntrusted(row.raw_text),
        existing_entities: (ctxEntities ?? []).map((e: any) => ({ id: e.id, kind: e.kind, title: e.title })),
      },
    });

    const entities: any[] = Array.isArray(parsed?.entities) ? parsed.entities : [];
    let created = 0;
    for (const ent of entities) {
      const type = String(ent?.type ?? "").toLowerCase();
      if (!ALLOWED_TYPES.has(type)) continue; // whitelist — drop hallucinated types
      const title = String(ent?.title ?? "").slice(0, 500) || "(untitled)";
      const dueAt = typeof ent?.due_at === "string" ? ent.due_at : null;
      const urgency = [1, 2, 3, 4, 5].includes(ent?.urgency) ? ent.urgency : 3;
      const importance = [1, 2, 3, 4, 5].includes(ent?.importance) ? ent.importance : 3;
      const tags = Array.isArray(ent?.tags) ? ent.tags.map((t: any) => String(t)).slice(0, 20) : [];

      if (type === "task") {
        await svc.from("taskos_tasks").insert({
          user_id: ownerUserId, title, description: ent?.body ?? null, due_at: dueAt,
          urgency, importance, tags, source_inbox_id: inboxId,
        });
      } else {
        await svc.from("taskos_entities").insert({
          user_id: ownerUserId, kind: type, title, body: ent?.body ?? "",
          due_at: dueAt, importance, tags, source_inbox_id: inboxId,
        });
      }
      created++;
    }

    const needsReview = parsed?.needs_review === true || (typeof parsed?.confidence === "number" && parsed.confidence < 0.5) || created === 0;
    await svc.from("taskos_inbox_items").update({
      status: needsReview ? "needs_review" : "processed",
      processed_at: new Date().toISOString(),
      ai_result: parsed,
    }).eq("id", inboxId).eq("user_id", ownerUserId);

    return json({ ok: true, created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[taskos-process-inbox]", msg);
    await svc.from("taskos_inbox_items").update({
      status: "failed", error_text: msg.slice(0, 1000),
      error_count: (row.error_count ?? 0) + 1,
    }).eq("id", inboxId);
    return json({ error: "processing failed" }, 500);
  }
});
