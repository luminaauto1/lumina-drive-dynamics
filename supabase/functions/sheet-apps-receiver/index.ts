// Receives finance applications pushed by the Google Apps Script bound to the
// "Application Sheet Lumina" spreadsheet (WhatsApp-originated apps).
//
// Contract (per row, matched by index in the response):
//   created  -> no matching app existed; inserted as status=pending,
//               submission_source=whatsapp (lands in Pipeline "New Applications")
//   updated  -> an app already existed (matched by SA ID number, else phone);
//               blank columns were filled from the sheet. Status is NEVER touched.
//   exists   -> matched an existing app and nothing needed filling.
//   skipped  -> row unusable (no name / no phone).
//   error    -> row failed; the script leaves it in the sheet for retry.
// The Apps Script moves rows with created/updated/exists to the
// "Apps in website" tab; skipped/error rows stay in "New Applications".
//
// Auth: x-sync-secret header must equal the SHEET_SYNC_SECRET function secret.
// Deployed with verify_jwt = false (Apps Script cannot send Supabase JWTs).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const MAX_ROWS_PER_REQUEST = 50;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const text = (raw: unknown, max = 255): string | null => {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (!value) return null;
  return value.slice(0, max);
};

// Strip non-digits; convert local 0xxxxxxxxx -> 27xxxxxxxxx (ZA)
const normPhone = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  let cleaned = String(raw).replace(/\D/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("0")) cleaned = "27" + cleaned.slice(1);
  if (cleaned.length < 10 || cleaned.length > 15) return null;
  return cleaned;
};

// SA ID is always 13 digits; Google Sheets strips leading zeros from numeric
// cells (IDs of people born 2000+ start with 0). Pad back to 13.
const normIdNumber = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length >= 10 && digits.length < 13) return digits.padStart(13, "0");
  if (digits.length === 13) return digits;
  return null; // passports / garbage: don't use for matching, don't store as SA ID
};

// Sheet money cells arrive as display strings: "18056,25" (comma decimal),
// "1,206,833,481" (thousands separators), "R7000", plain numbers.
const normMoney = (raw: unknown): number | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return isFinite(raw) ? raw : null;
  let s = String(raw).replace(/[Rr\s]/g, "");
  if (!s) return null;
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  if (!isFinite(n) || n < 0 || n > 10_000_000) return null;
  return n;
};

// Postal codes also lose leading zeros ("0082" -> "82").
const normAreaCode = (raw: unknown): string | null => {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits || digits.length > 4) return text(raw, 20);
  return digits.padStart(4, "0");
};

const normAccountNumber = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/[^\d]/g, "");
  if (!digits || digits === "0") return null;
  return digits.slice(0, 30);
};

interface SheetRow {
  fullName?: unknown; surname?: unknown; phone?: unknown; email?: unknown;
  idNumber?: unknown; qualification?: unknown; street?: unknown; province?: unknown;
  city?: unknown; areaCode?: unknown; timeAtAddress?: unknown; kinName?: unknown;
  kinNumber?: unknown; company?: unknown; jobTitle?: unknown; duration?: unknown;
  workAddress?: unknown; gross?: unknown; net?: unknown; expenses?: unknown;
  bank?: unknown; accountNumber?: unknown; accountType?: unknown;
}

// Columns eligible for fill-the-blanks on an existing application.
const FILLABLE = [
  "first_name", "last_name", "id_number", "email", "qualification",
  "street_address", "area_code", "kin_name", "kin_contact", "employer_name",
  "job_title", "employment_period", "employer_address", "gross_salary",
  "net_salary", "expenses_summary", "bank_name", "account_type", "account_number",
] as const;

function mapRow(row: SheetRow) {
  const firstName = text(row.fullName, 120);
  const lastName = text(row.surname, 120);
  const phone = normPhone(row.phone);
  const idNumber = normIdNumber(row.idNumber);
  const street = text(row.street, 255);
  const city = text(row.city, 120);
  const province = text(row.province, 120);
  const fullAddress = [street, city, province].filter(Boolean).join(", ") || null;
  const timeAtAddress = text(row.timeAtAddress, 120);

  return {
    firstName,
    lastName,
    phone,
    idNumber,
    fields: {
      first_name: firstName,
      last_name: lastName,
      id_number: idNumber,
      email: text(row.email, 255)?.toLowerCase() ?? null,
      qualification: text(row.qualification, 120),
      street_address: fullAddress,
      area_code: normAreaCode(row.areaCode),
      kin_name: text(row.kinName, 120),
      kin_contact: normPhone(row.kinNumber) ?? text(row.kinNumber, 40),
      employer_name: text(row.company, 200),
      job_title: text(row.jobTitle, 200),
      employment_period: text(row.duration, 120),
      employer_address: text(row.workAddress, 255),
      gross_salary: normMoney(row.gross),
      net_salary: normMoney(row.net),
      expenses_summary: text(row.expenses, 2000),
      bank_name: text(row.bank, 120),
      account_type: text(row.accountType, 60),
      account_number: normAccountNumber(row.accountNumber),
    },
    timeAtAddress,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("SHEET_SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: { rows?: SheetRow[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (rows.length === 0) return json({ results: [] });
  if (rows.length > MAX_ROWS_PER_REQUEST) {
    return json({ error: `Max ${MAX_ROWS_PER_REQUEST} rows per request` }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const results: Array<{ outcome: string; id?: string; reason?: string }> = [];

  for (const raw of rows) {
    try {
      const mapped = mapRow(raw);
      const { firstName, lastName, phone, idNumber, fields, timeAtAddress } = mapped;

      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
      if (!fullName || !phone) {
        results.push({ outcome: "skipped", reason: "missing name or phone" });
        continue;
      }

      // Match an existing application: SA ID first (strongest), else phone.
      const orParts = [];
      if (idNumber) orParts.push(`id_number.eq.${idNumber}`);
      orParts.push(`phone.eq.${phone}`);
      const { data: candidates, error: findErr } = await supabase
        .from("finance_applications")
        .select("id, id_number, phone, created_at, " + FILLABLE.join(", "))
        .or(orParts.join(","))
        .order("created_at", { ascending: false })
        .limit(10);
      if (findErr) throw findErr;

      const match =
        (idNumber && candidates?.find((c: any) => c.id_number === idNumber)) ||
        candidates?.[0] ||
        null;

      if (match) {
        // Fill blanks only — never overwrite existing data, never touch status.
        const patch: Record<string, unknown> = {};
        for (const col of FILLABLE) {
          const existing = (match as any)[col];
          const incoming = (fields as any)[col];
          const isBlank = existing === null || existing === undefined || String(existing).trim() === "";
          if (isBlank && incoming !== null && incoming !== undefined) patch[col] = incoming;
        }
        if (Object.keys(patch).length === 0) {
          results.push({ outcome: "exists", id: (match as any).id });
          continue;
        }
        const { error: updErr } = await supabase
          .from("finance_applications")
          .update(patch)
          .eq("id", (match as any).id);
        if (updErr) throw updErr;
        results.push({ outcome: "updated", id: (match as any).id });
        continue;
      }

      // New application -> Pipeline "New Applications" tab, WhatsApp source.
      const insert: Record<string, unknown> = {
        ...fields,
        full_name: fullName,
        phone,
        email: fields.email ?? `${phone}@no-email.lumina`,
        status: "pending",
        submission_source: "whatsapp",
        ...(timeAtAddress ? { notes: `Time at address: ${timeAtAddress}` } : {}),
      };
      const { data: created, error: insErr } = await supabase
        .from("finance_applications")
        .insert(insert)
        .select("id")
        .single();
      if (insErr) throw insErr;
      results.push({ outcome: "created", id: created.id });
    } catch (err) {
      console.error("[sheet-apps-receiver] row failed:", err);
      results.push({ outcome: "error", reason: String((err as Error)?.message ?? err).slice(0, 300) });
    }
  }

  const summary = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
    return acc;
  }, {});
  console.log("[sheet-apps-receiver] processed", rows.length, "rows:", JSON.stringify(summary));

  return json({ results, summary });
});
