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
import { callGemini, checkDailyCap, GUARDRAIL, HEAVY, logAiRun, MID, wrapUntrusted } from "../_shared/taskos/gemini.ts";
import { checkCronSecret } from "../_shared/taskos/cron.ts";
import { embedText, toVectorLiteral } from "../_shared/taskos/embeddings.ts";

const ENTITY_KINDS = ["note","memory","idea","opportunity","decision","risk","reference","journal","contact","reminder","goal","project","person","event","meeting","deadline"];
const ALLOWED_TYPES = new Set(["task", ...ENTITY_KINDS]);
const REL_ENUM = ["assigned_to","about","blocks","part_of","relates_to","scheduled_for","mentions","depends_on"];
const DEFAULT_DAILY_CAP_USD = 2.0;

const CLASSIFY_SYSTEM = `${GUARDRAIL}

You are the brain of LuminaTaskOS — a private second brain for ONE busy car-dealership operator. Input is terse, messy, voice-to-text or shorthand. Your job: think the way a sharp human assistant would, fill in the obvious, and turn it into clean, fully-scheduled, correctly-prioritised structure. Capture the INTENT, not just the words. Default to ACTION — when something needs doing, make it a task; do not just file it as a note.

Return a single JSON object: entities[], links[], confidence (0-1), needs_review (bool).
Allowed types (exact strings): task, reminder, goal, project, person, contact, event, meeting, deadline, memory, note, idea, opportunity, decision, risk, reference, journal.
One item often yields MULTIPLE entities — e.g. a task + the person it involves + a link between them. Create a person/contact entity for any named human and link the task to them.

========== TIME — THIS IS CRITICAL, GET IT RIGHT ==========
You are given a "time_context" object with the user's current local time, today's & tomorrow's dates, the timezone offset, and an "upcoming_days" map (weekday name -> the next date that weekday falls on). USE IT. Never guess the date math — read it from upcoming_days.
- EVERY due_at / remind_at you output MUST be full ISO 8601 WITH the given offset, e.g. "2026-06-18T10:00:00+02:00". Never output a bare time or date.
- A bare clock time ("10:00", "10h00", "at 2pm", "@ 14:30", "half past 3") = the NEXT occurrence: TODAY at that time if it is still in the future vs now_local, otherwise TOMORROW. Always attach the correct date — never drop the time.
- Day words: "tonight" = today 19:00, "this morning" = 09:00, "this afternoon" = 14:00, "this evening"/"later" = 18:00, "EOD"/"by end of day" = 17:00, "first thing" = 08:00. A weekday name = its date from upcoming_days (default 09:00 if no time). "next week" = the date 7 days after that weekday in upcoming_days; "next <weekday>" = that weekday in the FOLLOWING week.
- If a time/day is present or clearly implied, you MUST set due_at. Only leave due_at unset when there is genuinely no temporal cue (a pure note/idea/reference).

========== remind_at ==========
Anything time-bound — a call, meeting, appointment, deadline, or any task with a due time — MUST get remind_at so the user is nudged. Default remind_at = due_at (for a meeting/appointment you may set it ~15 min before). Leave remind_at unset ONLY for non-time items (notes, ideas, references, journal).

========== PRIORITY — two SEPARATE axes, both 1-5. Do not conflate them. ==========
URGENCY = time-criticality (how soon). 5 = now/today/overdue · 4 = within ~3 days · 3 = this week · 2 = next week · 1 = someday / no date. (The system also recomputes this from the due date — still estimate it.)
IMPORTANCE = stakes / consequence, INDEPENDENT of timing. Anchors:
  5 = high-stakes: real money at risk, a key customer/deal, legal/compliance, owner/boss explicitly asked, something that must not fail.
  4 = clearly significant (a real customer, a payment, a commitment to someone).
  3 = NORMAL default — most routine tasks live here.
  2 = minor / low-stakes. 1 = trivial.
  DO NOT inflate importance. A routine "call so-and-so" with no stakes is 3, not 5. Reserve 4-5 for genuine consequence. A far-off task is NOT automatically important.

========== EXAMPLES (assume now_local = 2026-06-18T08:30:00+02:00, a Thursday) ==========
Input: "Call roedolf @ 10:00 and arrange for vehicle switching"
-> entities: [
     { temp_id:"t1", type:"task", title:"Call Roedolf to arrange vehicle switching", due_at:"2026-06-18T10:00:00+02:00", remind_at:"2026-06-18T10:00:00+02:00", urgency:5, importance:3 },
     { temp_id:"p1", type:"person", title:"Roedolf" } ]
   links: [ { from:"t1", to:"p1", relation:"about" } ]   // 10:00 is still ahead of 08:30 today, so it is TODAY.

Input: "send mrs naidoo the invoice by friday"
-> entities: [
     { temp_id:"t1", type:"task", title:"Send Mrs Naidoo the invoice", due_at:"2026-06-20T17:00:00+02:00", remind_at:"2026-06-20T09:00:00+02:00", urgency:3, importance:4 },
     { temp_id:"p1", type:"person", title:"Mrs Naidoo" } ]
   links: [ { from:"t1", to:"p1", relation:"about" } ]   // money + customer => importance 4; Friday from upcoming_days.

Input: "idea - maybe run a winter service special next month"
-> entities: [ { temp_id:"i1", type:"idea", title:"Winter service special", body:"Possible promo next month", importance:2 } ]   // no time cue, no due_at, no remind_at.

Be decisive. Set confidence high (>=0.8) when the intent is clear. Use needs_review:true only when the text is genuinely ambiguous or you had to guess a date with no real cue.`;

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

// ---------------------------------------------------------------------------
// Deterministic temporal + priority logic. The AI is guided by the prompt, but
// these guardrails GUARANTEE correctness regardless of model quirks: they give
// the model precise local-time anchors and back-stop the two things it most
// often gets wrong — dropping a clock time, and over-rating urgency.
// ---------------------------------------------------------------------------
const pad2 = (n: number) => String(n).padStart(2, "0");

// "+02:00" — the user's UTC offset at `at`, via Intl (handles any tz; SAST has no DST).
function localOffset(tz: string, at: Date): string {
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
      .formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
    const m = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (!m) return "+00:00";
    return `${m[1]}${pad2(Number(m[2]))}:${m[3] ?? "00"}`;
  } catch { return "+00:00"; }
}

// "YYYY-MM-DD" for `at` in the given tz.
function localYMD(tz: string, at: Date): string {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at)) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}
const localWeekday = (tz: string, at: Date) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(at);
const localHM = (tz: string, at: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(at);

// Precise anchors handed to the model so it never has to do date arithmetic.
function buildTimeContext(now: Date, tz: string) {
  const offset = localOffset(tz, now);
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const upcoming: Record<string, string> = {};
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const wd = localWeekday(tz, d);
    if (!(wd in upcoming)) upcoming[wd] = localYMD(tz, d); // next date each weekday falls on
  }
  return {
    now_local: `${localYMD(tz, now)}T${localHM(tz, now)}:00${offset}`,
    today: `${localYMD(tz, now)} (${localWeekday(tz, now)})`,
    tomorrow: `${localYMD(tz, tomorrow)} (${localWeekday(tz, tomorrow)})`,
    tz_offset: offset,
    timezone: tz,
    upcoming_days: upcoming,
  };
}

// Pull a clear clock time out of raw text ("10:00", "10h00", "at 2pm", "@ 14:30").
// Conservative: needs a separator or am/pm so it never fires on prices/quantities.
function extractClockTime(text: string): { hh: number; mm: number } | null {
  const s = String(text ?? "");
  let m = s.match(/(?:^|[^\d])(\d{1,2})\s*(am|pm)\b/i); // 2pm / 11 am
  if (m) {
    let hh = Number(m[1]) % 12; if (/pm/i.test(m[2])) hh += 12;
    return { hh, mm: 0 };
  }
  m = s.match(/(?:^|[^\d])(\d{1,2})[:h.](\d{2})(?![\d])/); // 10:00 / 10h00 / 14.30
  if (m) {
    const hh = Number(m[1]), mm = Number(m[2]);
    if (hh <= 23 && mm <= 59) return { hh, mm };
  }
  return null;
}

// Next occurrence of HH:MM in the user's tz as ISO+offset (today if still ahead, else tomorrow).
function nextLocalTimeISO(now: Date, tz: string, hh: number, mm: number): string {
  const off = localOffset(tz, now);
  const todayISO = `${localYMD(tz, now)}T${pad2(hh)}:${pad2(mm)}:00${off}`;
  if (new Date(todayISO).getTime() > now.getTime()) return todayISO;
  const tom = new Date(now.getTime() + 86_400_000);
  return `${localYMD(tz, tom)}T${pad2(hh)}:${pad2(mm)}:00${off}`;
}

// Urgency = time-criticality, derived from the due date. Deterministic so a
// far-off task can NEVER read as urgent (the AI's #1 mistake). No due => low.
function deriveUrgency(dueISO: string | null, now: Date): number {
  if (!dueISO) return 2;
  const h = (new Date(dueISO).getTime() - now.getTime()) / 3_600_000;
  if (h <= 24) return 5;
  if (h <= 72) return 4;
  if (h <= 24 * 7) return 3;
  if (h <= 24 * 14) return 2;
  return 1;
}
const TIME_BOUND = new Set(["task", "reminder", "deadline", "meeting", "event"]);
const clampImportance = (v: any) => ([1, 2, 3, 4, 5].includes(v) ? v : 3);

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

    const now = new Date();
    const payload = {
      time_context: buildTimeContext(now, tz),
      item: wrapUntrusted(row.raw_text),
      existing_entities: (ctxEntities ?? []).map((e: any) => ({ id: e.id, kind: e.kind, title: e.title })),
    };

    // Flash (thinking) first; escalate to Pro (thinking) when low-confidence / flagged.
    let parsed: any, modelUsed = MID;
    {
      const r = await callGemini({ model: MID, system: CLASSIFY_SYSTEM, schema: CLASSIFY_SCHEMA, effort: "medium", maxTokens: 2048, userPayload: payload });
      parsed = r.parsed;
      await logAiRun(svc, ownerUserId, "classify", MID, r.usage);
    }
    const lowConf = typeof parsed?.confidence !== "number" || parsed.confidence < 0.65 || parsed?.needs_review === true;
    if (lowConf) {
      try {
        const r = await callGemini({ model: HEAVY, system: CLASSIFY_SYSTEM, schema: CLASSIFY_SCHEMA, effort: "high", maxTokens: 2048, userPayload: payload });
        parsed = r.parsed; modelUsed = HEAVY;
        await logAiRun(svc, ownerUserId, "classify", HEAVY, r.usage);
      } catch (e) {
        console.error("[taskos-process-inbox] pro escalation failed, keeping flash result", e instanceof Error ? e.message : e);
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
      let dueAt = isoOrNull(ent?.due_at);
      // Time backstop: model dropped the time, but the text has a clear clock time.
      if (!dueAt && TIME_BOUND.has(type)) {
        const t = extractClockTime(row.raw_text);
        if (t) dueAt = nextLocalTimeISO(now, tz, t.hh, t.mm);
      }
      let remindAt = isoOrNull(ent?.remind_at);
      // Reminder backstop: anything time-bound with a due time MUST nudge the user.
      if (!remindAt && dueAt && TIME_BOUND.has(type)) remindAt = dueAt;
      // Urgency is always derived from the due date — deterministic time-criticality,
      // so a far-off task can never read as urgent regardless of what the model said.
      const urgency = deriveUrgency(dueAt, now);
      const importance = clampImportance(ent?.importance);
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
