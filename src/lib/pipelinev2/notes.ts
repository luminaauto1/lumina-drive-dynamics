// Structured pipeline notes for Pipeline v2.
//
// Notes live in a dedicated `finance_applications.pipeline_notes` JSONB column
// (array, newest-first) so each note can carry an author, a timestamp and an
// optional category badge — WITHOUT touching the legacy free-text `notes`
// column (still read verbatim by AdminFinance + the pre-approval WhatsApp).
// Writing a note is a pure data write — it fires none of the notify-* /
// easysocial side-effects that a status change does.

import { supabase } from '@/integrations/supabase/client';

export interface PipelineNote {
  id: string;
  body: string;
  category: string;          // one of NOTE_CATEGORIES keys
  author_id: string | null;
  author_name: string;       // display name captured at write time
  created_at: string;        // ISO timestamp
  /** Only set for parsed legacy free-text notes — a human stamp, not ISO. */
  legacyStamp?: string;
}

export interface NoteCategoryDef {
  key: string;
  label: string;
  emoji?: string;
  /** Brand-consistent badge classes (mirrors internalStatusConfig palette). */
  color: string;
}

// Workflow-relevant tags an F&I/admin reaches for, in roughly pipeline order.
// `note` is the neutral default (no coloured badge).
// NOTE: the Notes composer no longer OFFERS the status-lookalike categories
// (actioned, callback, docs_received, vals_*, contract_signed, follow_up) —
// they duplicated the client-status vocabulary and staff picked them believing
// they set the client status (see fix/client-status-note-trap). They remain
// here ONLY so old notes still resolve a label/colour via noteCategory().
export const NOTE_CATEGORIES: NoteCategoryDef[] = [
  { key: 'note',            label: 'Note',            color: 'bg-muted text-muted-foreground border-border' },
  { key: 'actioned',        label: 'Actioned',        color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { key: 'callback',        label: 'Callback',        color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { key: 'docs_received',   label: 'Docs Received',   color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  { key: 'vals_pending',    label: 'Vals Pending',    color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { key: 'vals_done',       label: 'Vals Done',       color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  { key: 'contract_signed', label: 'Contract Signed', emoji: '🎉', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { key: 'follow_up',       label: 'Follow Up',       color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  // A comment a PERSON typed while changing a status (the comment gate, the
  // change-status modal, bulk apply, Finance/Deal Room/CRM). User content — it
  // shows in the table's Notes column like any other note.
  { key: 'status_change',   label: 'Status Change',   color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  // WhatsApp To Client Info text captured when a status with wa_client_info_enabled is applied.
  { key: 'client_whatsapp', label: 'WhatsApp to client', emoji: '💬', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  // The AUTO-STAMP written by useUpdateClientStatus ("Client status → X") so the
  // day's outcome survives the nightly client_status reset. System-generated —
  // never typed by a person, so it stays out of the Notes column.
  { key: 'client_status_set', label: 'Client status', color: 'bg-muted text-muted-foreground border-border' },
];

export const noteCategory = (key: string | undefined | null): NoteCategoryDef =>
  NOTE_CATEGORIES.find((c) => c.key === key) || NOTE_CATEGORIES[0];

// System/event notes — written by the app itself, never typed by a person.
// Excluded from the pipeline table's Notes column (owner 2026-07-18: "Notes are
// for the notes left by the user"); still visible with their tags in the drawer
// feed and history.
//
// NOTE: 'status_change' is deliberately NOT here. It is the category SIX
// user-facing surfaces use for the comment a person types while changing a
// status (change-status modal, bulk apply, comment gate, Finance, Deal Room,
// CRM). Treating it as system hid those real comments from the Notes column
// (owner report 2026-07-20: "I changed a client's status and also left a note
// but the note is not showing"). Only the auto-stamp is system.
export const SYSTEM_NOTE_CATEGORIES = new Set(['client_status_set', 'client_whatsapp']);

/** Body written by the client-status auto-stamp; used for the legacy guard below. */
const LEGACY_AUTO_STAMP = /^Client status\s*→/;

/**
 * Is this note machine-written (so it must not occupy the Notes column)?
 * Category is the source of truth going forward. The regex is a LEGACY guard:
 * auto-stamps written between 2026-07-18 and 2026-07-20 used 'status_change'
 * (the same category as user comments), so they can only be told apart by their
 * generated body. Cheap, exact, and self-retiring as those notes age out.
 */
export function isSystemNote(n: Pick<PipelineNote, 'category' | 'body'>): boolean {
  if (SYSTEM_NOTE_CATEGORIES.has(n.category)) return true;
  return n.category === 'status_change' && LEGACY_AUTO_STAMP.test(n.body ?? '');
}

/** Structured notes stored on the app row (newest-first). Defensive read. */
export function readPipelineNotes(app: any): PipelineNote[] {
  const raw = app?.pipeline_notes;
  if (!Array.isArray(raw)) return [];
  return raw.filter((n) => n && typeof n.body === 'string') as PipelineNote[];
}

/**
 * Parse the legacy free-text `notes` column ("[24 Jun 2026 09:02] body\n\n…")
 * into read-only entries so historical notes survive the move to the
 * structured model. Author is unknown for these.
 */
export function readLegacyNotes(app: any): PipelineNote[] {
  const notes = typeof app?.notes === 'string' ? app.notes : '';
  if (!notes.trim()) return [];
  return notes
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((chunk, i) => {
      const m = chunk.match(/^\[(.+?)\]\s*([\s\S]*)$/);
      return {
        id: `legacy-${i}`,
        body: m ? m[2] : chunk,
        category: 'note',
        author_id: null,
        author_name: '',
        created_at: '',
        legacyStamp: m ? m[1] : '',
      } as PipelineNote;
    });
}

/** Most recent structured note, for the compact pipeline-table cell. */
export function latestPipelineNote(app: any): PipelineNote | null {
  const notes = readPipelineNotes(app);
  return notes.length ? notes[0] : null;
}

// Best-effort timestamp for a legacy human stamp. Known shapes:
//   "2026/07/15, 14:20:35"  (toLocaleString en-ZA)
//   "24 Jun 2026 09:02"     (older entries, with year)
//   "15 Jul, 14:20"         (CRM modal entries, NO year → assume current,
//                            roll back a year if that lands in the future)
function parseLegacyStamp(stamp: string | undefined): number | null {
  if (!stamp) return null;
  let m = stamp.match(/(\d{4})\/(\d{2})\/(\d{2})[^\d]+(\d{1,2}):(\d{2})/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return isNaN(+d) ? null : +d;
  }
  m = stamp.match(/(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s*(\d{4})?[^\d]*(\d{1,2}):(\d{2})/);
  if (m) {
    const year = m[3] ? +m[3] : new Date().getFullYear();
    const d = new Date(`${m[2]} ${m[1]}, ${year} ${m[4]}:${m[5]}`);
    if (isNaN(+d)) return null;
    let ts = +d;
    if (!m[3] && ts > Date.now() + 26 * 3600 * 1000) ts -= 365 * 24 * 3600 * 1000;
    return ts;
  }
  return null;
}

/**
 * The single NEWEST note across BOTH note systems — structured pipeline_notes
 * AND the legacy free-text blob the Finance CRM popup writes (owner 2026-07-17:
 * the pipeline Notes column showed "—" for clients whose notes only live in the
 * blob). Legacy entries get their «ROLE» sentinel stripped and the author
 * pulled out for display. When the legacy stamp can't be parsed, the structured
 * note (which has a real timestamp) wins.
 */
export function latestAnyNote(app: any): PipelineNote | null {
  return newestVsLegacy(latestPipelineNote(app), app);
}

/**
 * The newest USER-written note — same legacy merge as latestAnyNote, but
 * structured notes in SYSTEM_NOTE_CATEGORIES are skipped so a client-status
 * auto-note (or a WhatsApp-send log) can't displace the user's note in the
 * table's Notes column. Legacy blob entries are always user-written.
 */
export function latestUserNote(app: any): PipelineNote | null {
  const p = readPipelineNotes(app).find((n) => !isSystemNote(n)) ?? null;
  return newestVsLegacy(p, app);
}

/** Shared merge: the given structured note vs the newest legacy-blob entry. */
function newestVsLegacy(p: PipelineNote | null, app: any): PipelineNote | null {
  const rawLegacy = readLegacyNotes(app)[0] ?? null;

  let legacy: PipelineNote | null = null;
  if (rawLegacy) {
    // "«FNI» Albert — Ready to Submit: body" → author "Albert", body after the dash.
    const m = rawLegacy.body.match(/^(?:«(?:ADMIN|SALES|FNI|STAFF)»\s*)?([^—\n]{0,40}?)\s*—\s*([\s\S]+)$/);
    legacy = {
      ...rawLegacy,
      author_name: m ? m[1].trim() : '',
      body: m ? m[2].trim() : rawLegacy.body.replace(/«(ADMIN|SALES|FNI|STAFF)»\s*/, ''),
    };
  }

  if (!p) return legacy;
  if (!legacy) return p;
  const pTs = p.created_at ? new Date(p.created_at).getTime() : 0;
  const lTs = parseLegacyStamp(legacy.legacyStamp);
  return lTs != null && lTs > pTs ? legacy : p;
}

function makeId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch { /* fall through */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Prepend a structured note and persist. Pure data write — no notifications. */
export async function addPipelineNote(
  app: any,
  input: { body: string; category: string; author_id: string | null; author_name: string },
): Promise<{ error: string | null }> {
  const body = input.body.trim();
  if (!body) return { error: 'Note is empty' };
  const note: PipelineNote = {
    id: makeId(),
    body,
    category: input.category || 'note',
    author_id: input.author_id,
    author_name: input.author_name || 'Unknown',
    created_at: new Date().toISOString(),
  };
  // Prepend onto the notes as they are IN THE DB right now, not onto the caller's
  // copy of the row. The write replaces the whole jsonb array, so building it from
  // a row fetched earlier silently erases anything written in between — e.g. a
  // client-status change stamps its "Client status → X" note, then the comment
  // typed in the same modal submit wiped it (owner-visible: the status record
  // vanished from the history). Re-reading here fixes that for every caller at
  // once. If the read fails we fall back to the passed row, so a note is never
  // lost to a transient error. Residual: two clients writing a note to the SAME
  // application within the same instant can still race — that needs a server-side
  // jsonb append (RPC) and is out of scope for this fix.
  const { data: fresh } = await supabase
    .from('finance_applications')
    .select('pipeline_notes')
    .eq('id', app.id)
    .maybeSingle();
  const next = [note, ...readPipelineNotes(fresh ?? app)];
  const { error } = await supabase
    .from('finance_applications')
    .update({ pipeline_notes: next } as any)
    .eq('id', app.id);
  return { error: error ? error.message : null };
}
