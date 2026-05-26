// Generate a populated bank PDF from a juristic_submissions row.
// POST { submission_id: uuid, bank: 'juristic'|'fic'|'mfc_ubo'|'absa'|'wesbank' }
// Returns: application/pdf (binary)
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Bank = "juristic" | "fic" | "mfc_ubo" | "absa" | "wesbank";

// Coordinate maps (origin = bottom-left, points). Tuned to be close on first run;
// admin can iterate by editing this object.
type Coord = { x: number; y: number; size?: number; page?: number };
const COORDS: Record<Exclude<Bank, "fic">, Record<string, Coord>> = {
  juristic: {
    company_name:        { x: 200, y: 760, size: 10 },
    trading_name:        { x: 200, y: 740, size: 10 },
    registration_number: { x: 200, y: 720, size: 10 },
    entity_type:         { x: 200, y: 700, size: 10 },
    tax_number:          { x: 200, y: 680, size: 10 },
    vat_number:          { x: 200, y: 660, size: 10 },
    nature_of_business:  { x: 200, y: 640, size: 10 },
    registered_address:  { x: 200, y: 620, size: 9 },
    postal_address:      { x: 200, y: 600, size: 9 },
    contact_phone:       { x: 200, y: 580, size: 10 },
    contact_email:       { x: 200, y: 560, size: 10 },
    banker:              { x: 200, y: 530, size: 10 },
    branch:              { x: 200, y: 510, size: 10 },
    branch_code:         { x: 200, y: 490, size: 10 },
    account_number:      { x: 200, y: 470, size: 10 },
    selling_price:       { x: 200, y: 440, size: 10 },
    deposit:             { x: 200, y: 420, size: 10 },
    term:                { x: 200, y: 400, size: 10 },
    product_type:        { x: 200, y: 380, size: 10 },
    signer_full_name:    { x: 200, y: 110, size: 10 },
    signer_capacity:     { x: 200, y: 90,  size: 10 },
    signature_date:      { x: 430, y: 110, size: 10 },
    signature_image:     { x: 380, y: 60 }, // anchor for image
    // shareholders rows (max 6)
    party_row_y_start:   { x: 0, y: 300 },  // first row baseline
    party_row_step:      { x: 0, y: -16 },
  },
  mfc_ubo: {
    company_name:        { x: 220, y: 715, size: 10 },
    registration_number: { x: 220, y: 695, size: 10 },
    // Section A first row baseline
    party_row_y_start:   { x: 0, y: 600 },
    party_row_step:      { x: 0, y: -22 },
    party_name_x:        { x: 80, y: 0, size: 9 },
    party_id_x:          { x: 280, y: 0, size: 9 },
    party_share_x:       { x: 470, y: 0, size: 9 },
    signer_full_name:    { x: 130, y: 115, size: 10 },
    signer_capacity:     { x: 430, y: 115, size: 10 },
    signature_date:      { x: 430, y: 85,  size: 10 },
    signature_image:     { x: 110, y: 60 },
  },
  absa: {
    company_name:        { x: 200, y: 760, size: 10, page: 0 },
    registration_number: { x: 200, y: 740, size: 10, page: 0 },
    trading_name:        { x: 200, y: 720, size: 10, page: 0 },
    tax_number:          { x: 200, y: 700, size: 10, page: 0 },
    vat_number:          { x: 200, y: 680, size: 10, page: 0 },
    nature_of_business:  { x: 200, y: 660, size: 10, page: 0 },
    registered_address:  { x: 200, y: 640, size: 9,  page: 0 },
    party_row_y_start:   { x: 0, y: 500, page: 0 },
    party_row_step:      { x: 0, y: -22 },
    party_name_x:        { x: 60,  y: 0, size: 9 },
    party_id_x:          { x: 250, y: 0, size: 9 },
    party_role_x:        { x: 400, y: 0, size: 9 },
    party_share_x:       { x: 500, y: 0, size: 9 },
    signer_full_name:    { x: 150, y: 200, size: 10, page: 1 },
    signer_capacity:     { x: 150, y: 180, size: 10, page: 1 },
    signature_date:      { x: 430, y: 200, size: 10, page: 1 },
    signature_image:     { x: 380, y: 130, page: 1 },
  },
  wesbank: {
    // landscape 864x612
    company_name:        { x: 250, y: 540, size: 10 },
    registration_number: { x: 250, y: 520, size: 10 },
    trading_name:        { x: 250, y: 500, size: 10 },
    nature_of_business:  { x: 250, y: 480, size: 10 },
    registered_address:  { x: 250, y: 460, size: 9 },
    party_row_y_start:   { x: 0, y: 380 },
    party_row_step:      { x: 0, y: -20 },
    party_name_x:        { x: 80,  y: 0, size: 9 },
    party_id_x:          { x: 320, y: 0, size: 9 },
    party_role_x:        { x: 500, y: 0, size: 9 },
    party_share_x:       { x: 680, y: 0, size: 9 },
    signer_full_name:    { x: 180, y: 90,  size: 10 },
    signer_capacity:     { x: 480, y: 90,  size: 10 },
    signature_date:      { x: 700, y: 90,  size: 10 },
    signature_image:     { x: 60,  y: 50 },
  },
};

function s(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

async function drawSignature(
  pdf: PDFDocument,
  page: any,
  bytes: Uint8Array | null,
  anchor: Coord | undefined,
) {
  if (!bytes || !anchor) return;
  try {
    let img;
    try { img = await pdf.embedPng(bytes); }
    catch { img = await pdf.embedJpg(bytes); }
    const w = 120, h = 40;
    page.drawImage(img, { x: anchor.x, y: anchor.y, width: w, height: h });
  } catch (e) {
    console.warn("signature embed failed:", e);
  }
}

async function fetchSignature(url: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    // Accept data: URLs or http(s)
    if (url.startsWith("data:")) {
      const b64 = url.split(",")[1];
      return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    }
    const r = await fetch(url);
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch { return null; }
}

async function fillFlatPdf(
  tplBytes: Uint8Array,
  bank: Exclude<Bank, "fic">,
  data: Record<string, any>,
  sigBytes: Uint8Array | null,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(tplBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const map = COORDS[bank];
  const pages = pdf.getPages();

  const draw = (key: string, value: string) => {
    const c = map[key]; if (!c) return;
    const page = pages[c.page ?? 0]; if (!page) return;
    page.drawText(s(value), {
      x: c.x, y: c.y, size: c.size ?? 10, font, color: rgb(0, 0, 0),
    });
  };

  // Entity fields
  for (const k of [
    "company_name","trading_name","registration_number","entity_type",
    "tax_number","vat_number","nature_of_business","registered_address",
    "postal_address","contact_phone","contact_email",
  ]) draw(k, data[k]);

  const bd = data.banking_details ?? {};
  draw("banker", bd.banker);
  draw("branch", bd.branch);
  draw("branch_code", bd.branch_code);
  draw("account_number", bd.account_number);

  const fd = data.financial_details ?? {};
  draw("selling_price", fd.selling_price);
  draw("deposit", fd.deposit);
  draw("term", fd.term);
  draw("product_type", fd.product_type);

  draw("signer_full_name", data.signer_full_name);
  draw("signer_capacity", data.signer_capacity);
  draw("signature_date", new Date().toLocaleDateString("en-ZA"));

  // Associated parties rows
  const start = map.party_row_y_start;
  const step  = map.party_row_step;
  const nameX  = map.party_name_x?.x  ?? 80;
  const idX    = map.party_id_x?.x    ?? 280;
  const roleX  = map.party_role_x?.x;
  const shareX = map.party_share_x?.x ?? 470;
  const size   = map.party_name_x?.size ?? 9;
  if (start && step) {
    const page = pages[start.page ?? 0];
    const parties = Array.isArray(data.associated_parties) ? data.associated_parties : [];
    parties.slice(0, 8).forEach((p: any, i: number) => {
      const y = start.y + step.y * i;
      page.drawText(s(p.full_name), { x: nameX, y, size, font });
      page.drawText(s(p.id_number), { x: idX,   y, size, font });
      if (roleX !== undefined) page.drawText(s(p.designation), { x: roleX, y, size, font });
      page.drawText(`${s(p.shareholding_percent)}%`, { x: shareX, y, size, font });
    });
  }

  // Signature image
  const sigAnchor = map.signature_image;
  if (sigAnchor) {
    const page = pages[sigAnchor.page ?? 0];
    await drawSignature(pdf, page, sigBytes, sigAnchor);
  }

  return await pdf.save();
}

async function fillFicForm(
  tplBytes: Uint8Array,
  data: Record<string, any>,
  sigBytes: Uint8Array | null,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(tplBytes);
  const form = pdf.getForm();

  const set = (name: string, value: string) => {
    try { form.getTextField(name).setText(s(value)); } catch { /* ignore missing */ }
  };

  // Entity Information
  set("Entity Information: 1", data.company_name);
  set("Entity Information: 2", data.registration_number);

  // Shareholders mapped to suffix blocks (no suffix, A, B, C, D, E)
  const blocks = ["", "A", "B", "C", "D", "E"];
  const parties = Array.isArray(data.associated_parties) ? data.associated_parties : [];
  parties.slice(0, blocks.length).forEach((p: any, i: number) => {
    const sfx = blocks[i];
    set(`Shareholder Information: 1${sfx}`, p.full_name);
    set(`Shareholder Information: 2${sfx}`, p.id_number);
    set(`Shareholder Information: 3${sfx}`, p.designation);
    set(`Shareholder Information: 4${sfx}`, `${s(p.shareholding_percent)}%`);
    set(`Shareholder Information: 8${sfx}`, p.address ?? "");
    set(`Shareholder Information: 9${sfx}`, p.contact ?? "");
  });

  try { form.flatten(); } catch { /* ignore */ }

  // Stamp signature on last page corner (FIC has no obvious sig coord)
  if (sigBytes) {
    const pages = pdf.getPages();
    const page = pages[pages.length - 1];
    await drawSignature(pdf, page, sigBytes, { x: 80, y: 80 });
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText(s(data.signer_full_name), { x: 220, y: 95, size: 10, font });
    page.drawText(s(data.signer_capacity), { x: 220, y: 80, size: 10, font });
    page.drawText(new Date().toLocaleDateString("en-ZA"), { x: 420, y: 95, size: 10, font });
  }

  return await pdf.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const { submission_id, bank } = await req.json();
    if (!submission_id || !bank) {
      return new Response(JSON.stringify({ error: "submission_id and bank required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const validBanks: Bank[] = ["juristic", "fic", "mfc_ubo", "absa", "wesbank"];
    if (!validBanks.includes(bank as Bank)) {
      return new Response(JSON.stringify({ error: "invalid bank" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error: rowErr } = await admin
      .from("juristic_submissions")
      .select("*")
      .eq("id", submission_id)
      .maybeSingle();
    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: "submission not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Download template
    const { data: tpl, error: tplErr } = await admin.storage
      .from("bank-templates").download(`${bank}.pdf`);
    if (tplErr || !tpl) {
      return new Response(JSON.stringify({ error: `template ${bank}.pdf missing` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const tplBytes = new Uint8Array(await tpl.arrayBuffer());

    // Resolve signature
    let sigBytes: Uint8Array | null = null;
    if (row.signature_image_url) {
      if (row.signature_image_url.startsWith("data:")) {
        sigBytes = await fetchSignature(row.signature_image_url);
      } else {
        // Storage path in juristic-signatures bucket
        const { data: sigBlob } = await admin.storage
          .from("juristic-signatures").download(row.signature_image_url);
        if (sigBlob) sigBytes = new Uint8Array(await sigBlob.arrayBuffer());
      }
    }

    const out = bank === "fic"
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
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
