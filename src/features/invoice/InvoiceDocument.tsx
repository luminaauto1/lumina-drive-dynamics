import './InvoiceDocument.css';
import type { DocumentSettings } from '@/hooks/useDocumentSettings';
import { computeInvoiceTotals } from '@/lib/generateDealInvoicePDF';
import { fmtR, orDash } from '@/features/quote/format';
import type { InvoicePayload, InvoiceParty } from './types';

/**
 * InvoiceDocument — pure presentational render of ONE A4 invoice page in the
 * same visual family as the Quote and OTP documents: obsidian header band,
 * INVOICED TO / DELIVERED ON YOUR BEHALF TO, VEHICLE DETAILS spec grid, the
 * motor-trade items table (Value Incl | VAT | Total Excl), totals stack ending
 * in the obsidian PRINCIPAL DEBT band, banking + conditions, obsidian footer.
 *
 * General (non-vehicle) invoices render the same chrome with a 2-column items
 * table and a TOTAL DUE band. All junk values ("N/A", "-", 0 km, R0 preset
 * lines) are filtered here so the printed document never shows placeholders.
 */

// Treat placeholder junk as absent so it never prints.
const junk = (v: string | number | null | undefined): boolean => {
  const s = String(v ?? '').trim();
  return s === '' || /^(n\/?a|none|null|-|—|\.)$/i.test(s);
};
const clean = (v: string | number | null | undefined): string | null =>
  junk(v) ? null : String(v).trim();

const fmtDateStr = (dateStr: string): string => {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return orDash(dateStr);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

const partyRows = (p: InvoiceParty, workPhone = false): Array<[string, string]> =>
  ([
    ['Name', clean(p.name)],
    ['Reg / ID No', clean(p.regOrId)],
    ['VAT No', clean(p.vatNumber)],
    workPhone ? ['Tel (W)', clean(p.phoneWork)] : null,
    [workPhone ? 'Tel (C)' : 'Tel', clean(p.phone)],
    ['Email', clean(p.email)],
    ['Address', clean(p.address)],
    ['Postal Code', clean(p.postalCode)],
  ].filter(Boolean) as Array<[string, string | null]>)
    .filter(([, v]) => v !== null) as Array<[string, string]>;

export function InvoiceDocument({ payload, settings }: { payload: InvoicePayload; settings: DocumentSettings }) {
  const p = payload;
  const registered = p.taxInvoice || settings.vatRegistered;
  const vatRate = settings.vatRegistered ? (settings.vatPercent || 0) : 0;
  const title = registered ? 'TAX INVOICE' : 'INVOICE';
  const isVehicle = p.mode === 'vehicle';

  // Drop R0 preset lines — a real misc charge always carries a value.
  const misc = (p.miscItems || []).filter((m) => (Number(m.amountIncl) || 0) > 0 && !junk(m.description));
  const generalItems = (p.generalItems || []).filter((l) => !junk(l.description) || (Number(l.amount) || 0) > 0);

  const soldFor = isVehicle && (Number(p.soldForIncl) || 0) > 0 ? Number(p.soldForIncl) : null;
  const t = computeInvoiceTotals(
    isVehicle
      ? { soldForIncl: soldFor ?? undefined, miscItems: misc, depositPaid: p.depositPaid, tradeInDeposit: p.tradeInDeposit }
      : { miscItems: generalItems.map((l) => ({ description: l.description, amountIncl: Number(l.amount) || 0 })) },
    vatRate,
  );
  const vatOf = (incl: number, exempt?: boolean) => (exempt || vatRate <= 0 ? 0 : incl * (vatRate / (100 + vatRate)));

  const v = p.vehicle;
  const vehTitle = [clean(v.model), clean(v.variant)].filter(Boolean).join(' ').toUpperCase();
  const kmVal = Number(String(v.km).replace(/\D/g, '')) || 0;
  const specAll: Array<[string, string]> = ([
    ['Stock No', clean(v.stockNo)],
    ['Reg No', clean(v.regNo)],
    ['VIN / Chassis No', clean(v.vin)],
    ['Engine No', clean(v.engineNo)],
    ['M&M Code', clean(v.mmCode)],
    ['Mileage', kmVal > 0 ? `${kmVal.toLocaleString('en-ZA')} km` : null],
    ['Colour', clean(v.colour)],
    ['Yr of 1st Reg', clean(v.yearFirstReg) || clean(v.year)],
    ['Features', clean(v.features)],
  ].filter(([, val]) => val !== null) as Array<[string, string]>);
  const half = Math.ceil(specAll.length / 2);
  const specA = specAll.slice(0, half);
  const specB = specAll.slice(half);

  const hasDelivered = isVehicle && p.deliveredToEnabled && !junk(p.deliveredTo?.name);
  const addressLine = (settings.companyAddress || '')
    .split('\n').map((s) => s.trim()).filter(Boolean).join(', ');

  const soldDesc = p.soldForLabel
    || `${[clean(v.year), clean(v.make), clean(v.model), clean(v.variant)].filter(Boolean).join(' ') || 'Vehicle'} — Sold For`;

  const bandLabel = isVehicle ? 'Principal Debt' : 'Total Due';
  const bandValue = isVehicle ? t.principal : t.grandIncl;
  const showDeposits = isVehicle && ((Number(p.depositPaid) || 0) > 0 || (Number(p.tradeInDeposit) || 0) > 0);

  return (
    <div className="invoice-doc">
      <section className="page">

        {/* ==================================================== OBSIDIAN HEADER */}
        <header className="iv-head">
          <div className="iv-head-left">
            <div className="iv-wordmark">
              <span className="lm">LUMINA</span> <span className="au">AUTO</span>
            </div>
            <div className="iv-co">
              <div>{settings.companyLegalName}{settings.companyRegNumber ? <> &middot; Reg No {settings.companyRegNumber}</> : null}</div>
              <div>{addressLine || '—'}</div>
              <div>{orDash(settings.companyPhone)} &middot; {orDash(settings.companyEmail)}</div>
              {registered && settings.companyVatNumber ? <div>VAT No {settings.companyVatNumber}</div> : null}
            </div>
          </div>

          <div className="iv-head-right">
            <div className="iv-title">{title}</div>
            <div className="iv-meta">
              <div className="iv-meta-row"><span className="ml">Invoice No</span><span className="mv">{orDash(p.invoiceNumber)}</span></div>
              <div className="iv-meta-row"><span className="ml">Date</span><span className="mv">{fmtDateStr(p.dateStr)}</span></div>
              <div className="iv-meta-row"><span className="ml">Reference</span><span className="mv">{clean(p.paymentReference) || orDash(p.invoiceNumber)}</span></div>
            </div>
          </div>
        </header>

        {/* ============================================================== BODY */}
        <div className="iv-body">

          {/* ROW 1 — INVOICED TO / DELIVERED ON YOUR BEHALF TO (or sale summary) */}
          <div className={`iv-row1${!hasDelivered && !isVehicle ? ' single' : ''}`}>
            <div>
              <div className="iv-h">Invoiced To</div>
              <div className="iv-dl">
                {partyRows(p.billTo).map(([k, val]) => (
                  <div className="iv-dl-row" key={k}><span className="k">{k}</span><span className="v">{val}</span></div>
                ))}
              </div>
            </div>
            {hasDelivered ? (
              <div>
                <div className="iv-h">Delivered On Your Behalf To</div>
                <div className="iv-dl">
                  {partyRows(p.deliveredTo, true).map(([k, val]) => (
                    <div className="iv-dl-row" key={k}><span className="k">{k}</span><span className="v">{val}</span></div>
                  ))}
                </div>
              </div>
            ) : isVehicle ? (
              <div>
                <div className="iv-h">Sale Summary</div>
                <div className="iv-dl">
                  <div className="iv-dl-row"><span className="k">Vehicle</span><span className="v">{orDash([clean(v.year), clean(v.make), clean(v.model)].filter(Boolean).join(' '))}</span></div>
                  {clean(v.dateSold) && <div className="iv-dl-row"><span className="k">Date Sold</span><span className="v">{fmtDateStr(v.dateSold)}</span></div>}
                  {clean(v.salesperson) && <div className="iv-dl-row"><span className="k">Sales Person</span><span className="v">{clean(v.salesperson)}</span></div>}
                  {soldFor !== null && <div className="iv-dl-row"><span className="k">Sold For (Incl)</span><span className="v">{fmtR(soldFor)}</span></div>}
                </div>
              </div>
            ) : null}
          </div>

          {/* VEHICLE DETAILS */}
          {isVehicle && (vehTitle || specAll.length > 0) && (
            <>
              <div className="iv-h">Vehicle Details</div>
              <div className="iv-vtitle">
                {clean(v.year) && <span className="yr">{clean(v.year)}</span>}
                <span className="md">{vehTitle || orDash(clean(v.make))}</span>
              </div>
              <div className="iv-spec">
                <div className="iv-dl">
                  {specA.map(([k, val]) => (
                    <div className="iv-dl-row" key={k}><span className="k">{k}</span><span className="v">{val}</span></div>
                  ))}
                </div>
                <div className="iv-dl">
                  {specB.map(([k, val]) => (
                    <div className="iv-dl-row" key={k}><span className="k">{k}</span><span className="v">{val}</span></div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ITEMS TABLE */}
          <div className="iv-items">
            {isVehicle ? (
              <>
                <div className="iv-tbl-head">
                  <span>Description</span><span>Value (Incl)</span><span>VAT</span><span>Total (Excl)</span>
                </div>
                {soldFor !== null && (
                  <div className="iv-tbl-row strong">
                    <span className="desc">{soldDesc}</span>
                    <span className="amt">{fmtR(soldFor)}</span>
                    <span className="amt">{fmtR(t.vehVat)}</span>
                    <span className="amt">{fmtR(t.vehExcl)}</span>
                  </div>
                )}
                {misc.map((m, i) => {
                  const vat = vatOf(Number(m.amountIncl) || 0, m.vatExempt);
                  return (
                    <div className="iv-tbl-row" key={i}>
                      <span className="desc">{m.description}</span>
                      <span className="amt">{fmtR(Number(m.amountIncl) || 0)}</span>
                      <span className="amt">{fmtR(vat)}</span>
                      <span className="amt">{fmtR((Number(m.amountIncl) || 0) - vat)}</span>
                    </div>
                  );
                })}
                {soldFor === null && misc.length === 0 && (
                  <div className="iv-tbl-row"><span className="desc">—</span><span className="amt">—</span><span className="amt">—</span><span className="amt">—</span></div>
                )}
              </>
            ) : (
              <>
                <div className="iv-tbl-head two"><span>Description</span><span>Amount</span></div>
                {generalItems.length ? generalItems.map((l, i) => (
                  <div className="iv-tbl-row two" key={i}>
                    <span className="desc">{orDash(l.description)}</span>
                    <span className="amt">{fmtR(Number(l.amount) || 0)}</span>
                  </div>
                )) : (
                  <div className="iv-tbl-row two"><span className="desc">—</span><span className="amt">—</span></div>
                )}
              </>
            )}
          </div>

          {/* ROW 2 — banking + conditions | totals */}
          <div className="iv-row2">
            <div className="iv-col">
              {(settings.bankName || settings.bankAccountNumber) && (
                <div>
                  <div className="iv-h">Banking Details</div>
                  <div className="iv-dl">
                    {settings.bankAccountName && <div className="iv-dl-row"><span className="k">Account Name</span><span className="v">{settings.bankAccountName}</span></div>}
                    {settings.bankName && <div className="iv-dl-row"><span className="k">Bank</span><span className="v">{settings.bankName}</span></div>}
                    {settings.bankAccountNumber && <div className="iv-dl-row"><span className="k">Account No</span><span className="v">{settings.bankAccountNumber}</span></div>}
                    {settings.bankBranchCode && <div className="iv-dl-row"><span className="k">Branch Code</span><span className="v">{settings.bankBranchCode}</span></div>}
                    {settings.bankAccountType && <div className="iv-dl-row"><span className="k">Account Type</span><span className="v">{settings.bankAccountType}</span></div>}
                    <div className="iv-dl-row"><span className="k">Reference</span><span className="v">{clean(p.paymentReference) || p.invoiceNumber}</span></div>
                  </div>
                </div>
              )}

              {clean(p.notes) && (
                <div className="iv-notes-wrap">
                  <div className="iv-h">Notes</div>
                  <div className="iv-notes">{p.notes.trim()}</div>
                </div>
              )}

              {isVehicle && (settings.invoiceConditions || '').trim() && (
                <div className="iv-conditions-wrap">
                  <div className="iv-h">Conditions of Sale</div>
                  <div className="iv-conditions">{settings.invoiceConditions.trim()}</div>
                </div>
              )}
              {!registered && <div className="iv-novat">Not a VAT vendor — no VAT charged.</div>}
            </div>

            <div className="iv-col">
              <div className="iv-totals">
                {isVehicle && misc.length > 0 && (
                  <>
                    <div className="iv-tot-row"><span className="lbl">Miscellaneous Items (Excl)</span><span className="amt">{fmtR(t.miscExcl)}</span></div>
                    {soldFor !== null && <div className="iv-tot-row"><span className="lbl">Vehicle (Excl)</span><span className="amt">{fmtR(t.vehExcl)}</span></div>}
                  </>
                )}
                <div className="iv-tot-row"><span className="lbl">Subtotal (Excl. VAT)</span><span className="amt">{fmtR(t.subtotalExcl)}</span></div>
                <div className="iv-tot-row"><span className="lbl">VAT @ {vatRate}%</span><span className="amt">{fmtR(t.totalVat)}</span></div>
                <div className="iv-tot-row strong"><span className="lbl">Grand Total</span><span className="amt">{fmtR(t.grandIncl)}</span></div>
                {showDeposits && (
                  <>
                    <div className="iv-tot-row"><span className="lbl">Deposit Paid</span><span className="amt">{fmtR(Number(p.depositPaid) || 0)}</span></div>
                    <div className="iv-tot-row"><span className="lbl">Trade-In Deposit</span><span className="amt">{fmtR(Number(p.tradeInDeposit) || 0)}</span></div>
                  </>
                )}
                <div className="iv-totaldue">
                  <span className="lbl">{bandLabel}</span>
                  <span className="amt">{fmtR(bandValue)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================== OBSIDIAN FOOTER */}
        <footer className="iv-foot">
          <span className="l">
            {settings.invoiceTerms || 'Payment due on delivery. The vehicle remains the property of the seller until paid in full.'}
          </span>
          <span className="r">{settings.companyLegalName} t/a {settings.companyTradingName} &middot; {title} {p.invoiceNumber}</span>
        </footer>

      </section>
    </div>
  );
}
