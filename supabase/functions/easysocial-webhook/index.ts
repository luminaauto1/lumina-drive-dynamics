// EasySocial WhatsApp bot webhook receiver
// - GET: verification handshake (echoes hub.challenge if hub.verify_token matches)
// - POST: ingests lead payload and upserts into public.leads keyed on phone_number
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Default placeholder verify token. Override by setting EASYSOCIAL_VERIFY_TOKEN secret.
const DEFAULT_VERIFY_TOKEN = 'LuminaAuto2026';

const normalizePhone = (raw: unknown): string | null => {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= 6 ? digits : null;
};

// Best-effort field extraction across common EasySocial / WhatsApp shapes
const pick = (obj: any, paths: string[]): any => {
  for (const p of paths) {
    const parts = p.split('.');
    let cur = obj;
    let ok = true;
    for (const k of parts) {
      if (cur && typeof cur === 'object' && k in cur) cur = cur[k];
      else { ok = false; break; }
    }
    if (ok && cur !== undefined && cur !== null && cur !== '') return cur;
  }
  return undefined;
};

const extractLead = (payload: any) => {
  // Phone candidates
  const phoneRaw = pick(payload, [
    'phone', 'phone_number', 'from', 'contact.phone', 'contact.wa_id',
    'sender.phone', 'sender.wa_id', 'data.phone', 'data.from',
  ]);

  // Source / platform candidates
  const source = pick(payload, [
    'traffic_source', 'source', 'platform', 'channel',
    'data.source', 'contact.source', 'utm_source',
  ]);

  // Bot outcome / tag / label candidates (could be string or array)
  let outcome = pick(payload, [
    'bot_outcome', 'outcome', 'tag', 'tags', 'label', 'labels',
    'qualification', 'status', 'data.tags', 'contact.tags',
  ]);
  if (Array.isArray(outcome)) outcome = outcome.join(', ');

  const name = pick(payload, [
    'name', 'full_name', 'contact.name', 'sender.name', 'data.name',
  ]);

  const email = pick(payload, [
    'email', 'contact.email', 'sender.email', 'data.email',
  ]);

  return {
    phone_number: normalizePhone(phoneRaw),
    traffic_source: source ? String(source) : null,
    bot_outcome: outcome ? String(outcome) : null,
    client_name: name ? String(name) : null,
    client_email: email ? String(email) : null,
    client_phone: phoneRaw ? String(phoneRaw) : null,
  };
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
      // Echo challenge as raw text/plain — Meta-style handshake
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
      // Some senders may post form-encoded; fall back gracefully
      try {
        const txt = await req.text();
        payload = JSON.parse(txt);
      } catch { payload = {}; }
    }

    const lead = extractLead(payload);

    // Acknowledge fast — process best-effort but always 200 unless misconfigured
    if (!lead.phone_number) {
      console.log('[easysocial-webhook] received payload without phone_number', payload);
      return new Response(JSON.stringify({ ok: true, skipped: 'no phone_number' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );

      // Upsert keyed on phone_number (unique partial index)
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
        console.error('[easysocial-webhook] upsert error', error);
        // Still ack 200 to prevent EasySocial retries flooding the queue
        return new Response(JSON.stringify({ ok: true, warning: error.message }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
