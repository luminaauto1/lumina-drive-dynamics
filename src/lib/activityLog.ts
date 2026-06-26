// Universal activity trail — a single fire-and-forget logger used at every
// meaningful action (status change, note, credit check, document upload, contract,
// deal finalize, application create…). Writes to the existing `client_audit_logs`
// table, stamped with the acting person's real name + time, and linked to the
// application/deal so it surfaces in the unified timeline (HistoryFeed, ClientTimeline).
//
// Design rules:
//  • NEVER throws — logging must never break the action it accompanies.
//  • Resolves the actor (auth user → profiles.full_name) once per user, cached.
//  • Callers may pass a pre-resolved actorName to skip the lookup.
import { supabase } from '@/integrations/supabase/client';

export type ActivityActionType =
  | 'status_change'
  | 'note'
  | 'credit_check'
  | 'document_upload'
  | 'contract'
  | 'deal_finalized'
  | 'application_created'
  | 'assignment'
  | 'other';

export interface LogActivityArgs {
  actionType: ActivityActionType | string;
  note: string;
  applicationId?: string | null;
  dealId?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  /** Pre-resolved actor (skips the profile lookup when the caller already has it). */
  actorId?: string | null;
  actorName?: string | null;
}

// Cache display names by user id (per browser session). getSession() is local-only
// (no network), so resolving the actor is cheap after the first lookup.
const nameCache = new Map<string, string>();

async function resolveActor(): Promise<{ id: string | null; name: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return { id: null, name: 'Staff' };
    if (nameCache.has(user.id)) return { id: user.id, name: nameCache.get(user.id)! };
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', user.id)
      .maybeSingle();
    const name =
      (profile as any)?.full_name || (profile as any)?.email || user.email || 'Staff';
    nameCache.set(user.id, name);
    return { id: user.id, name };
  } catch {
    return { id: null, name: 'Staff' };
  }
}

/** Record one activity entry. Fire-and-forget — awaitable but never rejects. */
export async function logActivity(args: LogActivityArgs): Promise<void> {
  try {
    let actorId = args.actorId ?? null;
    let actorName = args.actorName ?? null;
    if (!actorName) {
      const a = await resolveActor();
      actorId = actorId ?? a.id;
      actorName = a.name;
    }
    await (supabase as any).from('client_audit_logs').insert({
      action_type: args.actionType,
      note: args.note,
      author_id: actorId,
      author_name: actorName,
      application_id: args.applicationId ?? null,
      deal_id: args.dealId ?? null,
      client_email: args.clientEmail ?? null,
      client_phone: args.clientPhone ?? null,
    });
  } catch (e) {
    // Non-fatal: the trail is best-effort and must never block the real action.
    console.warn('[activityLog] failed (non-fatal):', e);
  }
}

/** Humanize a status key ("contract_signed" → "Contract Signed") for generic notes. */
export function humanizeStatus(s?: string | null): string {
  if (!s) return '';
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
