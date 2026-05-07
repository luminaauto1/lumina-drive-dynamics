// EasySocial Tag Sync — pushes CRM status updates back to EasySocial as tag mutations.
// Strictly isolated from notify-* functions. Safe to call from frontend after a status update.
//
// Request body: { phone_number: string; new_status: string; old_status?: string }
// Response:     { ok: boolean; intended: { remove: number[]; add: number[] }; upstream?: any }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// EasySocial Tag IDs (provided by admin)
const TAG_IDS = {
  NEW_LEAD: 1346,
  APP_SUBMITTED: 1332,
  BLACKLISTED: 1316,
  DECLINED: 1334,
} as const;

// Map a CRM status -> EasySocial Tag ID to add. New Lead is always removed.
const STATUS_TO_TAG_ID: Record<string, number> = {
  pending: TAG_IDS.APP_SUBMITTED,
  application_submitted: TAG_IDS.APP_SUBMITTED,
  sent_to_banks: TAG_IDS.APP_SUBMITTED,
  validations_pending: TAG_IDS.APP_SUBMITTED,
  revision_submitted: TAG_IDS.APP_SUBMITTED,
  declined: TAG_IDS.DECLINED,
  declined_conditional: TAG_IDS.DECLINED,
  blacklisted: TAG_IDS.BLACKLISTED,
};

const ES_ENDPOINT = (phone: string) => `https://client-api.e-so.in/api/v1/leads/${phone}/update`;

interface SyncBody {
  phone_number?: string;
  new_status?: string;
  old_status?: string;
}

/**
 * Validate and clean phone number to EasySocial international format.
 * - Strip whitespace and non-numeric chars.
 * - If starts with 0, replace leading 0 with 27 (South Africa).
 * Returns null if the result isn't a plausible international number.
 */
const validateAndCleanPhoneNumber = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = `27${digits.slice(1)}`;
  // Reject obvious garbage; SA mobile numbers in international form are 11 digits.
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
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

  const phone = validateAndCleanPhoneNumber(body.phone_number);
  const newStatus = String(body.new_status || '').toLowerCase().trim();

  if (!phone || !newStatus) {
    return new Response(JSON.stringify({ error: 'missing or invalid phone_number / new_status' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const targetTagId = STATUS_TO_TAG_ID[newStatus];
  if (!targetTagId) {
    console.log('[tag-sync] no mapping for status, skipping', { phone, newStatus });
    return new Response(JSON.stringify({ ok: true, skipped: 'no_tag_mapping', status: newStatus }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const intended = { remove: [TAG_IDS.NEW_LEAD], add: [targetTagId] };
  const esKey = Deno.env.get('EASYSOCIAL_API_KEY');

  if (!esKey) {
    console.warn('[tag-sync] EASYSOCIAL_API_KEY not configured');
    return new Response(JSON.stringify({ ok: false, intended, error: 'EASYSOCIAL_API_KEY not set' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = ES_ENDPOINT(phone);
  const payload = {
    remove_tags: intended.remove,
    add_tags: intended.add,
    tags: intended.add, // include both per common REST conventions
  };

  let upstreamStatus = 0;
  let upstreamBody: any = null;
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${esKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    upstreamStatus = res.status;
    const text = await res.text();
    try { upstreamBody = JSON.parse(text); } catch { upstreamBody = text; }

    if (res.ok) {
      console.log('[tag-sync] SUCCESS', { phone, newStatus, intended, upstreamStatus, upstreamBody });
    } else {
      console.error('[tag-sync] UPSTREAM ERROR', { phone, newStatus, intended, upstreamStatus, upstreamBody });
    }
  } catch (e) {
    console.error('[tag-sync] fetch failed', { phone, error: String((e as Error).message ?? e) });
    return new Response(JSON.stringify({ ok: false, intended, error: String((e as Error).message ?? e) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      ok: upstreamStatus >= 200 && upstreamStatus < 300,
      phone,
      intended,
      upstream: { status: upstreamStatus, body: upstreamBody },
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
