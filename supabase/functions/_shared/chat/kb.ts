// kb.ts — knowledge-base loader for the chat-suggest edge function.
// Port of lumina-chat/engine/kb.js extended with the smart tables
// (intent_utterance / chat_lexicon / chat_phrase_variant).
//
// 2026-07-10: every EasySocial/WhatsApp config concern was REMOVED (the
// auto-responder was retired after its sends kept getting the dealership's
// WhatsApp banned). This module now only reads the Lumina knowledge base.
// deno-lint-ignore-file no-explicit-any

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

let _svc: SupabaseClient | null = null;
export function svc(): SupabaseClient {
  if (_svc) return _svc;
  _svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _svc;
}

let _kbCache: any = null;
let _kbAt = 0;
const TTL_MS = 5 * 60 * 1000;

export async function getKB({ force = false } = {}): Promise<any> {
  const fresh = _kbCache && Date.now() - _kbAt < TTL_MS;
  if (fresh && !force) return _kbCache;
  const sb = svc();
  const [qr, tpl, fn, it, esc, br, lr, sq, ut, lx, pv] = await Promise.all([
    sb.from("quick_reply").select("keyword,message").eq("active", true),
    sb.from("wa_template").select("template_id,name,category,body,buttons,usage_count").eq("active", true),
    sb.from("funnel_node").select("code,question,options"),
    sb.from("intent").select("name,priority,action,target,patterns,min_hits,note").eq("active", true).order("priority"),
    sb.from("escalation_rule").select("name,reason,patterns,hard").eq("active", true),
    sb.from("business_rule").select("key,value"),
    sb.from("learned_reply").select("match_key,sample_inbound,message,active").eq("active", true),
    sb.from("reply_sequence").select("name,steps,note").eq("active", true),
    sb.from("intent_utterance").select("intent,text,weight").eq("active", true),
    sb.from("chat_lexicon").select("canonical,variants").eq("active", true),
    sb.from("chat_phrase_variant").select("slot,variants").eq("active", true),
  ]);
  for (const r of [qr, tpl, fn, it, esc, br]) if (r.error) throw r.error;

  const brData = br.data || [];
  const hands = (brData.find((x: any) => x.key === "hands_off_tags") || {}).value || [];
  const business_rules = Object.fromEntries(brData.map((r: any) => [r.key, r.value]));
  const window_policy =
    (brData.find((x: any) => x.key === "window_policy") || {}).value ||
    { free_form_hours: 24, reengage_templates: [30748, 30743, 30745] };

  _kbCache = {
    quick_replies: qr.data,
    templates: (tpl.data || []).map((t: any) => ({ id: t.template_id, ...t })),
    funnel: fn.data,
    intents: it.data,
    escalation: esc.data,
    hands_off_tags: hands,
    business_rules,
    learned_replies: lr.data || [],
    sequences: sq.data || [],
    utterances: ut.data || [],
    lexicon: lx.data || [],
    phrase_variants: pv.data || [],
    window_policy,
  };
  _kbAt = Date.now();
  return _kbCache;
}
