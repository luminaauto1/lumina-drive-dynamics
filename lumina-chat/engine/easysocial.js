// easysocial.js — thin client for EasySocial's own API (api.easysocial.in).
// This is YOUR existing platform where the chats live — not a third-party tool.
//
// Endpoints below were confirmed by observing the EasySocial web app:
//   POST /api/v1/leads/all?page&limit&tab   body {filter,isContactList}  -> lead list (+unread flag)
//   GET  /api/v1/messages/{leadId}?page=1                                -> conversation transcript
//   GET  /api/v1/quick-reply?page&limit                                  -> saved quick replies
// The SEND endpoint is marked VERIFY — confirm it in your EasySocial account
// (Settings > API) before enabling live sends. Until then keep DRY_RUN=true.
//
// Auth: all calls use the headers the app uses. Put these in env vars:
//   ES_TOKEN        -> the Bearer token (localStorage 'token' in the web app)
//   ES_BUSINESS_ID  -> 4026
//   ES_DEVICE_ID    -> device-id header
//   ES_USER_ID      -> 8403
// NOTE: the web-app token is short-lived. For production, generate a proper API
// key from EasySocial (Settings > API / WhatsApp API) and use that instead.

const BASE = process.env.ES_API_BASE || "https://api.easysocial.in";

function headers() {
  return {
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "x-businessId": process.env.ES_BUSINESS_ID || "4026",
    "Authorization": "Bearer " + (process.env.ES_TOKEN || ""),
    "device-id": process.env.ES_DEVICE_ID || "",
    "user-id": process.env.ES_USER_ID || "",
  };
}

async function http(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  if (!res.ok) {
    const err = new Error(`EasySocial ${method} ${path} -> ${res.status}`);
    err.status = res.status; err.body = json || text;
    throw err;
  }
  return json;
}

// --- READS (safe, used by the batch worker) --------------------------------

// One page of leads. tab: 'all' | 'active' | 'resolved'. Returns {leads, meta}.
async function listLeads({ page = 1, limit = 20, tab = "all", filter = {} } = {}) {
  const j = await http("POST", `/api/v1/leads/all?page=${page}&limit=${limit}&tab=${tab}`, {
    filter, isContactList: false,
  });
  const p = (j && j.payload) || {};
  return { leads: p.data || [], meta: p.meta || {} };
}

// Full transcript for a lead (most recent page). Returns array of messages.
// Each message: { sent_by:'self'|'user', sender_id, type, message, wa_template_id, created_at }
async function getMessages(leadId, page = 1) {
  const j = await http("GET", `/api/v1/messages/${leadId}?page=${page}`);
  return ((j && j.payload && j.payload.data) || []);
}

// The 33 saved quick replies (keyword + message). Handy to re-sync the KB.
async function getQuickReplies({ page = 1, limit = 50 } = {}) {
  const j = await http("GET", `/api/v1/quick-reply?page=${page}&limit=${limit}`);
  return ((j && j.payload && j.payload.data) || []);
}

// --- WRITES (guarded) ------------------------------------------------------
// Sends are OFF unless ES_DRY_RUN === 'false'. This protects you while testing.
function liveSendsEnabled() {
  return String(process.env.ES_DRY_RUN || "true").toLowerCase() === "false";
}

// VERIFY: confirm the exact send path/shape in your EasySocial account before
// flipping ES_DRY_RUN to false. Common shape mirrors the read endpoint.
async function sendMessage(leadId, text) {
  if (!liveSendsEnabled()) {
    return { dryRun: true, leadId, text };
  }
  // >>> Confirm this endpoint/shape against EasySocial before enabling. <<<
  return http("POST", `/api/v1/messages/${leadId}`, { type: "text", message: text });
}

async function sendTemplate(leadId, templateId, variables = {}) {
  if (!liveSendsEnabled()) {
    return { dryRun: true, leadId, templateId, variables };
  }
  // >>> Confirm this endpoint/shape against EasySocial before enabling. <<<
  return http("POST", `/api/v1/messages/${leadId}/template`, { template_id: templateId, variables });
}

// Derive conversation_state fields from a lead object + its transcript.
function deriveState(lead, messages) {
  // Newest message drives the 24h window.
  const lastUser = messages.filter((m) => m.sent_by === "user").slice(-1)[0];
  const lastUserAt = lastUser ? lastUser.created_at : lead.user_message_at;
  const lastText = lastUser
    ? (typeof lastUser.message === "string"
        ? lastUser.message
        : (lastUser.message && (lastUser.message.text || lastUser.message.body)) || "")
    : "";
  return {
    lead_id: lead.id,
    phone: lead.contact_number,
    name: lead.name,
    tags: (lead.latest_tags || []).map((t) => t.title || t.name || t),
    last_user_message_at: lastUserAt,
    last_inbound_text: lastText,
    unread: lead.unread,
  };
}


// Full transcript across ALL pages (oldest -> newest), so the engine sees the
// entire conversation, not just the last ~20 messages.
async function getAllMessages(leadId, maxPages = 12) {
  let all = [];
  for (let page = 1; page <= maxPages; page++) {
    const j = await http("GET", `/api/v1/messages/${leadId}?page=${page}`);
    const chunk = (j && j.payload && j.payload.data) || [];
    if (!chunk.length) break;
    all = all.concat(chunk);
    const meta = j && j.payload && j.payload.meta;
    if (meta && meta.current_page && meta.last_page && meta.current_page >= meta.last_page) break;
    if (chunk.length < 20) break;
  }
  // de-dupe by id and sort ascending by created_at
  const seen = {};
  all = all.filter((m) => (m && m.id != null && !seen[m.id]) ? (seen[m.id] = true) : (m && m.id == null));
  all.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  return all;
}

// Deep link to the conversation inside EasySocial (so a human can open it).
function chatUrl(leadId) {
  return `https://app.easysocial.io/engage/chat?tab=all&selectedLead=${leadId}`;
}

module.exports = {
  listLeads, getMessages, getAllMessages, getQuickReplies, sendMessage, sendTemplate,
  deriveState, liveSendsEnabled, chatUrl,
};
