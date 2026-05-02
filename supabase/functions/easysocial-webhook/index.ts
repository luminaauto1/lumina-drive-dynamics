// EasySocial WhatsApp bot webhook receiver
// - GET: verification handshake (echoes hub.challenge if hub.verify_token matches)
// - POST: ingests lead payload from WhatsApp Business API / Meta Graph webhook
//         structure and upserts into public.leads keyed on phone_number
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  // ─── GET: verification handshake ──────────────────────────────────────────
  if (req.method === 'GET') {
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
    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      try {
        const txt = await req.text();
        payload = JSON.parse(txt);
      } catch { payload = {}; }
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
      let platformSource = 'Direct/Unknown';
      const attributionBlob = [
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
      }

      // ── The "Unknown" Trap: dump the raw message JSON for later calibration
      if (platformSource === 'Direct/Unknown') {
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
            traffic_source: lead.traffic_source,
            bot_outcome: lead.bot_outcome,
            client_phone: lead.client_phone ?? lead.phone_number,
            client_name: lead.client_name,
            client_email: lead.client_email,
            source: lead.traffic_source ?? 'easysocial',
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
