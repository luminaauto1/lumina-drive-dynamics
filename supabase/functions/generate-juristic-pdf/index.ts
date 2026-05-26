import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Bank = "juristic" | "fic" | "mfc_ubo" | "absa" | "wesbank";

type FieldCoord = { x: number; y: number; size: number; page?: number };
type SigCoord = { x: number; y: number; width: number; height: number; page?: number };
type PartyRow = {
  page?: number;
  y_start: number;
  y_step: number;
  name_x: number;
  id_x: number;
  role_x?: number;
  share_x: number;
  size: number;
  max_rows: number;
};

type BankMap = {
  fields: Partial<Record<EntityKey, FieldCoord>>;
  parties?: PartyRow;
  signature: SigCoord;
};

type EntityKey =
  | "company_name"
  | "trading_name"
  | "registration_number"
  | "entity_type"
  | "tax_number"
  | "vat_number"
  | "nature_of_business"
  | "registered_address"
  | "postal_address"
  | "contact_phone"
  | "contact_email"
  | "banker"
  | "branch"
  | "branch_code"
  | "account_number"
  | "account_type"
  | "signer_full_name"
  | "signer_capacity"
  | "signature_date";

// ---------- CALIBRATED COORDINATE MAPPING DICTIONARIES ----------

const standardBankMap: BankMap = {
  fields: {
    company_name: { x: 160, y: 680, size: 10 },
    trading_name: { x: 160, y: 660, size: 10 },
    registration_number: { x: 160, y: 640, size: 10 },
    entity_type: { x: 160, y: 620, size: 10 },
    tax_number: { x: 160, y: 600, size: 10 },
    vat_number: { x: 160, y: 580, size: 10 },
    nature_of_business: { x: 450, y: 680, size: 10 },
    registered_address: { x: 160, y: 550, size: 9 },
    postal_address: { x: 160, y: 520, size: 9 },
    contact_phone: { x: 450, y: 660, size: 10 },
    contact_email: { x: 450, y: 640, size: 10 },
    banker: { x: 160, y: 300, size: 10 },
    branch: { x: 160, y: 280, size: 10 },
    branch_code: { x: 300, y: 280, size: 10 },
    account_number: { x: 160, y: 260, size: 10 },
    account_type: { x: 160, y: 240, size: 10 },
    signer_full_name: { x: 160, y: 140, size: 10 },
    signer_capacity: { x: 160, y: 120, size: 10 },
    signature_date: { x: 430, y: 140, size: 10 },
  },
  parties: {
    y_start: 400,
    y_step: -20,
    name_x: 60,
    id_x: 240,
    role_x: 400,
    share_x: 500,
    size: 9,
    max_rows: 6,
  },
  signature: { x: 380, y: 80, width: 120, height: 40 },
};

const absaMap: BankMap = {
  fields: {
    company_name: { x: 180, y: 495, size: 10, page: 0 },
    registration_number: { x: 180, y: 465, size: 10, page: 0 },
    trading_name: { x: 180, y: 440, size: 10, page: 0 },
    tax_number: { x: 180, y: 420, size: 10, page: 0 },
    vat_number: { x: 180, y: 400, size: 10, page: 0 },
    nature_of_business: { x: 180, y: 380, size: 10, page: 0 },
    registered_address: { x: 180, y: 360, size: 9, page: 0 },
    postal_address: { x: 180, y: 340, size: 9, page: 0 },
    contact_phone: { x: 180, y: 320, size: 10, page: 0 },
    contact_email: { x: 180, y: 300, size: 10, page: 0 },
    signer_full_name: { x: 150, y: 200, size: 10, page: 1 },
    signer_capacity: { x: 150, y: 180, size: 10, page: 1 },
    signature_date: { x: 430, y: 200, size: 10, page: 1 },
  },
  parties: {
    page: 0,
    y_start: 385,
    y_step: -25,
    name_x: 60,
    id_x: 230,
    role_x: 400,
    share_x: 500,
    size: 9,
    max_rows: 6,
  },
  signature: { x: 380, y: 130, width: 120, height: 40, page: 1 },
};

const mfcMap: BankMap = {
  fields: {
    company_name: { x: 160, y: 680, size: 10 },
    registration_number: { x: 160, y: 650, size: 10 },
    trading_name: { x: 160, y: 630, size: 10 },
    nature_of_business: { x: 160, y: 610, size: 10 },
    registered_address: { x: 160, y: 590, size: 9 },
    signer_full_name: { x: 130, y: 130, size: 10 },
    signer_capacity: { x: 430, y: 130, size: 10 },
    signature_date: { x: 430, y: 110, size: 10 },
  },
  parties: {
    y_start: 550,
    y_step: -25,
    name_x: 80,
    id_x: 280,
    share_x: 470,
    size: 9,
    max_rows: 5,
  },
  signature: { x: 120, y: 60, width: 120, height: 40 },
};

const wesbankMap: BankMap = {
  fields: {
    company_name: { x: 260, y: 660, size: 10 },
    registration_number: { x: 260, y: 635, size: 10 },
    trading_name: { x: 260, y: 610, size: 10 },
    nature_of_business: { x: 260, y: 585, size: 10 },
    registered_address: { x: 260, y: 560, size: 9 },
    contact_phone: { x: 260, y: 535, size: 10 },
    contact_email: { x: 260, y: 510, size: 10 },
    signer_full_name: { x: 180, y: 140, size: 10 },
    signer_capacity: { x: 480, y: 140, size: 10 },
    signature_date: { x: 700, y: 140, size: 10 },
  },
  parties: {
    y_start: 450,
    y_step: -25,
    name_x: 80,
    id_x: 320,
    role_x: 500,
    share_x: 680,
    size: 9,
    max_rows: 6,
  },
  signature: { x: 160, y: 100, width: 120, height: 40 },
};

const BANK_MAPS: Record<Exclude<Bank, "fic">, BankMap> = {
  juristic: standardBankMap,
  absa: absaMap,
  mfc_ubo: mfcMap,
  wesbank: wesbankMap,
};

// ---------- HELPERS ----------

const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

async function fetchSignature(url: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    if (url.startsWith("data:")) {
      const b64 = url.split(",")[1];
      return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    }
    const r = await fetch(url);
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}

async function drawSignatureScaled(pdf: PDFDocument, page: any, bytes: Uint8Array | null, coord: SigCoord) {
  if (!bytes) return;
  try {
    let img;
    try {
      img = await pdf.embedPng(bytes);
    } catch {
      img = await pdf.embedJpg(bytes);
    }
    page.drawImage(img, {
      x: coord.x,
      y: coord.y,
      width: coord.width,
      height: coord.height,
    });
  } catch (e) {
    console.warn("signature embed failed:", e);
  }
}

function entityValue(row: Record<string, any>, key: EntityKey): string {
  const bd = row.banking_details ?? {};
  switch (key) {
    case "banker":
      return s(bd.banker);
    case "branch":
      return s(bd.branch);
    case "branch_code":
      return s(bd.branch_code);
    case "account_number":
      return s(bd.account_number);
    case "account_type":
      return s(bd.account_type);
    case "signature_date":
      return new Date().toLocaleDateString("en-ZA");
    default:
      return s(row[key]);
  }
}

async function fillFlatPdf(
  tplBytes: Uint8Array,
  bank: Exclude<Bank, "fic">,
  row: Record<string, any>,
  sigBytes: Uint8Array | null,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(tplBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const map = BANK_MAPS[bank];
  const pages = pdf.getPages();

  for (const [key, coord] of Object.entries(map.fields) as [EntityKey, FieldCoord][]) {
    const page = pages[coord.page ?? 0];
    if (!page) continue;
    page.drawText(entityValue(row, key), {
      x: coord.x,
      y: coord.y,
      size: coord.size,
      font,
      color: rgb(0, 0, 0),
    });
  }

  if (map.parties) {
    const p = map.parties;
    const page = pages[p.page ?? 0];
    const parties = Array.isArray(row.associated_parties) ? row.associated_parties : [];
    parties.slice(0, p.max_rows).forEach((party: any, i: number) => {
      const y = p.y_start + p.y_step * i;
      page.drawText(s(party.full_name), { x: p.name_x, y, size: p.size, font });
      page.drawText(s(party.id_number), { x: p.id_x, y, size: p.size, font });
      if (p.role_x !== undefined) {
        page.drawText(s(party.designation), { x: p.role_x, y, size: p.size, font });
      }
      page.drawText(`${s(party.shareholding_percent)}%`, { x: p.share_x, y, size: p.size, font });
    });
  }

  const sigPage = pages[map.signature.page ?? 0];
  await drawSignatureScaled(pdf, sigPage, sigBytes, map.signature);

  return await pdf.save();
}

async function fillFicForm(
  tplBytes: Uint8Array,
  row: Record<string, any>,
  sigBytes: Uint8Array | null,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(tplBytes);
  const form = pdf.getForm();

  const set = (name: string, value: string) => {
    try {
      form.getTextField(name).setText(s(value));
    } catch {
      /* ignore missing */
    }
  };

  set("Entity Information: 1", row.company_name);
  set("Entity Information: 2", row.registration_number);

  const blocks = ["", "A", "B", "C", "D", "E"];
  const parties = Array.isArray(row.associated_parties) ? row.associated_parties : [];
  parties.slice(0, blocks.length).forEach((p: any, i: number) => {
    const sfx = blocks[i];
    set(`Shareholder Information: 1${sfx}`, p.full_name);
    set(`Shareholder Information: 2${sfx}`, p.id_number);
    set(`Shareholder Information: 3${sfx}`, p.designation);
    set(`Shareholder Information: 4${sfx}`, `${s(p.shareholding_percent)}%`);
    set(`Shareholder Information: 8${sfx}`, p.address ?? "");
    set(`Shareholder Information: 9${sfx}`, p.contact ?? "");
  });

  try {
    form.flatten();
  } catch {
    /* ignore */
  }

  if (sigBytes) {
    const pages = pdf.getPages();
    const page = pages[pages.length - 1];
    await drawSignatureScaled(pdf, page, sigBytes, { x: 80, y: 80, width: 120, height: 40 });
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText(s(row.signer_full_name), { x: 250, y: 95, size: 10, font });
    page.drawText(s(row.signer_capacity), { x: 250, y: 80, size: 10, font });
    page.drawText(new Date().toLocaleDateString("en-ZA"), { x: 450, y: 95, size: 10, font });
  }

  return await pdf.save();
}

// ---------- HTTP HANDLER ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { submission_id, bank } = await req.json();
    if (!submission_id || !bank) {
      return new Response(JSON.stringify({ error: "submission_id and bank required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const validBanks: Bank[] = ["juristic", "fic", "mfc_ubo", "absa", "wesbank"];
    if (!validBanks.includes(bank as Bank)) {
      return new Response(JSON.stringify({ error: "invalid bank" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: row, error: rowErr } = await admin
      .from("juristic_submissions")
      .select("*")
      .eq("id", submission_id)
      .maybeSingle();
    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: "submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tpl, error: tplErr } = await admin.storage.from("bank-templates").download(`${bank}.pdf`);
    if (tplErr || !tpl) {
      return new Response(JSON.stringify({ error: `template ${bank}.pdf missing` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tplBytes = new Uint8Array(await tpl.arrayBuffer());

    let sigBytes: Uint8Array | null = null;
    if (row.signature_image_url) {
      if (row.signature_image_url.startsWith("data:")) {
        sigBytes = await fetchSignature(row.signature_image_url);
      } else {
        const { data: sigBlob } = await admin.storage.from("juristic-signatures").download(row.signature_image_url);
        if (sigBlob) sigBytes = new Uint8Array(await sigBlob.arrayBuffer());
      }
    }

    const out =
      bank === "fic"
        ? await fillFicForm(tplBytes, row, sigBytes)
        : await fillFlatPdf(tplBytes, bank as Exclude<Bank, "fic">, row, sigBytes);

    return new Response(out, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${row.company_name ?? "juristic"}_${bank}.pdf"`,
      },
    });
  } catch (e) {
    console.error("generate-juristic-pdf error:", e);
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
