// waTemplates.ts — settings-driven EasySocial template resolution.
//
// THE SINGLE SOURCE OF TRUTH for every WhatsApp template send is the
// `whatsapp_templates` table (Admin → Settings → WhatsApp Templates). The owner
// pastes the EasySocial "send URL" there — the URL carries the campaign token +
// template id, and its QUERY STRING DECLARES which body params the template
// expects and what fills them (e.g. `?body1=name&body2=mobilenumber`).
//
// Born 2026-07-14: the dealership's WhatsApp was banned and every template was
// recreated with new IDs — and every sender that HARDCODED its template URL
// silently died. No sender may hardcode a template URL again: resolve through
// getWaTemplate()/buildWaSendUrl() so the owner can swap links in Settings.
//
// Token vocabulary (the value side of body params in the pasted URL):
//   name / Name       → values.name        (each sender decides first vs full name)
//   mobilenumber      → values.mobilenumber (client's phone, human-readable)
//   anything else     → values[<token lowercased>] if the sender provides it, else omitted
// deno-lint-ignore-file no-explicit-any

export interface WaTemplateRow {
  key: string;
  title: string | null;
  send_url: string | null;
  active: boolean;
}

/** Fetch one template row via PostgREST (service key from env). null = row missing or lookup failed. */
export async function getWaTemplate(key: string): Promise<WaTemplateRow | null> {
  try {
    const SU = Deno.env.get("SUPABASE_URL");
    const SK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SU || !SK) return null;
    const res = await fetch(
      `${SU}/rest/v1/whatsapp_templates?key=eq.${encodeURIComponent(key)}&select=key,title,send_url,active`,
      { headers: { apikey: SK, Authorization: `Bearer ${SK}` } },
    );
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) && rows[0] ? (rows[0] as WaTemplateRow) : null;
  } catch (_e) {
    return null;
  }
}

/** 0xx… → 27xx…, digits only. Same bounds the notify-* senders always used. */
export function sanitizeWaPhone(raw: unknown): string | null {
  let p = String(raw ?? "").replace(/[\s\-+()]/g, "").replace(/\D/g, "");
  if (!p) return null;
  if (p.startsWith("0")) p = "27" + p.substring(1);
  if (p.length < 8 || p.length > 15) return null;
  return p;
}

/**
 * Build the final dispatch URL from the owner-pasted send_url.
 * - Normalises the base exactly like wa-status-send: strip the query, strip a
 *   trailing `/API/<placeholder>` segment (`:mobile_number`, `{phone}`, a real
 *   number…), strip trailing slashes, then rebuild `${base}/API/${phone}`.
 * - Body params come from the PASTED URL's own query: each `bodyN=<token>` is
 *   filled from `values[token.toLowerCase()]`; empty resolutions are omitted.
 *   A pasted URL with no query (e.g. the Blacklisted template) sends no bodies.
 * Returns null when the send_url is unusable.
 */
export function buildWaSendUrl(
  sendUrlRaw: string | null | undefined,
  phone: string,
  values: Record<string, string | null | undefined>,
): string | null {
  const raw = String(sendUrlRaw ?? "").trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return null;

  const qIdx = raw.indexOf("?");
  let base = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
  const declaredQuery = qIdx >= 0 ? raw.slice(qIdx + 1) : "";

  base = base.replace(/\/API\/[^/]*\/?$/i, "");
  base = base.replace(/\/+$/, "");

  const params: string[] = [];
  if (declaredQuery) {
    for (const pair of declaredQuery.split("&")) {
      if (!pair) continue;
      const [k, tokenRaw = ""] = pair.split("=");
      if (!/^body\d+$/i.test(k || "")) continue;
      const token = decodeURIComponent(tokenRaw).trim().toLowerCase();
      const resolved = String(values[token] ?? "").trim();
      if (resolved) params.push(`${k.toLowerCase()}=${encodeURIComponent(resolved)}`);
    }
  }
  const query = params.length ? `?${params.join("&")}` : "";
  return `${base}/API/${encodeURIComponent(phone)}${query}`;
}

/** GET the send URL (the URL is the credential). One retry on network error / 5xx. */
export async function dispatchWa(
  url: string,
  timeoutMs = 8000,
): Promise<{ status: number; ok: boolean; body: any }> {
  const attempt = async (): Promise<{ status: number; ok: boolean; body: any }> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, signal: ctrl.signal });
      const text = await res.text();
      let body: any;
      try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 500) }; }
      return { status: res.status, ok: res.ok && body?.success !== false, body };
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    const first = await attempt();
    if (first.ok || (first.status >= 400 && first.status < 500)) return first;
    await new Promise((r) => setTimeout(r, 600));
    return await attempt();
  } catch (_e) {
    await new Promise((r) => setTimeout(r, 600));
    try {
      return await attempt();
    } catch (e2) {
      return { status: 0, ok: false, body: { error: String((e2 as Error).message ?? e2) } };
    }
  }
}

/**
 * One-call convenience used by the simple client-notify senders:
 * resolve template `key` → skip if inactive/unset → build URL → dispatch.
 */
export async function sendTemplateByKey(
  key: string,
  rawPhone: unknown,
  values: Record<string, string | null | undefined>,
): Promise<
  | { sent: false; skipped: string }
  | { sent: boolean; skipped?: undefined; status: number; body: any; dispatched_url: string }
> {
  const tpl = await getWaTemplate(key);
  if (!tpl) return { sent: false, skipped: "template_row_missing" };
  if (tpl.active === false) return { sent: false, skipped: "disabled" };
  const phone = sanitizeWaPhone(rawPhone);
  if (!phone) return { sent: false, skipped: "bad_phone" };
  const url = buildWaSendUrl(tpl.send_url, phone, values);
  if (!url) return { sent: false, skipped: "no_send_url" };
  const r = await dispatchWa(url);
  return { sent: r.ok, status: r.status, body: r.body, dispatched_url: url };
}
