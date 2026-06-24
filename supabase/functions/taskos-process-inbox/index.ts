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

// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: any;

const ENTITY_KINDS = ["note","memory","idea","opportunity","decision","risk","reference","journal","contact","reminder","goal","project","person","event","meeting","deadline"];
const ALLOWED_TYPES = new Set(["task", ...ENTITY_KINDS]);
const REL_ENUM = ["assigned_to","about","blocks","part_of","relates_to","scheduled_for","mentions","depends_on"];
const DEFAULT_DAILY_CAP_USD = 2.0;

const CLASSIFY_SYSTEM = `${GUARDRAIL}

You are the brain of LuminaTaskOS — a private second brain for ONE busy car-dealership operator. Input is terse, messy, voice-to-text or shorthand. Your job: think the way a sharp human assistant would, fill in the obvious, and turn it into clean, fully-scheduled, correctly-prioritised structure. Capture the INTENT, not just the words. Default to ACTION — when something needs doing, make it a task; do not just file it as a note.

Return a single JSON object: entities[], links[], confidence (0-1), needs_review (bool).
Allowed types (exact strings): task, reminder, goal, project, person, contact, event, meeting, deadline, memory, note, idea, opportunity, decision, risk, reference, journal.
One item often yields MULTIPLE entities — e.g. a task + the person it involves + a link between them. Create a person/contact entity for any named human and link the task to them.

========== GOALS & DEADLINES — multi-step objectives become a "goal", not one task ==========
If the input is an OUTCOME the user wants achieved by a date that clearly takes SEVERAL steps — "get/have X sorted/done/ready/registered by <date>", "finish the Y by month-end", "sort out all the paperwork for Z", "set up …", "launch …" — classify it as ONE entity of type "goal" (use "deadline" if it's mostly a hard date), set due_at = the deadline, and do NOT pre-invent the steps yourself. The system breaks the goal into candidate sub-tasks and confirms them with the user. A GOAL is an outcome that needs several actions; a TASK is one concrete action. Still emit a single "task" when the input is one concrete action ("call Sam", "send the invoice", "renew the licence") even if dated. When a NEW task clearly advances an existing goal/project in related_memory, link it { from:<task>, to:<goal id>, relation:"part_of" } (this is how tasks auto-sync to goals).

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

========== DAY PLANNING — when the input is a batch / to-do list for a day ==========
The user often dumps several things to do in one day ("important today, schedule accordingly", a bullet list, "things for tomorrow"). NEVER stamp them all at the same time — that is the single worst thing you can do. Instead lay out a sensible day:
- Give EACH task a "category" and a "plan_order" (1 = do first, 2 = next, …) for a logical running order. You do NOT need to invent a clock time for floating to-dos — leave due_at on the correct DAY (use 09:00 on that day as a placeholder) and set time_explicit:false; the system spreads them across working hours in your plan_order.
- HARD RULE — CALLS & FEEDBACK GO FIRST. Phoning/calling someone, following up, chasing a person, getting or giving client feedback, any outreach → category "call"/"feedback"/"outreach" and the LOWEST plan_order numbers. The owner ALWAYS does these first thing in the day. Everything else (admin, building, loading, research, content, errands) comes after.
- ORDER LOGICALLY by dependency and stakes: if task A must happen before task B (A unblocks/enables B), give A the lower plan_order AND emit a link { from:A, to:B, relation:"blocks" }. Quick enabling steps before the big thing they unlock; higher-stakes before lower.
- time_explicit: TRUE only when the text gives THAT task its own clock time or hard deadline ("call Sam at 10", "submit by 4pm") — then put that exact time in due_at. Otherwise FALSE.

========== EXAMPLES (assume now_local = 2026-06-18T08:30:00+02:00, a Thursday) ==========
Input (a day-dump): "important today, schedule accordingly: finalise Auto Investments onboarding; make the explainer video for Siobhan; load the apps; make sure the system works; follow up on credit checks; get client feedback"
-> entities (ALL due TODAY; system time-slots them in plan_order, calls/feedback first):
     { temp_id:"t1", type:"task", title:"Follow up on credit checks", due_at:"2026-06-18T09:00:00+02:00", category:"call", plan_order:1, time_explicit:false, importance:4, urgency:5 },
     { temp_id:"t2", type:"task", title:"Get client feedback", due_at:"2026-06-18T09:00:00+02:00", category:"feedback", plan_order:2, time_explicit:false, importance:4, urgency:5 },
     { temp_id:"t3", type:"task", title:"Finalise Auto Investments onboarding", due_at:"2026-06-18T09:00:00+02:00", category:"admin", plan_order:3, time_explicit:false, importance:4, urgency:5 },
     { temp_id:"t4", type:"task", title:"Load the apps", due_at:"2026-06-18T09:00:00+02:00", category:"admin", plan_order:4, time_explicit:false, importance:3, urgency:5 },
     { temp_id:"t5", type:"task", title:"Make sure the system works", due_at:"2026-06-18T09:00:00+02:00", category:"admin", plan_order:5, time_explicit:false, importance:3, urgency:5 },
     { temp_id:"t6", type:"task", title:"Make explainer video for Siobhan", due_at:"2026-06-18T09:00:00+02:00", category:"content", plan_order:6, time_explicit:false, importance:3, urgency:5 } ]
   // none have an explicit time -> time_explicit:false on all -> the system spreads them from the start of the workday, calls/feedback first.


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

========== MEMORY & CONTINUITY — use related_memory ==========
You are given "related_memory": the user's EXISTING tasks, goals, projects, people and notes most relevant to THIS item (each carries a real "id"). It is your memory of what already exists. Use it:
- LINK to what's real: if the item involves a person/goal/project that already exists, reference that record's real id in links[].to — do NOT mint a duplicate person/goal. A task that advances an existing goal/project SHOULD get a link { from:<task temp_id>, to:<that goal/project id>, relation:"part_of" }.
- DEDUPE: if this item is essentially the SAME as an existing OPEN task, do NOT create a second task — instead set that new task entity's "duplicate_of" to the existing task's id (you may still create genuinely-new related entities + links to it).
- ENRICH: carry continuity from memory into the title/body when it clarifies (same customer, same deal, prior context).
Only ever use ids that appear in related_memory or existing_entities. Never invent an id.

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
          duplicate_of: { type: "string", description: "id of an existing OPEN task in related_memory this duplicates; set instead of creating a second task" },
          category: { type: "string", enum: ["call", "feedback", "outreach", "meeting", "deep_work", "admin", "errand", "research", "content", "finance", "personal", "other"], description: "what KIND of work this is — used for day-planning (call/feedback/outreach are scheduled first)" },
          plan_order: { type: "integer", description: "intended running order within the day for a batch/to-do list; 1 = do first, then 2, 3… Lower = earlier. Calls/feedback get the lowest." },
          time_explicit: { type: "boolean", description: "TRUE only if the text gives THIS task its own clock time or hard deadline; then put that time in due_at. FALSE = a floating to-do the system will time-slot." },
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

// The model is unreliable about the UTC offset it attaches to the times it emits —
// it often tags a local clock time with "Z", "+00:00" or even a random offset, which
// would store the task hours off and fire reminders at the wrong moment. The WALL-CLOCK
// (date + HH:MM) it produces IS the user's intended local time, so we ignore whatever
// offset it attached and re-anchor those components in the user's timezone before
// converting to a UTC instant.
function localWallToUtcISO(v: any, tz: string): string | null {
  if (typeof v !== "string") return null;
  const m = v.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  const offset = localOffset(tz, new Date(`${y}-${mo}-${d}T12:00:00Z`)); // tz offset on that calendar day
  const anchored = new Date(`${y}-${mo}-${d}T${hh}:${mm}:00${offset}`);
  return Number.isNaN(anchored.getTime()) ? null : anchored.toISOString();
}

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
const clampHour = (v: any, d: number) => (Number.isFinite(v) && v >= 0 && v <= 23 ? Math.floor(v) : d);

// ---------------------------------------------------------------------------
// DAY PLANNER. When ONE capture yields a batch of tasks for the same day (a
// "schedule accordingly" / to-do-list dump), the model picks a running order
// but should NOT pin clock times. This lays that batch across the working day
// deterministically so it can NEVER all land at one time again:
//   • CALLS & FEEDBACK FIRST — the owner's hard rule (earliest slots).
//   • then by the model's plan_order, importance, urgency.
//   • spaced by a fixed cadence inside working hours, routing around any task
//     that DOES have an explicit time (those stay put as fixed anchors).
// The AI guides the order; this code guarantees the spread + the calls-first law.
// ---------------------------------------------------------------------------
const pad = pad2;
// minutes from local midnight for an instant, in tz
function localMinutes(tz: string, iso: string): number {
  const [h, m] = localHM(tz, new Date(iso)).split(":").map(Number);
  return h * 60 + m;
}
// ISO+offset for minutes-from-midnight on a given local calendar day (YYYY-MM-DD)
function localMinutesToISO(tz: string, ymd: string, minutes: number): string {
  const mins = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const offset = localOffset(tz, new Date(`${ymd}T12:00:00Z`));
  return new Date(`${ymd}T${pad(Math.floor(mins / 60))}:${pad(mins % 60)}:00${offset}`).toISOString();
}
// Local minute-of-day the day-planner uses as the "floating to-do" placeholder. A task
// whose due time equals this (and isn't flagged explicit) is treated as un-timed → planned.
const PLACEHOLDER_MIN = 9 * 60; // 09:00 — matches the prompt's batch placeholder
// How many distinct clock times the text mentions (so the backstop only borrows a
// capture-wide time when there's exactly one — never guessing which task it belongs to).
function clockTimeCount(text: string): number {
  const s = String(text ?? "");
  const a = s.match(/(?:^|[^\d])(\d{1,2})\s*(am|pm)\b/ig) || [];
  const b = s.match(/(?:^|[^\d])(\d{1,2})[:h.](\d{2})(?![\d])/g) || [];
  return a.length + b.length;
}
// Calls / feedback / outreach — these get the earliest slots (owner's rule).
const CALL_RE = /\b(call|calling|phone|phoning|ring|dial|follow[\s-]?ups?|following up|reach\s?out|reaching out|touch\s?base|check[\s-]?in|cold\s?call)\b/i;
const FEEDBACK_RE = /\b(client'?s?|customer'?s?|clients|get|getting|give|giving|gather|gathering|collect|request)\s+feedback\b/i;
const CALL_CATS = new Set(["call", "feedback", "outreach"]);
function isCallish(t: { category?: string | null; title?: string }): boolean {
  if (t.category && CALL_CATS.has(String(t.category))) return true;
  const s = t.title ?? "";
  return CALL_RE.test(s) || FEEDBACK_RE.test(s);
}
function cmpTuple(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
interface PlanTask {
  title: string; dueAt: string | null; startAt?: string | null; remindAt?: string | null;
  importance: number; urgency?: number; anchored: boolean; category?: string | null;
  planOrder?: number | null; tags: string[]; planned?: boolean;
}
interface PlanOpts { workStartHour: number; workEndHour: number; slotMin: number; callsFirst: boolean }

// Lay a same-day batch of unanchored tasks across the working day. Mutates tasks
// in place (sets startAt / dueAt / remindAt / planned / tags). No-op unless there
// is a genuine same-day cluster (>=2 tasks sharing a day) to plan.
function planDay(tasks: PlanTask[], now: Date, tz: string, opts: PlanOpts): boolean {
  if (tasks.length < 2) return false;
  const dayOf = (t: PlanTask) => (t.dueAt ? localYMD(tz, new Date(t.dueAt)) : null);
  // Find the day the most tasks already fall on.
  const dayCount = new Map<string, number>();
  for (const t of tasks) { const d = dayOf(t); if (d) dayCount.set(d, (dayCount.get(d) ?? 0) + 1); }
  let topDay: string | null = null, best = 0;
  for (const [d, c] of dayCount) if (c > best || (c === best && topDay && d < topDay)) { best = c; topDay = d; }
  const todayYMD = localYMD(tz, now);
  // This is a day-plan batch when EITHER >=2 tasks share a day, OR the model gave
  // >=2 tasks an explicit plan_order (its signal: "this is a sequenced to-do list").
  const planOrdered = tasks.filter((t) => Number.isInteger(t.planOrder as any) && (t.planOrder as number) > 0).length;
  let batchDay: string | null = null;
  if (best >= 2) batchDay = topDay;
  else if (planOrdered >= 2) batchDay = topDay ?? todayYMD; // sequenced list with sparse/absent dates
  if (!batchDay) return false;
  if (batchDay < todayYMD) return false; // never re-plan a past day

  // Members = tasks dated on the batch day, PLUS undated tasks the model EXPLICITLY
  // sequenced (positive plan_order) — those are batch items it left undated. An undated
  // task with NO plan_order is a genuine "someday" to-do and must stay unscheduled.
  const onBatch = (t: PlanTask) => dayOf(t) === batchDay;
  const isSequencedUndated = (t: PlanTask) => dayOf(t) === null && Number.isInteger(t.planOrder as any) && (t.planOrder as number) > 0;
  const members = tasks.filter((t) => onBatch(t) || isSequencedUndated(t));
  // Anchored = an explicit time on the batch day; they're fixed obstacles.
  const anchored = members.filter((t) => t.anchored && onBatch(t));
  const floating = members.filter((t) => !(t.anchored && onBatch(t)));
  if (floating.length === 0) return false;

  // Order floating tasks: calls/feedback first, then plan_order, importance, urgency.
  floating.sort((a, b) => cmpTuple(
    [opts.callsFirst && isCallish(a) ? 0 : 1, a.planOrder ?? 50, -(a.importance ?? 3), -(a.urgency ?? 3)],
    [opts.callsFirst && isCallish(b) ? 0 : 1, b.planOrder ?? 50, -(b.importance ?? 3), -(b.urgency ?? 3)],
  ));

  const anchoredMins = anchored.map((t) => localMinutes(tz, t.dueAt!)).sort((x, y) => x - y);
  let cursor = opts.workStartHour * 60;
  if (batchDay === todayYMD) {
    const nowMin = localMinutes(tz, now.toISOString());
    cursor = Math.max(cursor, Math.ceil((nowMin + 10) / 15) * 15); // never schedule in the past
  }
  // Cadence between tasks — COMPRESS it if the batch wouldn't otherwise fit before the
  // day's end, so an oversized dump still gets DISTINCT times instead of collapsing onto
  // one timestamp (the very failure the planner exists to prevent).
  const DAY_END = 21 * 60;
  let slot = opts.slotMin;
  const span = DAY_END - cursor;
  if (floating.length > 1 && (floating.length - 1) * slot > span) {
    slot = Math.max(10, Math.floor(span / (floating.length - 1)));
  }
  for (const t of floating) {
    for (let guard = 0; guard < 64; guard++) { // step over any anchored (fixed-time) task
      if (!anchoredMins.some((am) => Math.abs(am - cursor) < slot)) break;
      cursor += slot;
    }
    const iso = localMinutesToISO(tz, batchDay, cursor); // ISO helper clamps to ≤23:59
    t.startAt = iso; t.dueAt = iso; t.remindAt = iso; t.planned = true;
    if (isCallish(t) && !t.tags.includes("call")) t.tags.push("call");
    cursor += slot;
  }
  for (const t of anchored) t.startAt = t.dueAt; // keep its scheduled start coherent
  return true;
}

// ===========================================================================
// WHOLE-DAY REPLANNER. planDay() above only sequences ONE capture's batch. This
// re-sequences a user's ENTIRE day every time anything changes, so the board is
// always a coherent schedule (calls first, realistic per-task durations, no
// end-of-day pile) instead of everything defaulting to 17:00. Idempotent.
// ===========================================================================

// Estimated minutes a task needs — so the plan blocks out a 2-hour video properly
// and doesn't cram it into a 20-minute slot. Category first, then title keywords.
function estimateDuration(t: { title?: string; category?: string | null; tags?: string[] }): number {
  const cat = String(t.category || "").toLowerCase();
  const s = `${t.title || ""} ${(t.tags || []).join(" ")}`.toLowerCase();
  if (cat === "call" || cat === "feedback" || cat === "outreach" || /\bcall|phone|ring|follow[- ]?up|feedback|check in|reach out\b/.test(s)) return 20;
  if (cat === "content" || /video|record|edit\b|design|write|content|film|shoot|presentation/.test(s)) return 120;
  if (cat === "research" || /research|investigate|figure out|explore|compare|look into|plan\b/.test(s)) return 60;
  if (cat === "meeting" || /meeting|\bmeet\b|appointment|interview|viewing/.test(s)) return 60;
  if (cat === "errand" || /pickup|pick up|collect|drop off|fetch|deliver|fitment|fit\b|go to|visit/.test(s)) return 60;
  if (cat === "finance" || cat === "admin" || /invoice|paperwork|submit|load\b|sort|onboard|email|capture|update|process|license|disc/.test(s)) return 30;
  return 30;
}

// Local minute-of-day values the OLD capture used as a "today" default. UNFLAGGED tasks
// sitting on one of these (17:00) are treated as floating and re-planned; everything
// else with a real user-given time is left alone.
const DEFAULT_PLAN_MIN = new Set([17 * 60]);

// Re-plan ALL of a user's floating tasks for one local day into a coherent schedule.
async function replanUserDay(svc: any, userId: string, ymd: string, now: Date, tz: string, opts: PlanOpts): Promise<number> {
  const todayYMD = localYMD(tz, now);
  if (ymd < todayYMD) return 0; // never re-plan a past day
  const off = localOffset(tz, new Date(`${ymd}T12:00:00Z`));
  const dayStart = new Date(`${ymd}T00:00:00${off}`).toISOString();
  const dayEnd = new Date(`${ymd}T23:59:59${off}`).toISOString();
  const { data: rows } = await svc.from("taskos_tasks")
    .select("id, title, due_at, importance, urgency, priority_score, tags, metadata")
    .eq("user_id", userId).not("status", "in", "(done,cancelled)")
    .gte("due_at", dayStart).lte("due_at", dayEnd);
  const tasks = (rows ?? []) as any[];
  if (!tasks.length) return 0;
  // Floating = planner-owned, or sitting on the legacy 17:00 default; never a task the
  // user (or capture) explicitly time-stamped.
  const isFloating = (t: any) => {
    const m = t.metadata || {};
    if (m.anchored === true) return false;
    if (m.planned === true) return true;
    return DEFAULT_PLAN_MIN.has(localMinutes(tz, t.due_at));
  };
  const floating = tasks.filter(isFloating);
  if (!floating.length) return 0;
  const anchored = tasks.filter((t) => !isFloating(t));
  const callish = (t: any) => isCallish({ category: (t.metadata || {}).category, title: t.title });
  // Calls/feedback first, then by computed priority, then importance.
  floating.sort((a, b) => cmpTuple(
    [opts.callsFirst && callish(a) ? 0 : 1, -(a.priority_score ?? 0), -(a.importance ?? 3)],
    [opts.callsFirst && callish(b) ? 0 : 1, -(b.priority_score ?? 0), -(b.importance ?? 3)],
  ));
  const anchoredMins = anchored.map((t) => localMinutes(tz, t.due_at)).sort((x, y) => x - y);
  let cursor = opts.workStartHour * 60;
  if (ymd === todayYMD) cursor = Math.max(cursor, Math.ceil((localMinutes(tz, now.toISOString()) + 10) / 15) * 15);
  const DAY_END = 21 * 60;
  let updated = 0;
  for (const t of floating) {
    const dur = estimateDuration({ title: t.title, category: (t.metadata || {}).category, tags: t.tags });
    for (let g = 0; g < 96; g++) { if (!anchoredMins.some((am) => Math.abs(am - cursor) < Math.min(dur, 45))) break; cursor += 15; }
    const minutes = Math.min(cursor, DAY_END);
    const iso = localMinutesToISO(tz, ymd, minutes);
    const meta = { ...(t.metadata || {}), planned: true };
    await svc.from("taskos_tasks").update({ start_at: iso, due_at: iso, remind_at: iso, urgency: deriveUrgency(iso, now), metadata: meta })
      .eq("id", t.id).eq("user_id", userId);
    updated++;
    cursor = minutes + dur;
  }
  return updated;
}

// Lay a user's FLOATING tasks across consecutive WORKING DAYS — start today if work-time
// remains (else tomorrow), and ROLL overflow onto the next day so a day is never crammed
// and an after-hours replan lands on a fresh morning, not tonight. Calls first, realistic
// durations, routing around anchored (user-timed) tasks.
async function replanForUser(svc: any, userId: string, tz: string, settings: any, now: Date): Promise<number> {
  const ws = (settings ?? {}) as any;
  const workStart = clampHour(ws.work_start_hour, 8) * 60;
  const workEnd = clampHour(ws.work_end_hour, 17) * 60;
  const callsFirst = ws.calls_first !== false;
  const todayYMD = localYMD(tz, now);
  const nowMin = localMinutes(tz, now.toISOString());
  const dayYMD = (o: number) => localYMD(tz, new Date(now.getTime() + o * 86_400_000));

  // Open tasks due in a 4-day horizon (today..+3) — enough to absorb overflow.
  const startISO = localMinutesToISO(tz, todayYMD, 0);
  const endISO = localMinutesToISO(tz, dayYMD(3), 23 * 60 + 59);
  const { data: rows } = await svc.from("taskos_tasks")
    .select("id, title, due_at, importance, priority_score, tags, metadata")
    .eq("user_id", userId).not("status", "in", "(done,cancelled)")
    .gte("due_at", startISO).lte("due_at", endISO);
  const tasks = (rows ?? []) as any[];
  if (!tasks.length) return 0;
  const isFloating = (t: any) => {
    const m = t.metadata || {};
    if (m.anchored === true) return false;
    if (m.planned === true) return true;
    return DEFAULT_PLAN_MIN.has(localMinutes(tz, t.due_at));
  };
  const floating = tasks.filter(isFloating);
  if (!floating.length) return 0;
  const callish = (t: any) => isCallish({ category: (t.metadata || {}).category, title: t.title });
  floating.sort((a, b) => cmpTuple(
    [callsFirst && callish(a) ? 0 : 1, -(a.priority_score ?? 0), -(a.importance ?? 3)],
    [callsFirst && callish(b) ? 0 : 1, -(b.priority_score ?? 0), -(b.importance ?? 3)],
  ));
  // Anchored (user-timed) tasks are per-day obstacles the plan routes around.
  const anchoredByDay = new Map<string, number[]>();
  for (const t of tasks) if (!isFloating(t)) {
    const d = localYMD(tz, new Date(t.due_at));
    const arr = anchoredByDay.get(d) ?? [];
    arr.push(localMinutes(tz, t.due_at));
    anchoredByDay.set(d, arr);
  }

  // First schedulable day: today if >=20 min of work-time remains, else tomorrow.
  let dayOff = nowMin < workEnd - 20 ? 0 : 1;
  let ymd = dayYMD(dayOff);
  let cursor = dayOff === 0 ? Math.max(workStart, Math.ceil((nowMin + 10) / 15) * 15) : workStart;
  let updated = 0;
  for (const t of floating) {
    const dur = estimateDuration({ title: t.title, category: (t.metadata || {}).category, tags: t.tags });
    let guard = 0;
    if (cursor + dur > workEnd && guard++ < 21) { dayOff++; ymd = dayYMD(dayOff); cursor = workStart; } // roll to next working day
    for (let g = 0; g < 96; g++) { // route around anchored times (re-rolling if it pushes past work-end)
      const aMins = anchoredByDay.get(ymd) ?? [];
      if (!aMins.some((am) => Math.abs(am - cursor) < Math.min(dur, 45))) break;
      cursor += 15;
      if (cursor + dur > workEnd && guard++ < 21) { dayOff++; ymd = dayYMD(dayOff); cursor = workStart; }
    }
    const iso = localMinutesToISO(tz, ymd, cursor);
    const meta = { ...(t.metadata || {}), planned: true };
    await svc.from("taskos_tasks").update({ start_at: iso, due_at: iso, remind_at: iso, urgency: deriveUrgency(iso, now), metadata: meta })
      .eq("id", t.id).eq("user_id", userId);
    updated++;
    cursor += dur;
  }
  return updated;
}

// Replan every linked user (cron / on-demand). Covers users with no settings row.
async function replanAll(svc: any): Promise<any> {
  const now = new Date();
  const { data: settingsRows } = await svc.from("taskos_user_settings").select("user_id, timezone, settings");
  const byUser = new Map<string, any>();
  for (const s of settingsRows ?? []) byUser.set(s.user_id, s);
  const { data: links } = await svc.from("taskos_telegram_links").select("user_id").eq("is_active", true);
  for (const l of links ?? []) if (!byUser.has(l.user_id)) byUser.set(l.user_id, { user_id: l.user_id, timezone: null, settings: {} });
  let users = 0, tasks = 0;
  for (const s of byUser.values()) {
    const n = await replanForUser(svc, s.user_id, s.timezone ?? "Africa/Johannesburg", s.settings, now);
    if (n) { users++; tasks += n; }
  }
  return { ok: true, users, tasks };
}

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

    // Semantic recall — the user's existing tasks/notes/people MOST RELEVANT to
    // this capture (not just the 40 newest). This is the "memory of past tasks":
    // it lets the model link to, dedupe against, and enrich from real history.
    const rawEmb = await embedText(row.raw_text);
    let related: any[] = [];
    if (rawEmb) {
      try {
        const { data: rel } = await svc.rpc("taskos_semantic_search_svc", {
          p_user: ownerUserId, query_embedding: toVectorLiteral(rawEmb), match_count: 8,
        });
        related = Array.isArray(rel) ? rel : [];
      } catch (e) { console.error("[taskos-process-inbox] recall failed", e instanceof Error ? e.message : e); }
    }

    const now = new Date();
    const payload = {
      time_context: buildTimeContext(now, tz),
      item: wrapUntrusted(row.raw_text),
      existing_entities: (ctxEntities ?? []).map((e: any) => ({ id: e.id, kind: e.kind, title: e.title })),
      related_memory: related.map((r: any) => ({
        id: r.id, kind: r.kind, title: r.title,
        body: typeof r.body === "string" ? r.body.slice(0, 200) : "", due_at: r.due_at,
      })),
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
    // temp_id / existing-id -> { kind, id } so we can resolve links + dedupe.
    const idMap = new Map<string, { kind: "task" | "entity"; id: string }>();
    for (const e of ctxEntities ?? []) idMap.set(e.id, { kind: "entity", id: e.id });
    // Recalled memory is also link/dedupe-resolvable by its real id.
    for (const r of related) idMap.set(r.id, { kind: r.kind === "task" ? "task" : "entity", id: r.id });

    let created = 0, dedupSkipped = 0;
    const newGoalIds: string[] = []; // NEW goal/deadline entities to decompose into sub-tasks
    // ---- Phase 1: PREP every entity (no DB writes yet) so the day-planner can
    // re-time a batch of tasks before any of them is persisted. ----
    interface Prepared {
      temp_id?: string; type: string; title: string; body: string;
      dueAt: string | null; startAt: string | null; remindAt: string | null;
      importance: number; urgency: number; anchored: boolean;
      category: string | null; planOrder: number | null; tags: string[];
      embLit: string | null; planned?: boolean;
    }
    const prepared: Prepared[] = [];
    for (const ent of entities) {
      const type = String(ent?.type ?? "").toLowerCase();
      if (!ALLOWED_TYPES.has(type)) continue; // whitelist — drop hallucinated types

      // Dedupe: model says this is the same as an existing OPEN task. Don't create a
      // second one — refresh the existing task's progress timestamp and route any
      // links for this temp_id to the real task instead.
      const dupRef = typeof ent?.duplicate_of === "string" ? idMap.get(ent.duplicate_of) : null;
      if (type === "task" && dupRef && dupRef.kind === "task") {
        await svc.from("taskos_tasks").update({ last_progress_at: nowISO() }).eq("id", dupRef.id).eq("user_id", ownerUserId);
        if (ent?.temp_id) idMap.set(String(ent.temp_id), { kind: "task", id: dupRef.id });
        dedupSkipped++;
        continue;
      }
      const title = String(ent?.title ?? "").slice(0, 500) || "(untitled)";
      const body = typeof ent?.body === "string" ? ent.body : "";
      let dueAt = localWallToUtcISO(ent?.due_at, tz);
      // Time backstop: model dropped the time but the text states one. Prefer THIS
      // entity's own title/body; fall back to the whole capture ONLY when it contains a
      // single, unambiguous clock time (so one task's time is never stamped onto another).
      let recoveredTime = false;
      if (!dueAt && TIME_BOUND.has(type)) {
        const t = extractClockTime(`${title}\n${body}`) ??
          (clockTimeCount(row.raw_text) === 1 ? extractClockTime(row.raw_text) : null);
        if (t) { dueAt = nextLocalTimeISO(now, tz, t.hh, t.mm); recoveredTime = true; }
      }
      let remindAt = localWallToUtcISO(ent?.remind_at, tz);
      // Reminder backstop: anything time-bound with a due time MUST nudge the user.
      if (!remindAt && dueAt && TIME_BOUND.has(type)) remindAt = dueAt;
      const tags = Array.isArray(ent?.tags) ? ent.tags.map((t: any) => String(t)).slice(0, 20) : [];
      // "Anchored" = a FIXED clock time the day-planner must NOT move: the model flagged it
      // (time_explicit), we recovered an explicit time from the text, OR it carries a real
      // due time that isn't the 09:00 day-plan placeholder. This protects real appointments
      // even if the model forgets the time_explicit flag.
      const anchored = ent?.time_explicit === true || recoveredTime ||
        (dueAt != null && localMinutes(tz, dueAt) !== PLACEHOLDER_MIN);
      const emb = await embedText(`${title}\n${body}`);
      prepared.push({
        temp_id: ent?.temp_id ? String(ent.temp_id) : undefined,
        type, title, body, dueAt, startAt: null, remindAt,
        importance: clampImportance(ent?.importance), urgency: 3,
        anchored,
        category: typeof ent?.category === "string" ? ent.category : null,
        planOrder: Number.isInteger(ent?.plan_order) ? ent.plan_order : null,
        tags, embLit: emb ? toVectorLiteral(emb) : null,
      });
    }

    // ---- Phase 2: PLAN the day. Lay a same-day batch of floating tasks across
    // working hours (calls/feedback first). Mutates each task record's times. ----
    const ws = (settings?.settings ?? {}) as any;
    planDay(prepared.filter((p) => p.type === "task") as unknown as PlanTask[], now, tz, {
      workStartHour: clampHour(ws.work_start_hour, 8),
      workEndHour: clampHour(ws.work_end_hour, 17),
      slotMin: Number.isFinite(ws.plan_slot_minutes) ? Math.max(15, Math.min(180, Number(ws.plan_slot_minutes))) : 45,
      callsFirst: ws.calls_first !== false, // default ON — the owner's "calls first" rule
    });

    // ---- Phase 3: INSERT. Urgency is derived AFTER planning so a freshly-slotted
    // today task reads as correctly urgent. ----
    for (const p of prepared) {
      const urgency = deriveUrgency(p.dueAt, now);
      if (p.type === "task") {
        const metadata: Record<string, unknown> = {};
        if (p.planned) metadata.planned = true;
        if (p.anchored) metadata.anchored = true; // user gave it a real time — replanner won't move it
        if (p.category) metadata.category = p.category;
        const { data: ins } = await svc.from("taskos_tasks").insert({
          user_id: ownerUserId, title: p.title, description: p.body || null,
          due_at: p.dueAt, start_at: p.startAt ?? null, remind_at: p.remindAt ?? p.dueAt,
          urgency, importance: p.importance, tags: p.tags, source_inbox_id: inboxId,
          ...(Object.keys(metadata).length ? { metadata } : {}),
          ...(p.embLit ? { embedding: p.embLit } : {}),
        }).select("id").maybeSingle();
        if (ins?.id && p.temp_id) idMap.set(p.temp_id, { kind: "task", id: ins.id });
      } else {
        const { data: ins } = await svc.from("taskos_entities").insert({
          user_id: ownerUserId, kind: p.type, title: p.title, body: p.body,
          due_at: p.dueAt, remind_at: p.remindAt, importance: p.importance, tags: p.tags, source_inbox_id: inboxId,
          ...(p.embLit ? { embedding: p.embLit } : {}),
        }).select("id").maybeSingle();
        if (ins?.id && p.temp_id) idMap.set(p.temp_id, { kind: "entity", id: ins.id });
        // A NEW deadline-goal (has a due date) → decompose into candidate sub-tasks.
        if (ins?.id && (p.type === "goal" || p.type === "deadline") && p.dueAt) newGoalIds.push(ins.id);
      }
      created++;
    }

    // Knowledge-graph edges (only when both ends resolved; ignore dup unique-violations).
    const links: any[] = Array.isArray(parsed?.links) ? parsed.links : [];
    const goalTargets = new Set<string>(); // goal/project entities that gained activity
    for (const ln of links) {
      const f = idMap.get(String(ln?.from));
      const t = idMap.get(String(ln?.to));
      const relation = REL_ENUM.includes(ln?.relation) ? ln.relation : null;
      if (!f || !t || !relation || (f.id === t.id)) continue;
      const { error } = await svc.from("taskos_links").insert({
        user_id: ownerUserId, from_kind: f.kind, from_id: f.id, to_kind: t.kind, to_id: t.id, relation,
      });
      if (error && (error as any).code !== "23505") console.error("[taskos-process-inbox] link insert", error.message);
      if (t.kind === "entity" && ["part_of", "about", "relates_to"].includes(relation)) goalTargets.add(t.id);
    }

    // Refresh goal/project activity so the goal-health tracker sees momentum when a
    // new task is linked to a goal. Filtered to goal/project kinds in the update.
    if (goalTargets.size) {
      await svc.from("taskos_entities").update({ last_activity_at: nowISO() })
        .in("id", [...goalTargets]).in("kind", ["goal", "project"]).eq("user_id", ownerUserId);
    }

    // Re-plan the user's WHOLE schedule (not just this capture's batch) so the day stays
    // coherent — calls first, realistic durations, overflow rolling to the next working
    // day. This is what keeps single-task captures from piling up at one time.
    try {
      if (prepared.some((p) => p.type === "task" && p.dueAt)) {
        await replanForUser(svc, ownerUserId, tz, settings?.settings, now);
      }
    } catch (e) { console.error("[taskos-process-inbox] replan", e instanceof Error ? e.message : e); }

    // Goal/Deadline engine: break each NEW deadline-goal into candidate sub-tasks and
    // DM the user per-step ✅ Add / ⏭ Skip questions. Fire-and-forget (kept alive past
    // the response via waitUntil) so capture never blocks on the model + Telegram round-trip.
    // Wrapped so a trigger hiccup can NEVER flip an already-successful capture to 'failed'.
    try {
      if (newGoalIds.length) {
        const baseUrl = Deno.env.get("SUPABASE_URL");
        const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const internalKey = Deno.env.get("LUMINA_INTERNAL_API_KEY") ?? "";
        for (const gid of newGoalIds) {
          const p = fetch(`${baseUrl}/functions/v1/taskos-goal-decompose`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${service}`, "x-lumina-key": internalKey },
            body: JSON.stringify({ goal_entity_id: gid }),
          }).catch((e) => console.error("[taskos-process-inbox] decompose trigger", e instanceof Error ? e.message : e));
          if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p); else await p;
        }
      }
    } catch (e) { console.error("[taskos-process-inbox] decompose", e instanceof Error ? e.message : e); }

    // created===0 alone no longer means "needs review": a pure-dedup capture (handled
    // against an existing task) is a successful, fully-processed outcome.
    const needsReview = parsed?.needs_review === true
      || (typeof parsed?.confidence === "number" && parsed.confidence < 0.5)
      || (created === 0 && dedupSkipped === 0);
    await svc.from("taskos_inbox_items").update({
      status: needsReview ? "needs_review" : "processed",
      processed_at: nowISO(),
      ai_result: { ...parsed, _model: modelUsed, _dedup_skipped: dedupSkipped, _related_recalled: related.length },
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

  // Re-plan today+tomorrow for all linked users (cron / on-demand). Idempotent — safe to
  // re-run; rebuilds a coherent daily schedule from each user's open tasks.
  if (bodyJson?.mode === "replan") {
    try { return json(await replanAll(svc)); }
    catch (e) { console.error("[taskos-process-inbox] replan", e instanceof Error ? e.message : e); return json({ error: "replan failed" }, 500); }
  }

  const inboxId = bodyJson?.inbox_item_id;
  if (!inboxId) return json({ error: "inbox_item_id required" }, 400);
  const result = await processOne(svc, String(inboxId));
  return json({ ok: true, ...result });
});
