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
  /**
   * client_status KILL-SWITCH (ZTC-parity safe-partial). When this is NOT
   * exactly true the EasySocial lead_data.client_status write is held dark —
   * tags still flow (proven payload), but the client_status field is never sent.
   * Default OFF: ships dark until a canary verifies Lumina's ES account accepts
   * lead_data. Flip integration_settings.config.easysocial_client_status_enabled
   * to true to enable. Tag add/remove are unaffected by this gate.
   */
  clientStatusEnabled: boolean;
}

/**
 * ZTC-parity per-status apply config, read DIRECTLY from the new status_overrides
 * columns (NOT the tag_add_overrides JSON mirror — those new columns have no
 * mirror). Returned with safe defaults when the row/columns are absent so an
 * unconfigured status augments the wire payload with NOTHING.
 */
export interface StatusApplyConfig {
  /** lead_data.client_status text to write (NULL/'' => not written). */
  easysocialClientStatus: string | null;
  /** 'none' (default) | 'specific' | 'all_except'. */
  tagRemoveMode: 'none' | 'specific' | 'all_except';
  /** Tag IDs (coerced from text[]), interpreted per tagRemoveMode. */
  tagsToRemove: number[];
  /**
   * Multi tag-to-ADD: list of tag NAMES to ADD on apply. When non-empty this
   * SUPERSEDES the single tag_add_overrides[slug] override; `[]` (default) =>
   * fall back to today's single-tag behaviour. Names are resolved to ids and run
   * through the same intersection + SAFE_TAG_NAMES filters in the edge fn.
   */
  tagsToAdd: string[];
  /** Whether this status is flagged internal (skips config CRM + WhatsApp). */
  isInternal: boolean;
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
  let clientStatusEnabled = false; // KILL-SWITCH default OFF — write ships dark.
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
        // Kill-switch: only the literal boolean true enables the client_status write.
        if (c.easysocial_client_status_enabled === true) clientStatusEnabled = true;
      }
    }
  } catch (e) {
    console.error("[easysocial] settings load failed, using defaults", String((e as Error).message ?? e));
  }
  return { active, apiKey, tagAddOverrides, config, clientStatusEnabled };
};

/**
 * Resolve the ZTC-parity per-status apply config for a single status slug from
 * status_overrides (new columns). Server-side read via the service client so the
 * tag-remove list and client_status text are never trusted from the browser.
 * Fallback-safe: any failure / missing row => "do nothing extra" defaults.
 */
export const resolveStatusApplyConfig = async (slug: string): Promise<StatusApplyConfig> => {
  const fallback: StatusApplyConfig = {
    easysocialClientStatus: null,
    tagRemoveMode: 'none',
    tagsToRemove: [],
    tagsToAdd: [],
    isInternal: false,
  };
  if (!slug) return fallback;
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE) return fallback;
    const svc = createClient(SUPABASE_URL, SERVICE);
    const { data: row } = await svc
      .from("status_overrides")
      .select("easysocial_client_status, tag_remove_mode, easysocial_tags_to_remove, easysocial_tags_to_add, is_internal")
      .eq("slug", slug)
      .maybeSingle();
    if (!row) return fallback;
    const r: any = row;
    const mode = r.tag_remove_mode === 'specific' || r.tag_remove_mode === 'all_except' ? r.tag_remove_mode : 'none';
    const rawIds: unknown[] = Array.isArray(r.easysocial_tags_to_remove) ? r.easysocial_tags_to_remove : [];
    const tagsToRemove = rawIds
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));
    // Multi tag-to-ADD NAMES: keep non-empty trimmed strings, de-duped, order-preserving.
    const rawAddNames: unknown[] = Array.isArray(r.easysocial_tags_to_add) ? r.easysocial_tags_to_add : [];
    const tagsToAdd = Array.from(
      new Set(
        rawAddNames
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
          .filter((s): s is string => s.length > 0),
      ),
    );
    return {
      easysocialClientStatus:
        typeof r.easysocial_client_status === 'string' && r.easysocial_client_status.trim()
          ? r.easysocial_client_status.trim()
          : null,
      tagRemoveMode: mode,
      tagsToRemove: Array.from(new Set(tagsToRemove)),
      tagsToAdd,
      isInternal: r.is_internal === true,
    };
  } catch (e) {
    console.error("[easysocial] status-apply config load failed, using defaults", String((e as Error).message ?? e));
    return fallback;
  }
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
