// kb.js — load the knowledge base for the engine.
// Two sources, same shape:
//   1) Supabase (production): reads the KB tables you seeded with seed.sql.
//   2) Local JSON (dev/offline/fallback): data/knowledge_base.json.
//
// The engine only needs: quick_replies, templates, funnel, intents,
// escalation, window_policy.

const fs = require("fs");
const path = require("path");

let _cache = null;
let _cacheAt = 0;
const TTL_MS = 5 * 60 * 1000; // re-read KB at most every 5 min

function loadLocal() {
  const p = path.join(__dirname, "..", "data", "knowledge_base.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// Build the KB object from Supabase rows using @supabase/supabase-js.
async function loadFromSupabase() {
  const { createClient } = require("@supabase/supabase-js");
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const [qr, tpl, fn, it, esc, br, lr, sq] = await Promise.all([
    sb.from("quick_reply").select("keyword,message").eq("active", true),
    sb.from("wa_template").select("template_id,name,category,body,buttons,usage_count").eq("active", true),
    sb.from("funnel_node").select("code,question,options"),
    sb.from("intent").select("name,priority,action,target,patterns,min_hits,note").eq("active", true).order("priority"),
    sb.from("escalation_rule").select("name,reason,patterns,hard").eq("active", true),
    sb.from("business_rule").select("key,value"),
    sb.from("learned_reply").select("match_key,message,active").eq("active", true),
    sb.from("reply_sequence").select("name,steps,note").eq("active", true),
  ]);
  for (const r of [qr, tpl, fn, it, esc, br]) if (r.error) throw r.error;
  const hands = (br.data.find((x) => x.key === 'hands_off_tags') || {}).value || [];
  const business_rules = Object.fromEntries((br.data || []).map((r) => [r.key, r.value]));

  const window_policy =
    (br.data.find((x) => x.key === "window_policy") || {}).value || {
      free_form_hours: 24, reengage_templates: [30748, 30743, 30745],
    };

  return {
    quick_replies: qr.data,
    templates: (tpl.data || []).map((t) => ({ id: t.template_id, ...t })),
    funnel: fn.data,
    intents: it.data,
    escalation: esc.data,
    hands_off_tags: hands,
    business_rules,
    learned_replies: (lr && lr.data) || [],
    sequences: (sq && sq.data) || [],
    window_policy,
  };
}

async function getKB({ force = false } = {}) {
  const fresh = _cache && Date.now() - _cacheAt < TTL_MS;
  if (fresh && !force) return _cache;
  try {
    _cache = process.env.SUPABASE_URL ? await loadFromSupabase() : loadLocal();
  } catch (e) {
    // Never let a DB hiccup stop replies — fall back to the bundled JSON.
    console.error("KB load failed, using local JSON:", e.message);
    _cache = loadLocal();
  }
  _cacheAt = Date.now();
  return _cache;
}

module.exports = { getKB, loadLocal };
