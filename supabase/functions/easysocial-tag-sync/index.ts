// EasySocial Tag Sync — dynamic tag state machine.
// Resolves tag IDs from EasySocial at runtime (no hardcoded IDs), enforces a
// safe-list of permanent tags, and steps the lead through a hierarchical
// add/remove flow based on the new CRM status.
//
// Request body: {
//   phone_number: string;
//   new_status: string;
//   old_status?: string;
//   flags?: string[]; // optional: 'low_income' | 'bad_credit' | 'no_licence'
// }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ES_BASE = 'https://client-api.e-so.in';
const ES_TAGS_ENDPOINT = `${ES_BASE}/engage/v1/tags`;
const ES_LEAD_UPDATE = (phone: string) => `${ES_BASE}/api/v1/leads/${phone}/update`;

// Permanent tags that must NEVER be removed (traffic sources, ops markers).
const SAFE_TAG_NAMES = ['TikTok Ads Lead', 'Dev Test', 'Operational'] as const;

// Phase tag names used by the state machine. Names must match EasySocial exactly.
const PHASE = {
  NEW_LEAD: 'New Lead',
  APP_RECEIVED: 'Application Received',
  APP_SUBMITTED: 'App Submitted',
  VALIDATIONS_PENDING: 'Validations Pending',
  APPROVED_NEED_DOCS: 'Approved - Need Docs',
  DECLINED: 'Application Declined',
  BLACKLISTED: 'Blacklisted',
} as const;

// Flag → tag name map (sub-classification tags).
const FLAG_TO_TAG: Record<string, string> = {
  low_income: 'Low Income',
  bad_credit: 'Bad Credit',
  no_licence: 'No Licence',
  no_license: 'No Licence',
};

interface SyncBody {
  phone_number?: string;
  new_status?: string;
  old_status?: string;
  flags?: string[];
}

interface PlanStep { add: string[]; remove: string[]; }

/** Sanitize phone to international digits. SA leading 0 → 27. */
const cleanPhone = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  let d = String(raw).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('0')) d = `27${d.slice(1)}`;
  if (d.length < 10 || d.length > 15) return null;
  return d;
};

/** Build the add/remove plan (by tag NAME) for a given CRM status. */
const planForStatus = (status: string): PlanStep => {
  const s = status.toLowerCase().trim();
  switch (s) {
    case 'pending':
      return {
        add: [PHASE.APP_RECEIVED],
        remove: [PHASE.NEW_LEAD],
      };
    case 'application_submitted':
    case 'sent_to_banks':
    case 'revision_submitted':
      return {
        add: [PHASE.APP_SUBMITTED],
        remove: [PHASE.NEW_LEAD, PHASE.APP_RECEIVED],
      };
    case 'validations_pending':
      return {
        add: [PHASE.VALIDATIONS_PENDING],
        remove: [PHASE.NEW_LEAD, PHASE.APP_RECEIVED],
      };
    case 'pre_approved':
    case 'approved':
    case 'documents_received':
    case 'validations_complete':
    case 'vehicle_selected':
    case 'contract_sent':
    case 'contract_signed':
    case 'vehicle_delivered':
    case 'finalized':
      return {
        add: [PHASE.APPROVED_NEED_DOCS],
        remove: [PHASE.NEW_LEAD, PHASE.APP_RECEIVED, PHASE.APP_SUBMITTED, PHASE.VALIDATIONS_PENDING],
      };
    case 'declined':
    case 'declined_conditional':
      return {
        add: [PHASE.DECLINED],
        remove: [PHASE.NEW_LEAD, PHASE.APP_RECEIVED, PHASE.APP_SUBMITTED, PHASE.VALIDATIONS_PENDING],
      };
    case 'blacklisted':
      return {
        add: [PHASE.BLACKLISTED],
        remove: [PHASE.NEW_LEAD, PHASE.APP_RECEIVED, PHASE.APP_SUBMITTED],
      };
    default:
      return { add: [], remove: [] };
  }
};

/** Fetch all tags from EasySocial and build a {name: id} dictionary. */
const fetchTagDictionary = async (apiKey: string): Promise<Record<string, number>> => {
  console.log('[tag-sync] GET tags →', ES_TAGS_ENDPOINT, '(token len=', apiKey.length, ')');
  const res = await fetch(ES_TAGS_ENDPOINT, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  console.log('[tag-sync] tag list response status=', res.status, 'body=', text.slice(0, 500));
  if (!res.ok) {
    throw new Error(`tag list fetch failed: ${res.status} ${text.slice(0, 300)}`);
  }
  let parsed: any;
  try { parsed = JSON.parse(text); } catch {
    throw new Error('tag list response was not JSON');
  }
  // Be permissive about response shape: array, {data:[]}, {tags:[]}, {payload:[]}.
  const list: any[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.data) ? parsed.data
    : Array.isArray(parsed?.tags) ? parsed.tags
    : Array.isArray(parsed?.payload) ? parsed.payload
    : Array.isArray(parsed?.payload?.data) ? parsed.payload.data
    : [];

  const dict: Record<string, number> = {};
  for (const t of list) {
    const name = t?.name ?? t?.tag_name ?? t?.title;
    const id = t?.id ?? t?.tag_id;
    if (typeof name === 'string' && (typeof id === 'number' || /^\d+$/.test(String(id)))) {
      dict[name] = Number(id);
    }
  }
  console.log('[tag-sync] tag dictionary resolved with', Object.keys(dict).length, 'tags');
  return dict;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: SyncBody = {};
  try { body = await req.json(); } catch { /* noop */ }

  console.log('[tag-sync] incoming payload', { phone_number: body.phone_number, new_status: body.new_status, old_status: body.old_status, flags: body.flags });

  const phone = cleanPhone(body.phone_number);
  const newStatus = String(body.new_status || '').toLowerCase().trim();
  const flags = Array.isArray(body.flags) ? body.flags.map((f) => String(f).toLowerCase()) : [];

  console.log('[tag-sync] sanitized', { phone, newStatus, flags });

  if (!phone || !newStatus) {
    console.warn('[tag-sync] rejecting: missing phone or status');
    return new Response(JSON.stringify({ error: 'missing or invalid phone_number / new_status' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Prefer the dedicated Bearer API token (eSt2dc...) when available; fall back
  // to the legacy EASYSOCIAL_API_KEY (which historically held the WhatsApp
  // template token and returns 401 on /engage endpoints).
  const apiKey = (Deno.env.get('EASYSOCIAL_BEARER_TOKEN') ?? Deno.env.get('EASYSOCIAL_API_KEY') ?? '').trim();
  if (!apiKey) {
    console.error('[tag-sync] no API key configured');
    return new Response(JSON.stringify({ ok: false, error: 'EASYSOCIAL_BEARER_TOKEN not set' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build the plan (by name) from the state machine + flags.
  const plan = planForStatus(newStatus);
  for (const f of flags) {
    const tagName = FLAG_TO_TAG[f];
    if (tagName) {
      plan.add.push(tagName);
      // flag-only addition: just remove New Lead per spec
      if (!plan.remove.includes(PHASE.NEW_LEAD)) plan.remove.push(PHASE.NEW_LEAD);
    }
  }

  if (plan.add.length === 0 && plan.remove.length === 0) {
    console.log('[tag-sync] no plan for status, skipping', { phone, newStatus });
    return new Response(JSON.stringify({ ok: true, skipped: 'no_plan', status: newStatus }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Resolve tag NAMES → IDs from EasySocial dynamically.
  let tagDict: Record<string, number>;
  try {
    tagDict = await fetchTagDictionary(apiKey);
  } catch (e) {
    console.error('[tag-sync] tag dictionary fetch failed', String((e as Error).message ?? e));
    return new Response(JSON.stringify({ ok: false, error: 'tag_dictionary_fetch_failed', detail: String((e as Error).message ?? e) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const safeIds = new Set(
    SAFE_TAG_NAMES.map((n) => tagDict[n]).filter((v): v is number => typeof v === 'number'),
  );

  const resolveIds = (names: string[]) => {
    const ids: number[] = [];
    const missing: string[] = [];
    for (const n of names) {
      const id = tagDict[n];
      if (typeof id === 'number') ids.push(id);
      else missing.push(n);
    }
    return { ids: Array.from(new Set(ids)), missing };
  };

  const addResolved = resolveIds(plan.add);
  const removeResolved = resolveIds(plan.remove);

  // Enforce SAFE LIST: never remove protected tags, even if mapped accidentally.
  const removeIds = removeResolved.ids.filter((id) => !safeIds.has(id));

  const payload = {
    remove_tags: removeIds,
    add_tags: addResolved.ids,
  };

  console.log('[tag-sync] PUT', ES_LEAD_UPDATE(phone), 'payload=', payload, 'plan=', plan, 'missing=', { add: addResolved.missing, remove: removeResolved.missing });

  let upstreamStatus = 0;
  let upstreamBody: any = null;
  try {
    const res = await fetch(ES_LEAD_UPDATE(phone), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    upstreamStatus = res.status;
    const text = await res.text();
    console.log('[tag-sync] PUT response status=', upstreamStatus, 'body=', text.slice(0, 600));
    try { upstreamBody = JSON.parse(text); } catch { upstreamBody = text; }

    if (res.ok) {
      console.log('[tag-sync] SUCCESS', { phone, newStatus, plan, payload, upstreamStatus, upstreamBody });
    } else {
      console.error('[tag-sync] UPSTREAM ERROR', { phone, newStatus, plan, payload, upstreamStatus, upstreamBody });
    }
  } catch (e) {
    console.error('[tag-sync] fetch failed', { phone, error: String((e as Error).message ?? e) });
    return new Response(JSON.stringify({ ok: false, plan, payload, error: String((e as Error).message ?? e) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    ok: upstreamStatus >= 200 && upstreamStatus < 300,
    phone,
    plan,
    payload,
    missing_tags: { add: addResolved.missing, remove: removeResolved.missing },
    safe_list_ids: Array.from(safeIds),
    upstream: { status: upstreamStatus, body: upstreamBody },
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
