import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

const STAFF_NUMBERS = ["27836117792", "27716196071"];
const CAMPAIGN_ID = "cmq4yoea31jksk9xpfxf4fy82";
const TEMPLATE_ID = "20014";
const ACCOUNT_ID = "4026";
const ES_BEARER_BASE = "https://client-api.e-so.in/api/v1/leads";

const OPERATIONAL_TAG_NAMES = [
  "New Lead",
  "Application Received",
  "App Submitted",
  "Approved - Need Docs",
  "Validations Pending",
  "Vals Done",
  "Bad Credit",
  "Low Income",
  "No Licence",
  "Application Declined",
  "Blacklisted",
];

type JsonRecord = Record<string, unknown>;

const sanitizePhone = (raw: unknown): string | null => {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `27${digits.slice(1)}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
};

const fetchTagDictionary = async (apiKey: string): Promise<Record<string, number>> => {
  const res = await fetch("https://client-api.e-so.in/engage/v1/tags", {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!res.ok) return {};
  const parsed = await res.json() as JsonRecord | JsonRecord[];
  const payload = !Array.isArray(parsed) && typeof parsed.payload === "object" && parsed.payload !== null
    ? parsed.payload as JsonRecord
    : null;
  const list: JsonRecord[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.data) ? parsed.data as JsonRecord[]
    : Array.isArray(parsed.tags) ? parsed.tags as JsonRecord[]
    : Array.isArray(parsed.payload) ? parsed.payload as JsonRecord[]
    : Array.isArray(payload?.data) ? payload.data as JsonRecord[]
    : [];
  return list.reduce((acc: Record<string, number>, tag) => {
    const name = tag?.name ?? tag?.tag_name ?? tag?.title;
    const id = tag?.id ?? tag?.tag_id;
    if (typeof name === "string" && (typeof id === "number" || /^\d+$/.test(String(id)))) acc[name] = Number(id);
    return acc;
  }, {});
};

const removeOperationalTagsFromStaff = async () => {
  try {
    const apiKey = Deno.env.get("EASYSOCIAL_BEARER_TOKEN")?.trim() || Deno.env.get("EASYSOCIAL_API_KEY")?.trim();
    if (!apiKey) return { skipped: "missing_easysocial_token" };

    const tagDict = await fetchTagDictionary(apiKey);
    const removeTags = OPERATIONAL_TAG_NAMES.map((name) => tagDict[name]).filter((id): id is number => typeof id === "number");
    if (!removeTags.length) return { skipped: "no_operational_tags_resolved" };

    const results = await Promise.all(STAFF_NUMBERS.map(async (phone) => {
      const clean = sanitizePhone(phone);
      if (!clean) return { phone, ok: false, error: "invalid_phone" };
      const resp = await fetch(`${ES_BEARER_BASE}/${clean}/update`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ remove_tags: removeTags, add_tags: [] }),
      });
      const text = await resp.text();
      let body: unknown;
      try { body = JSON.parse(text); } catch { body = { raw: text }; }
      return { phone: clean, ok: resp.ok, status: resp.status, body };
    }));

    return { remove_tags: removeTags, results };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("staff tag cleanup failed:", message);
    return { ok: false, error: message };
  }
};

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const { client_name, first_name, last_name, client_phone, bank_reference_code } = await req.json();

    let derivedFirst = (first_name || "").toString().trim();
    let derivedLast = (last_name || "").toString().trim();
    if (!derivedFirst && !derivedLast && client_name) {
      const parts = String(client_name).trim().split(/\s+/);
      derivedFirst = parts.shift() || "";
      derivedLast = parts.join(" ");
    }
    if (!derivedFirst) derivedFirst = "Unknown";
    if (!derivedLast) derivedLast = "-";

    const phoneForBody = (client_phone || "N/A").toString();
    const refCode = bank_reference_code ? String(bank_reference_code).trim() : "No Ref Code";

    const b1 = encodeURIComponent(derivedFirst);
    const b2 = encodeURIComponent(derivedLast);
    const b3 = encodeURIComponent(phoneForBody);
    const b4 = encodeURIComponent(refCode);

    // Parallel execution to prevent sequential blocking
    const dispatchPromises = STAFF_NUMBERS.map(async (phone) => {
      const apiUrl = `https://api.easysocial.in/api/v1/wa-templates/send/${CAMPAIGN_ID}/${TEMPLATE_ID}/${ACCOUNT_ID}/API/${phone}?body1=${b1}&body2=${encodeURIComponent(phoneForBody)}`;
      try {
        const resp = await fetch(apiUrl, { headers: { Accept: "application/json" } });
        const raw = await resp.text();
        let body: unknown;
        try { body = JSON.parse(raw); } catch { body = { raw }; }
        const success = typeof body === "object" && body !== null && "success" in body ? (body as JsonRecord).success : undefined;
        return { phone, status: resp.status, body, ok: resp.ok && success !== false };
      } catch (err: unknown) {
        return { phone, status: 500, error: err instanceof Error ? err.message : String(err), ok: false };
      }
    });

    const results = await Promise.all(dispatchPromises);
    const allOk = results.every((r) => r.ok);
    const staffTagCleanup = await removeOperationalTagsFromStaff();

    return new Response(
      JSON.stringify({ success: allOk, results, staffTagCleanup, payload: { body1: derivedFirst, body2: derivedLast, body3: phoneForBody, body4: refCode } }),
      { status: allOk ? 200 : 207, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
