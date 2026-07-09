// easysocial.ts — port of lumina-chat/engine/easysocial.js for edge functions.
// Config comes from integration_settings key 'chat_responder' (not env vars) so
// the owner pastes the EasySocial token in the admin Control Panel UI.
// READS are confirmed working; SENDS are marked VERIFY in the original brief
// and remain dry-run until config.dry_run is explicitly set to false.
// deno-lint-ignore-file no-explicit-any

import type { ChatConfig } from "./kb.ts";

function headers(cfg: ChatConfig): Record<string, string> {
  return {
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "x-businessId": cfg.es_business_id || "4026",
    "Authorization": "Bearer " + (cfg.es_token || ""),
    "device-id": cfg.es_device_id || "",
    "user-id": cfg.es_user_id || "",
  };
}

async function http(cfg: ChatConfig, method: string, path: string, body?: any): Promise<any> {
  const res = await fetch((cfg.es_api_base || "https://api.easysocial.in") + path, {
    method,
    headers: headers(cfg),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch (_) { /* noop */ }
  if (!res.ok) {
    const err: any = new Error(`EasySocial ${method} ${path} -> ${res.status}`);
    err.status = res.status; err.body = json || text;
    throw err;
  }
  return json;
}

// --- READS -------------------------------------------------------------------

export async function listLeads(cfg: ChatConfig, { page = 1, limit = 20, tab = "all", filter = {} } = {}) {
  const j = await http(cfg, "POST", `/api/v1/leads/all?page=${page}&limit=${limit}&tab=${tab}`, {
    filter, isContactList: false,
  });
  const p = (j && j.payload) || {};
  return { leads: p.data || [], meta: p.meta || {} };
}

export async function getAllMessages(cfg: ChatConfig, leadId: string | number, maxPages = 12): Promise<any[]> {
  let all: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const j = await http(cfg, "GET", `/api/v1/messages/${leadId}?page=${page}`);
    const chunk = (j && j.payload && j.payload.data) || [];
    if (!chunk.length) break;
    all = all.concat(chunk);
    const meta = j && j.payload && j.payload.meta;
    if (meta && meta.current_page && meta.last_page && meta.current_page >= meta.last_page) break;
    if (chunk.length < 20) break;
  }
  const seen: Record<string, boolean> = {};
  all = all.filter((m) => (m && m.id != null && !seen[m.id]) ? (seen[m.id] = true) : (m && m.id == null));
  all.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  return all;
}

// --- WRITES (guarded — dry-run unless config says otherwise) ------------------

export function liveSendsEnabled(cfg: ChatConfig): boolean {
  return cfg.dry_run === false;
}

// VERIFY: confirm the exact send path/shape in EasySocial before enabling live.
export async function sendMessage(cfg: ChatConfig, leadId: string | number, text: string) {
  if (!liveSendsEnabled(cfg)) return { dryRun: true, leadId, text };
  return http(cfg, "POST", `/api/v1/messages/${leadId}`, { type: "text", message: text });
}

export async function sendTemplate(cfg: ChatConfig, leadId: string | number, templateId: any, variables: any = {}) {
  if (!liveSendsEnabled(cfg)) return { dryRun: true, leadId, templateId, variables };
  return http(cfg, "POST", `/api/v1/messages/${leadId}/template`, { template_id: templateId, variables });
}

// --- helpers ------------------------------------------------------------------

export function deriveState(lead: any, messages: any[]): any {
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
    tags: (lead.latest_tags || []).map((t: any) => t.title || t.name || t),
    last_user_message_at: lastUserAt,
    last_inbound_text: lastText,
    unread: lead.unread,
  };
}

export function chatUrl(leadId: string | number): string {
  return `https://app.easysocial.io/engage/chat?tab=all&selectedLead=${leadId}`;
}
