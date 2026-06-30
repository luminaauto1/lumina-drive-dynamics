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
//
// Settings (Admin → Settings → EasySocial, table integration_settings key='easysocial'):
//   active=false      → sync is skipped (returns skipped:'disabled')
//   config.api_key    → overrides the bundled key
//   config.tag_add_overrides {status: tagName} → remaps which tag is ADDED for a status
// All optional & fallback-safe: no row / empty config = current behaviour.

import { fetchTagDictionary, resolveEasySocialSettings, resolveStatusApplyConfig, ES_LEAD_UPDATE } from "../_shared/easysocialTags.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lumina-key, x-supabase-api-version, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Permanent tags that must NEVER be removed (traffic sources, ops markers).
const SAFE_TAG_NAMES = [
  'TikTok Ads Lead',
  'Facebook',
  'Instagram',
  'IG',
  'FB',
  'Dev Test',
  'Operational',
] as const;

// Phase tag names used by the state machine. Names must match EasySocial exactly.
const PHASE = {
  NEW_LEAD: 'New Lead',
  APP_RECEIVED: 'Application Received',
  APP_SUBMITTED: 'App Submitted',
  VALIDATIONS_PENDING: 'Validations Pending',
  APPROVED_NEED_DOCS: 'Approved - Need Docs',
  VALS_DONE: 'Vals Done',
  DECLINED: 'Application Declined',
  BLACKLISTED: 'Blacklisted',
} as const;

// Master Wipe: every operational/pipeline tag — used by terminal states to
// give the lead a clean slate (Safe List tags are still protected downstream).
const MASTER_PIPELINE_TAGS = [
  'New Lead',
  'Application Received',
  'App Submitted',
  'Approved - Need Docs',
  'Validations Pending',
  'Vals Done',
  'Bad Credit',
  'Low Income',
  'No Licence',
];

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
  /** ZTC-parity: status-change comment, written to lead_data.last_note when present. */
  comment?: string;
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
    case 'ready_to_submit':
    case 'sent_to_banks':
    case 'revision_submitted':
      return {
        add: [PHASE.APP_SUBMITTED],
        remove: [PHASE.NEW_LEAD, PHASE.APP_RECEIVED],
      };
    case 'pre_approved':
    case 'approved':
    case 'documents_received':
      return {
        add: [PHASE.APPROVED_NEED_DOCS],
        remove: [PHASE.NEW_LEAD, PHASE.APP_RECEIVED, PHASE.APP_SUBMITTED],
      };
    case 'validations_pending':
      return {
        add: [PHASE.VALIDATIONS_PENDING],
        remove: [PHASE.APPROVED_NEED_DOCS, PHASE.APP_SUBMITTED, PHASE.APP_RECEIVED, PHASE.NEW_LEAD],
      };
    case 'validations_complete':
    case 'vehicle_selected':
    case 'contract_sent':
    case 'contract_signed':
    case 'vehicle_delivered':
    case 'finalized':
      // Vals Done — Master Wipe of every pipeline tag, then add Vals Done.
      return {
        add: [PHASE.VALS_DONE],
        remove: [...MASTER_PIPELINE_TAGS],
      };
    case 'declined':
    case 'declined_conditional':
      return {
        add: [PHASE.DECLINED],
        remove: [...MASTER_PIPELINE_TAGS],
      };
    case 'blacklisted':
      return {
        add: [PHASE.BLACKLISTED],
        remove: [...MASTER_PIPELINE_TAGS],
      };
    case 'archived':
      // Manual F&I archive — wipe all active pipeline tags, add nothing.
      // Keeps the EasySocial profile clean without throwing on an unknown status.
      return {
        add: [],
        remove: [...MASTER_PIPELINE_TAGS],
      };
    case 'client_cancelled':
      // Client cancelled/ghosted — reset to New Lead, wipe all pipeline tags.
      // NEVER add a "Client Cancelled" tag to EasySocial.
      return {
        add: [PHASE.NEW_LEAD],
        remove: [...MASTER_PIPELINE_TAGS],
      };
    default:
      return { add: [], remove: [] };
  }
};

// fetchTagDictionary now lives in ../_shared/easysocialTags.ts (imported above)
// so easysocial-list-tags can reuse it verbatim. Behaviour is unchanged.

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
  const oldStatus = String(body.old_status || '').toLowerCase().trim();
  const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
  const flags = Array.isArray(body.flags) ? body.flags.map((f) => String(f).toLowerCase()) : [];

  console.log('[tag-sync] sanitized', { phone, newStatus, flags });

  if (!phone || !newStatus) {
    console.warn('[tag-sync] rejecting: missing phone or status');
    return new Response(JSON.stringify({ error: 'missing or invalid phone_number / new_status' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Load EasySocial settings (active gate + key + per-status add-tag overrides +
  // client_status kill-switch). Fallback-safe: any failure or missing row keeps
  // the current default behaviour. Shared with easysocial-list-tags.
  const { active, apiKey, tagAddOverrides, clientStatusEnabled } = await resolveEasySocialSettings();
  if (!active) {
    console.log("[tag-sync] EasySocial sync disabled in settings — skipping", { phone, newStatus });
    return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── ZTC-parity per-status apply config (ADDITIVE, fallback-safe) ────────────
  // Read the new status_overrides columns server-side for the NEW status (and,
  // for the previous-tag strip, the OLD status's tag-to-add). When a status has
  // NO config the resolver returns "do-nothing" defaults => the wire payload is
  // byte-for-byte identical to today. is_internal => skip ALL config augmentation
  // (the hardcoded tag plan below still runs, preserving current behaviour for any
  // already-internal slug).
  const applyCfg = await resolveStatusApplyConfig(newStatus);
  const configActive = !applyCfg.isInternal;
  if (applyCfg.isInternal) {
    console.log('[tag-sync] status is internal — skipping config-driven CRM augmentation', { newStatus });
  }
  // Previous status's configured add-tag NAME, for the ZTC previous-tag strip:
  // when the status changed and the prior status added a (different) tag, that tag
  // is pushed onto the removes so the lead never carries a stale phase tag. Read
  // from the same per-status add-tag override map the new status uses; resolved by
  // NAME so it flows through the intersection + safe-list filters below.
  let prevTagName = '';
  if (configActive && oldStatus && oldStatus !== newStatus) {
    const prevOverride = tagAddOverrides[oldStatus];
    if (typeof prevOverride === 'string' && prevOverride.trim()) prevTagName = prevOverride.trim();
  }

  // Build the plan (by name) from the state machine + flags.
  const plan = planForStatus(newStatus);
  // Admin remap: replace the ADD tag for this status if configured.
  if (typeof tagAddOverrides[newStatus] === "string" && tagAddOverrides[newStatus].trim()) {
    plan.add = [tagAddOverrides[newStatus].trim()];
  }
  for (const f of flags) {
    const tagName = FLAG_TO_TAG[f];
    if (tagName) {
      plan.add.push(tagName);
      // flag-only addition: just remove New Lead per spec
      if (!plan.remove.includes(PHASE.NEW_LEAD)) plan.remove.push(PHASE.NEW_LEAD);
    }
  }

  // Previous-tag strip (ZTC extra rule): remove the prior status's add-tag unless
  // it's the tag we're now adding. By NAME so it flows through resolveIds + the
  // intersection/safe-list filters below (a protected tag can still never go).
  if (prevTagName && !plan.add.includes(prevTagName) && !plan.remove.includes(prevTagName)) {
    plan.remove.push(prevTagName);
  }

  // Does config contribute anything that should keep us going past the no-plan
  // early-return? (config-driven removes via mode, a client_status write, or a
  // note/comment). Tag-id removes are merged AFTER id resolution (below), so we
  // only need to know whether the modes/fields are populated here.
  const wantsClientStatusWrite =
    configActive && clientStatusEnabled && !!applyCfg.easysocialClientStatus;
  const wantsNote = configActive && !!comment;
  const hasConfigRemove =
    configActive && (applyCfg.tagRemoveMode === 'specific' || applyCfg.tagRemoveMode === 'all_except');
  const configContributes = wantsClientStatusWrite || wantsNote || hasConfigRemove || !!prevTagName;

  if (plan.add.length === 0 && plan.remove.length === 0 && !configContributes) {
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

  // ── Config-driven REMOVE ids (ZTC parity: specific | all_except) ────────────
  // These are MERGED with the hardcoded plan's removes and then run through the
  // SAME intersection + safe-list filters below — config can only ever ADD to the
  // removable set; it can never bypass the protections (a tag being added, or a
  // SAFE_TAG_NAMES traffic-source/ops tag, is still never removed).
  const allTagIds = new Set<number>(Object.values(tagDict));
  let configRemoveIds: number[] = [];
  if (configActive) {
    if (applyCfg.tagRemoveMode === 'specific') {
      // Remove exactly the listed ids that actually exist in the dictionary.
      configRemoveIds = applyCfg.tagsToRemove.filter((id) => allTagIds.has(id));
    } else if (applyCfg.tagRemoveMode === 'all_except') {
      // Keep-set = listed ids ∪ {tag-to-add ids}; remove EVERYTHING else.
      const keep = new Set<number>([...applyCfg.tagsToRemove, ...addResolved.ids]);
      configRemoveIds = Array.from(allTagIds).filter((id) => !keep.has(id));
    }
  }

  const addIdSet = new Set(addResolved.ids);
  // Combine hardcoded-plan removes with config-driven removes BEFORE filtering.
  const mergedRemoveIds = Array.from(new Set([...removeResolved.ids, ...configRemoveIds]));
  // STEP 1 — Intersection filter: never remove a tag we are actively adding.
  const intersectionFiltered = mergedRemoveIds.filter((id) => !addIdSet.has(id));
  // STEP 2 — Safe-list filter: never remove protected traffic-source/ops tags.
  const removeIds = intersectionFiltered.filter((id) => !safeIds.has(id));

  // Single combined PUT exactly as EasySocial documents/blesses: add_tags + remove_tags
  // (underscored field names) in one /leads/{phone}/update call. Only include a field
  // when it has ids, so we never send an empty array that could be misread.
  // ZTC parity: lead_data carries client_status (kill-switch-gated) + last_note,
  // and is OMITTED entirely when there's nothing config-driven to write — so an
  // unconfigured status produces a byte-for-byte identical payload to today.
  const payload: { add_tags?: number[]; remove_tags?: number[]; lead_data?: Record<string, unknown> } = {};
  if (addResolved.ids.length > 0) payload.add_tags = addResolved.ids;
  if (removeIds.length > 0) payload.remove_tags = removeIds;

  const leadData: Record<string, unknown> = {};
  if (wantsClientStatusWrite) leadData.client_status = applyCfg.easysocialClientStatus;
  if (wantsNote) { leadData.last_note = comment; leadData.last_note_at = new Date().toISOString(); }
  if (Object.keys(leadData).length > 0) payload.lead_data = leadData;
  // If client_status is configured but the kill-switch is OFF, log loudly (dark).
  if (configActive && applyCfg.easysocialClientStatus && !clientStatusEnabled) {
    console.warn('[tag-sync] client_status configured but kill-switch OFF — write held dark', { newStatus });
  }

  // Nothing to send at all (no tags, no lead_data) => skip the PUT entirely.
  if (!payload.add_tags && !payload.remove_tags && !payload.lead_data) {
    console.log('[tag-sync] no-op after filters/config, skipping PUT', { phone, newStatus });
    return new Response(JSON.stringify({ ok: true, skipped: 'no_op', status: newStatus }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let upstreamStatus = 0;
  let upstreamBody: any = null;
  try {
    console.log('[tag-sync] PUT', ES_LEAD_UPDATE(phone), 'body=', payload);
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
    try { upstreamBody = JSON.parse(text); } catch { upstreamBody = text; }
    if (res.ok) console.log('[tag-sync] OK status=', upstreamStatus, 'body=', text.slice(0, 400));
    else console.error('[tag-sync] UPSTREAM ERROR status=', upstreamStatus, 'body=', text.slice(0, 400));
  } catch (e) {
    console.error('[tag-sync] fetch failed', { phone, error: String((e as Error).message ?? e) });
    return new Response(JSON.stringify({ ok: false, plan, payload, error: String((e as Error).message ?? e) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ok = upstreamStatus >= 200 && upstreamStatus < 300;
  console.log('[tag-sync] DONE', { phone, newStatus, plan, payload, upstreamStatus });

  return new Response(JSON.stringify({
    ok,
    phone,
    plan,
    payload,
    missing_tags: { add: addResolved.missing, remove: removeResolved.missing },
    safe_list_ids: Array.from(safeIds),
    upstream: { status: upstreamStatus, body: upstreamBody },
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
