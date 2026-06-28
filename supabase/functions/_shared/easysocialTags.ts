// Shared EasySocial tag helpers — extracted from easysocial-tag-sync so the new
// easysocial-list-tags function can reuse the EXACT same key resolution + tag
// dictionary fetch. Behaviour-preserving: the logic and logging here are lifted
// verbatim from easysocial-tag-sync/index.ts (tag-sync still drives its own
// active-gate Response; only the resolution + fetch are shared).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const ES_BASE = 'https://client-api.e-so.in';
export const ES_TAGS_ENDPOINT = `${ES_BASE}/engage/v1/tags`;
export const ES_LEAD_UPDATE = (phone: string) => `${ES_BASE}/api/v1/leads/${phone}/update`;

// Bundled EasySocial bearer token (fallback when no key is set in settings).
export const BUNDLED_ES_API_KEY =
  "eSt2dc1be4b95a4ccdabf289645ba0bf8ea85c016b5cde84430c3749430fbca43c627fa3b46e9db9fa9fe217aa74136ba";

export interface EasySocialResolution {
  /** false only when integration_settings.active === false. */
  active: boolean;
  /** Effective API key (settings override → bundled fallback). */
  apiKey: string;
  /** {status: tagName} remap of which tag is ADDED for a status. */
  tagAddOverrides: Record<string, string>;
  /** Raw config blob (jsonb), for merge-writes that must preserve siblings. */
  config: Record<string, unknown>;
}

/**
 * Resolve EasySocial settings (active gate + key + per-status add-tag overrides)
 * from integration_settings (key='easysocial') via the service client.
 * Fallback-safe: any failure or missing row keeps the current default behaviour.
 *
 * NOTE: this mirrors the resolution block previously inlined in
 * easysocial-tag-sync. The caller decides what to do with `active === false`
 * (tag-sync short-circuits with a "skipped: disabled" Response).
 */
export const resolveEasySocialSettings = async (): Promise<EasySocialResolution> => {
  let apiKey = BUNDLED_ES_API_KEY;
  let tagAddOverrides: Record<string, string> = {};
  let active = true;
  let config: Record<string, unknown> = {};
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (SUPABASE_URL && SERVICE) {
      const svc = createClient(SUPABASE_URL, SERVICE);
      const { data: cfg } = await svc.from("integration_settings").select("active, config").eq("key", "easysocial").maybeSingle();
      if (cfg) {
        if (cfg.active === false) active = false;
        const c: any = cfg.config ?? {};
        config = c;
        if (typeof c.api_key === "string" && c.api_key.trim()) apiKey = c.api_key.trim();
        if (c.tag_add_overrides && typeof c.tag_add_overrides === "object") tagAddOverrides = c.tag_add_overrides;
      }
    }
  } catch (e) {
    console.error("[easysocial] settings load failed, using defaults", String((e as Error).message ?? e));
  }
  return { active, apiKey, tagAddOverrides, config };
};

/** Fetch all tags from EasySocial and build a {name: id} dictionary. */
export const fetchTagDictionary = async (apiKey: string): Promise<Record<string, number>> => {
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
