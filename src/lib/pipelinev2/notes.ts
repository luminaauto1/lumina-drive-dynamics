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
export const NOTE_CATEGORIES: NoteCategoryDef[] = [
  { key: 'note',            label: 'Note',            color: 'bg-muted text-muted-foreground border-border' },
  { key: 'actioned',        label: 'Actioned',        color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { key: 'callback',        label: 'Callback',        color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { key: 'docs_received',   label: 'Docs Received',   color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  { key: 'vals_pending',    label: 'Vals Pending',    color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { key: 'vals_done',       label: 'Vals Done',       color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  { key: 'contract_signed', label: 'Contract Signed', emoji: '🎉', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { key: 'follow_up',       label: 'Follow Up',       color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  // Gated comments captured when a status with comment_required is applied.
  { key: 'status_change',   label: 'Status Change',   color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
];

export const noteCategory = (key: string | undefined | null): NoteCategoryDef =>
  NOTE_CATEGORIES.find((c) => c.key === key) || NOTE_CATEGORIES[0];

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
  const next = [note, ...readPipelineNotes(app)];
  const { error } = await supabase
    .from('finance_applications')
    .update({ pipeline_notes: next } as any)
    .eq('id', app.id);
  return { error: error ? error.message : null };
}
