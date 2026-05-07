// EasySocial WhatsApp bot webhook receiver
// - GET: verification handshake (echoes hub.challenge if hub.verify_token matches)
// - POST: ingests lead payload from WhatsApp Business API / Meta Graph webhook
//         structure and upserts into public.leads keyed on phone_number
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ── In-memory rate limiter (per warm instance — best-effort, not global) ──
// Caps per-IP POSTs in a sliding window. Cold starts reset the bucket.
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 60;
const rateBuckets = new Map<string, number[]>();
const isRateLimited = (ip: string): boolean => {
  const now = Date.now();
  const arr = (rateBuckets.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  arr.push(now);
  rateBuckets.set(ip, arr);
  // Opportunistic cleanup
  if (rateBuckets.size > 1000) {
    for (const [k, v] of rateBuckets) {
      if (v.length === 0 || now - v[v.length - 1] > RATE_LIMIT_WINDOW_MS) rateBuckets.delete(k);
    }
  }
  return arr.length > RATE_LIMIT_MAX;
};

// ── Replay protection: extract a stable event id from the WA payload ──
const extractEventId = (payload: any, sigHeader: string | null): string | null => {
  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const msgId =
    value?.messages?.[0]?.id ??
    value?.statuses?.[0]?.id ??
    payload?.id ??
    payload?.event_id;
  if (msgId) return String(msgId);
  // Last-resort: signature itself (Meta sends the same sig on retries of same body)
  return sigHeader ? sigHeader.trim() : null;
};


// Default placeholder verify token. Override by setting EASYSOCIAL_VERIFY_TOKEN secret.
const DEFAULT_VERIFY_TOKEN = 'LuminaAuto2026';

const normalizePhone = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= 6 ? digits : null;
};

// Best-effort field extraction across common shapes (used as a fallback)
const pick = (obj: any, paths: string[]): any => {
  for (const p of paths) {
    const parts = p.split('.');
    let cur: any = obj;
    let ok = true;
    for (const k of parts) {
      if (cur && typeof cur === 'object' && k in cur) cur = cur[k];
      else { ok = false; break; }
    }
    if (ok && cur !== undefined && cur !== null && cur !== '') return cur;
  }
  return undefined;
};

// Extract #tags or "tag: value" pairs out of free-form message text
const extractTagsFromText = (text: string | undefined | null): string | null => {
  if (!text || typeof text !== 'string') return null;
  const hashTags = text.match(/#[\w-]+/g);
  if (hashTags && hashTags.length) return hashTags.map((t) => t.replace(/^#/, '')).join(', ');
  const m = text.match(/(?:tag|outcome|qualification|status)\s*[:=]\s*([\w\s,-]+)/i);
  if (m && m[1]) return m[1].trim();
  return null;
};

interface ExtractedLead {
  phone_number: string | null;
  client_phone: string | null;
  client_name: string | null;
  client_email: string | null;
  traffic_source: string | null;
  bot_outcome: string | null;
}

const extractFromWhatsAppPayload = (payload: any): ExtractedLead => {
  const result: ExtractedLead = {
    phone_number: null,
    client_phone: null,
    client_name: null,
    client_email: null,
    traffic_source: null,
    bot_outcome: null,
  };

  // ── Walk the WA Business / Meta Graph webhook structure ──────────────────
  const value = payload?.entry?.[0]?.changes?.[0]?.value;

  // Phone — prefer contact wa_id, fall back to message "from"
  const waId =
    value?.contacts?.[0]?.wa_id ??
    value?.messages?.[0]?.from ??
    value?.statuses?.[0]?.recipient_id;

  result.phone_number = normalizePhone(waId);
  result.client_phone = waId ? String(waId) : null;

  // Name from profile
  const profileName = value?.contacts?.[0]?.profile?.name;
  if (profileName) result.client_name = String(profileName);

  // Message body — text, button, interactive reply, etc.
  const msg = value?.messages?.[0];
  const messageText: string | undefined =
    msg?.text?.body ??
    msg?.button?.text ??
    msg?.interactive?.button_reply?.title ??
    msg?.interactive?.list_reply?.title ??
    msg?.interactive?.list_reply?.description;

  // Bot outcome candidates: explicit tags array, interactive reply ID, parsed text
  let outcome: string | null = null;
  const tagsField =
    value?.tags ??
    value?.contacts?.[0]?.tags ??
    msg?.context?.tags ??
    msg?.interactive?.button_reply?.id ??
    msg?.interactive?.list_reply?.id;
  if (Array.isArray(tagsField)) outcome = tagsField.join(', ');
  else if (tagsField) outcome = String(tagsField);
  if (!outcome) outcome = extractTagsFromText(messageText);
  result.bot_outcome = outcome;

  // Traffic source candidates
  const source =
    value?.traffic_source ??
    value?.source ??
    msg?.referral?.source_type ??
    msg?.referral?.source_id ??
    msg?.referral?.headline ??
    payload?.traffic_source;
  if (source) result.traffic_source = String(source);

  // ── Fallback: flat-shape payloads (older EasySocial test posts) ──────────
  if (!result.phone_number) {
    const flatPhone = pick(payload, [
      'phone', 'phone_number', 'from', 'contact.phone', 'contact.wa_id',
      'sender.phone', 'sender.wa_id', 'data.phone', 'data.from',
    ]);
    result.phone_number = normalizePhone(flatPhone);
    if (flatPhone && !result.client_phone) result.client_phone = String(flatPhone);
  }
  if (!result.bot_outcome) {
    const flatOutcome = pick(payload, [
      'bot_outcome', 'outcome', 'tag', 'tags', 'label', 'labels',
      'qualification', 'status', 'data.tags', 'contact.tags',
    ]);
    if (flatOutcome) result.bot_outcome = Array.isArray(flatOutcome) ? flatOutcome.join(', ') : String(flatOutcome);
  }
  if (!result.traffic_source) {
    const flatSource = pick(payload, [
      'traffic_source', 'source', 'platform', 'channel', 'utm_source',
      'data.source', 'contact.source',
    ]);
    if (flatSource) result.traffic_source = String(flatSource);
  }
  if (!result.client_name) {
    const flatName = pick(payload, ['name', 'full_name', 'contact.name', 'sender.name', 'data.name']);
    if (flatName) result.client_name = String(flatName);
  }
  if (!result.client_email) {
    const flatEmail = pick(payload, ['email', 'contact.email', 'sender.email', 'data.email']);
    if (flatEmail) result.client_email = String(flatEmail);
  }

  return result;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ─── GET: health check OR verification handshake ─────────────────────────
  if (req.method === 'GET') {
    // Health probe: /...?health=1 — reports config + upstream tag API status.
    if (url.searchParams.get('health') === '1') {
      const appSecret = Deno.env.get('EASYSOCIAL_APP_SECRET') ?? Deno.env.get('EASYSOCIAL_API_KEY');
      const esKey = Deno.env.get('EASYSOCIAL_API_KEY');
      const verifyToken = Deno.env.get('EASYSOCIAL_VERIFY_TOKEN');

      let tagsApi: { reachable: boolean; status: number | null; latency_ms: number | null; error?: string } = {
        reachable: false, status: null, latency_ms: null,
      };
      if (esKey) {
        const t0 = Date.now();
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 4000);
          const r = await fetch('https://api.easysocial.in/api/v1/tags', {
            headers: { Authorization: `Bearer ${esKey}`, Accept: 'application/json' },
            signal: ctrl.signal,
          });
          clearTimeout(timer);
          let upstreamError: string | undefined;
          if (!r.ok) {
            try { upstreamError = (await r.text()).slice(0, 300); } catch { /* ignore */ }
          }
          tagsApi = { reachable: r.ok, status: r.status, latency_ms: Date.now() - t0, ...(upstreamError ? { error: upstreamError } : {}) };
        } catch (e) {
          tagsApi = { reachable: false, status: null, latency_ms: Date.now() - t0, error: String((e as Error).message ?? e) };
        }
      } else {
        tagsApi.error = 'EASYSOCIAL_API_KEY not configured';
      }

      const body = {
        ok: true,
        function: 'easysocial-webhook',
        timestamp: new Date().toISOString(),
        signature_verification: {
          enabled: !!appSecret,
          algorithm: 'HMAC-SHA256',
          header: 'x-hub-signature-256',
        },
        verify_token_configured: !!verifyToken,
        tags_api: tagsApi,
      };
      return new Response(JSON.stringify(body, null, 2), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const expected = Deno.env.get('EASYSOCIAL_VERIFY_TOKEN') ?? DEFAULT_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === expected && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    return new Response('Forbidden', {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }

  // ─── POST: data ingestion ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    // ── Rate limit (per-IP, per warm instance) ──────────────────────────────
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('cf-connecting-ip') ||
      'unknown';
    if (isRateLimited(clientIp)) {
      console.warn('[easysocial-webhook] rate-limited', clientIp);
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '10' },
      });
    }

    // Read raw body once — needed for HMAC verification AND JSON parsing.
    const rawBody = await req.text();

    // ── HMAC x-hub-signature-256 verification (skipped if no key configured) ──
    const appSecret = Deno.env.get('EASYSOCIAL_APP_SECRET') ?? Deno.env.get('EASYSOCIAL_API_KEY');
    const sigHeader = req.headers.get('x-hub-signature-256');
    if (appSecret && sigHeader) {
      try {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw', enc.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
        const expected = 'sha256=' + Array.from(new Uint8Array(sigBuf))
          .map((b) => b.toString(16).padStart(2, '0')).join('');
        if (expected !== sigHeader.trim()) {
          console.warn('[easysocial-webhook] HMAC mismatch — rejecting');
          return new Response(JSON.stringify({ error: 'invalid signature' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {
        console.error('[easysocial-webhook] HMAC verification error', e);
      }
    }

    let payload: any = {};
    try { payload = JSON.parse(rawBody); } catch { payload = {}; }

    // ── Replay protection: dedupe by event id via webhook_events table ──────
    const eventId = extractEventId(payload, sigHeader);
    if (eventId) {
      try {
        const sb = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );
        const { error: dupErr } = await sb
          .from('webhook_events')
          .insert({ event_id: eventId, source: 'easysocial' });
        if (dupErr) {
          // 23505 unique_violation = already processed → ack 200, do nothing
          if ((dupErr as any).code === '23505') {
            console.log('[easysocial-webhook] duplicate event ignored', eventId);
            return new Response(JSON.stringify({ ok: true, skipped: 'duplicate', event_id: eventId }), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          console.error('[easysocial-webhook] dedupe insert error', dupErr);
        }
      } catch (e) {
        console.error('[easysocial-webhook] dedupe exception', e);
      }
    }


    let lead: ExtractedLead | null = null;
    try {
      lead = extractFromWhatsAppPayload(payload);
    } catch (e) {
      console.error('[easysocial-webhook] extraction error', e);
    }

    // Identify the change type so we can skip non-actionable events cleanly
    const changeField = payload?.entry?.[0]?.changes?.[0]?.field;
    const innerValue = payload?.entry?.[0]?.changes?.[0]?.value;

    // ── Gracefully ignore message_status receipts AND revoked/deleted messages ──
    // These carry no actionable lead data; ack 200 immediately.
    const firstMsgPeek = innerValue?.messages?.[0];
    const isRevoked = firstMsgPeek?.type === 'revoke' || firstMsgPeek?.type === 'unsupported';
    const hasStatuses = Array.isArray(innerValue?.statuses) && innerValue.statuses.length > 0;
    if (isRevoked || (hasStatuses && (!innerValue?.messages || innerValue.messages.length === 0))) {
      return new Response(
        JSON.stringify({ ok: true, skipped: isRevoked ? 'revoked_message' : 'status_receipt' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Log raw inbound WhatsApp messages (ignore message_status receipts) ──
    // Fire-and-forget so we never delay the 200 ack to EasySocial.
    if (changeField === 'messages' && Array.isArray(innerValue?.messages) && innerValue.messages.length > 0) {
      const firstMsg = innerValue?.messages?.[0];
      const msgPhone =
        normalizePhone(firstMsg?.from) ??
        normalizePhone(innerValue?.contacts?.[0]?.wa_id) ??
        lead?.phone_number ?? null;

      // ── Aggressive Platform attribution ──────────────────────────────────
      // Strict optional chaining throughout — referral / context may be absent.
      // Order: referral → context → text body. Lower-cased single blob match.
      const msgType: string = String(firstMsg?.type || 'text').toLowerCase();
      const isAudio = msgType === 'audio' || msgType === 'voice' || msgType === 'ptt';

      // Audio / voice notes carry no parseable text — flag and skip parsing.
      if (isAudio && lead) {
        const tag = 'Voice Note Received';
        lead.bot_outcome = lead.bot_outcome ? `${lead.bot_outcome}; ${tag}` : tag;
      }

      let platformSource = 'Direct/Unknown';
      const attributionBlob = isAudio
        ? ''
        : [
            firstMsg?.referral?.source_url,
            firstMsg?.referral?.source_id,
            firstMsg?.referral?.headline,
            firstMsg?.referral?.source_type,
            firstMsg?.referral?.body,
            firstMsg?.context?.referred_product,
            firstMsg?.context?.url,
            firstMsg?.context?.id,
            firstMsg?.text?.body,
            // Interactive quick-reply buttons & list selections
            firstMsg?.interactive?.button_reply?.id,
            firstMsg?.interactive?.button_reply?.title,
            firstMsg?.interactive?.list_reply?.id,
            firstMsg?.interactive?.list_reply?.title,
            firstMsg?.button?.text,
            firstMsg?.button?.payload,
          ]
            .filter((v) => v !== undefined && v !== null)
            .map((v) => String(v))
            .join(' ')
            .toLowerCase();

      if (attributionBlob.includes('tiktok')) {
        platformSource = 'TikTok';
      } else if (attributionBlob.includes('facebook') || /\bfb\b/.test(attributionBlob)) {
        platformSource = 'Facebook';
      } else if (attributionBlob.includes('instagram') || /\big\b/.test(attributionBlob)) {
        platformSource = 'Instagram';
      } else if (msgType === 'text' && firstMsg?.text?.body && !firstMsg?.referral) {
        // Real organic text reply with no ad referral → label cleanly, do not noise the trap.
        platformSource = 'Organic/Direct';
      }

      // ── The "Unknown" Trap: only dump payloads we genuinely could not classify
      // (skip clean organic text and audio cases — those are expected).
      if (platformSource === 'Direct/Unknown' && !isAudio) {
        try {
          console.log('UNKNOWN SOURCE PAYLOAD:', JSON.stringify(firstMsg, null, 2));
        } catch {
          console.log('UNKNOWN SOURCE PAYLOAD: <unstringifiable message>');
        }
      }

      try {
        const sb = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );
        const insertPromise = sb
          .from('whatsapp_messages')
          .insert({ phone_number: msgPhone, platform_source: platformSource })
          .then(({ error }) => {
            if (error) console.error('[easysocial-webhook] message log error', error);
          });
        // @ts-ignore — EdgeRuntime is provided by Supabase Edge runtime
        if (typeof EdgeRuntime !== 'undefined' && (EdgeRuntime as any).waitUntil) {
          // @ts-ignore
          (EdgeRuntime as any).waitUntil(insertPromise);
        }
      } catch (e) {
        console.error('[easysocial-webhook] message log exception', e);
      }
    }

    if (!lead || !lead.phone_number) {
      // Deep log the inner value so we can see exactly where the bot hides data
      try {
        console.log(
          `[easysocial-webhook] no phone_number extracted (field=${changeField ?? 'unknown'}). Inner value:`,
          innerValue ? JSON.stringify(innerValue, null, 2) : JSON.stringify(payload, null, 2)
        );
      } catch {
        console.log('[easysocial-webhook] no phone_number extracted; payload not stringifiable');
      }
      return new Response(JSON.stringify({ ok: true, skipped: 'no phone_number', field: changeField ?? null }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Optional: enrich with EasySocial tags (source attribution) ──────────
    // Single unified key serves both HMAC and Bearer (per admin directive).
    const esKey = Deno.env.get('EASYSOCIAL_API_KEY');
    let tagString: string | null = null;
    if (esKey) {
      try {
        // Build a robust set of identifier candidates from the payload so we
        // match regardless of whether EasySocial stores the contact by full
        // E.164, local digits, or a name. Always compared as digit-only.
        const innerVal = payload?.entry?.[0]?.changes?.[0]?.value;
        const firstMsg = innerVal?.messages?.[0];
        const rawCandidates: (string | null | undefined)[] = [
          lead.phone_number,
          lead.client_phone,
          innerVal?.contacts?.[0]?.wa_id,
          innerVal?.contacts?.[0]?.profile?.phone,
          firstMsg?.from,
          innerVal?.statuses?.[0]?.recipient_id,
          payload?.contact?.wa_id,
          payload?.contact?.phone,
          payload?.from,
          payload?.phone,
        ];
        const idSet = new Set<string>();
        for (const c of rawCandidates) {
          const n = normalizePhone(c);
          if (!n) continue;
          idSet.add(n);
          // Last-9 fallback (covers ZA local 0XXXXXXXXX vs +27XXXXXXXXX mismatch)
          if (n.length >= 9) idSet.add(n.slice(-9));
        }
        const nameKey = lead.client_name ? lead.client_name.toLowerCase().trim() : null;

        const matchesContact = (c: any): boolean => {
          if (c === null || c === undefined) return false;
          if (typeof c === 'string') {
            const n = normalizePhone(c);
            if (n && (idSet.has(n) || (n.length >= 9 && idSet.has(n.slice(-9))))) return true;
            return nameKey ? c.toLowerCase().trim() === nameKey : false;
          }
          if (typeof c !== 'object') return false;
          const phoneFields = [c.wa_id, c.phone, c.phone_number, c.mobile, c.msisdn, c.number, c.id, c.contact_id];
          for (const p of phoneFields) {
            const n = normalizePhone(p);
            if (n && (idSet.has(n) || (n.length >= 9 && idSet.has(n.slice(-9))))) return true;
          }
          if (nameKey) {
            const nameFields = [c.name, c.full_name, c.display_name, c.profile_name];
            for (const nm of nameFields) {
              if (nm && String(nm).toLowerCase().trim() === nameKey) return true;
            }
          }
          return false;
        };

        const tagsRes = await fetch('https://api.easysocial.in/api/v1/tags', {
          headers: { Authorization: `Bearer ${esKey}`, Accept: 'application/json' },
        });
        if (tagsRes.ok) {
          const tagsJson: any = await tagsRes.json();
          const tagList: any[] = Array.isArray(tagsJson)
            ? tagsJson
            : (tagsJson?.data ?? tagsJson?.tags ?? tagsJson?.results ?? []);
          const matched = tagList
            .filter((t: any) => {
              const contacts =
                t?.contacts ?? t?.wa_ids ?? t?.subscribers ??
                t?.members ?? t?.users ?? [];
              if (!Array.isArray(contacts) || contacts.length === 0) return false;
              return contacts.some(matchesContact);
            })
            .map((t: any) => String(t?.name ?? t?.label ?? t?.title ?? t?.id))
            .filter(Boolean);
          if (matched.length) tagString = Array.from(new Set(matched)).join(', ');
        } else {
          let body = '';
          try { body = (await tagsRes.text()).slice(0, 300); } catch { /* ignore */ }
          console.warn('[easysocial-webhook] tags endpoint non-OK', tagsRes.status, body);
        }
      } catch (e) {
        console.error('[easysocial-webhook] tag fetch error', e);
      }
    }

    // Only upsert when we have a real phone number
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );

      const { error } = await supabase
        .from('leads')
        .upsert(
          {
            phone_number: lead.phone_number,
            traffic_source: tagString ?? lead.traffic_source,
            bot_outcome: lead.bot_outcome,
            client_phone: lead.client_phone ?? lead.phone_number,
            client_name: lead.client_name,
            client_email: lead.client_email,
            source: tagString ?? lead.traffic_source ?? 'easysocial',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'phone_number' }
        );

      if (error) {
        console.error('[easysocial-webhook] upsert error', error, 'lead:', lead);
        return new Response(JSON.stringify({ ok: true, warning: error.message }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[easysocial-webhook] upserted lead', {
        phone_number: lead.phone_number,
        traffic_source: lead.traffic_source,
        bot_outcome: lead.bot_outcome,
        field: changeField,
      });
    } catch (e) {
      console.error('[easysocial-webhook] exception', e);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method Not Allowed', {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
  });
});
