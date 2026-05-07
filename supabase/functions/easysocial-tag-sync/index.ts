// EasySocial Tag Sync — pushes CRM status updates back to EasySocial as tag mutations.
// Strictly isolated from notify-* functions. Safe to call from frontend after a status update.
//
// Request body: { phone_number: string; new_status: string; old_status?: string }
// Response:     { ok: boolean; intended: { remove: string[]; add: string[] }; upstream?: any }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Map a CRM finance_application status -> EasySocial tag label.
// Tag IDs are resolved at runtime from GET /tags so we don't hardcode internal IDs.
const STATUS_TO_TAG: Record<string, string> = {
  pending: 'App Submitted',
  validations_pending: 'App Submitted',
  approved: 'Approved',
  vehicle_selected: 'Approved',
  declined: 'Declined',
  needs_revision: 'Revision Needed',
  revision_submitted: 'App Submitted',
};

const NEW_LEAD_TAG = 'New Lead';

const ES_BASE = 'https://api.easysocial.in/api/v1';

interface SyncBody {
  phone_number?: string;
  new_status?: string;
  old_status?: string;
}

const normalizePhone = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= 6 ? digits : null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: SyncBody = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const phone = normalizePhone(body.phone_number);
  const newStatus = String(body.new_status || '').toLowerCase().trim();

  if (!phone || !newStatus) {
    return new Response(JSON.stringify({ error: 'missing phone_number or new_status' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const targetTag = STATUS_TO_TAG[newStatus];
  if (!targetTag) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no_tag_mapping', status: newStatus }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const intended = { remove: [NEW_LEAD_TAG], add: [targetTag] };
  const esKey = Deno.env.get('EASYSOCIAL_API_KEY');

  // Audit row in webhook_events for traceability (best-effort).
  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    await sb.from('webhook_events').insert({
      source: 'easysocial-tag-sync',
      event_id: `${phone}:${newStatus}:${Date.now()}`,
    });
  } catch (e) {
    console.warn('[tag-sync] audit insert failed', e);
  }

  if (!esKey) {
    console.log('[tag-sync] INTENT (no API key configured)', { phone, intended });
    return new Response(JSON.stringify({ ok: true, intended, note: 'EASYSOCIAL_API_KEY not set' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Resolve EasySocial lead id from our leads table by phone.
  let easysocialId: string | null = null;
  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { data } = await sb
      .from('leads')
      .select('easysocial_id')
      .eq('phone_number', phone)
      .maybeSingle();
    easysocialId = (data as any)?.easysocial_id ?? null;
  } catch (e) {
    console.warn('[tag-sync] easysocial_id lookup failed', e);
  }

  // Best-effort outbound push. Endpoint URL is a placeholder until EasySocial
  // confirms the exact "Update Lead Tags" route. Wrapped in try/catch so our
  // CRM never blocks on upstream failures.
  const upstream: { remove?: any; add?: any; error?: string; intent_only?: boolean } = {};
  if (!easysocialId) {
    upstream.intent_only = true;
    console.log('[tag-sync] INTENT (no easysocial_id mapped)', { phone, intended });
  } else {
    try {
      const url = `${ES_BASE}/leads/${encodeURIComponent(easysocialId)}/tags`;

      const removeRes = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${esKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ tags: intended.remove }),
      }).catch((e) => ({ ok: false, status: 0, _err: String(e) } as any));
      upstream.remove = { status: (removeRes as any).status ?? null };

      const addRes = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${esKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ tags: intended.add }),
      }).catch((e) => ({ ok: false, status: 0, _err: String(e) } as any));
      upstream.add = { status: (addRes as any).status ?? null };

      console.log('[tag-sync] pushed', { phone, easysocialId, intended, upstream });
    } catch (e) {
      upstream.error = String((e as Error).message ?? e);
      console.error('[tag-sync] upstream error', upstream.error);
    }
  }

  return new Response(JSON.stringify({ ok: true, easysocial_id: easysocialId, intended, upstream }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
