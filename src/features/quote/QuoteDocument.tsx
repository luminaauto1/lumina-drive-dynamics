import './QuoteDocument.css';
import type { QuoteData, QuoteLineItem } from './types';
import { calcQuote } from './calc';
import { fmtR, orDash } from './format';

/**
 * QuoteDocument — pure presentational render of ONE A4 quotation page.
 * Reproduces the sample (quote_sample_p1.png): obsidian header band, CLIENT
 * DETAILS + SALE SUMMARY, VEHICLE DETAILS (image / no-image + two-sub-column
 * spec), ACCESSORIES + VALUE ADDED PRODUCTS mini-tables, totals stack with the
 * obsidian TOTAL DUE band, COMMENTS, sales-rep signature block, obsidian footer.
 *
 * VAT is entirely driven by data.vat_registered (see calcQuote): when true, the
 * SUBTOTAL (EXCL. VAT) + VAT @ 15% rows appear above TOTAL DUE and a VAT No line
 * shows in the header. Empty optional fields render as an em dash, never "undefined".
 */
export function QuoteDocument({ data }: { data: QuoteData }) {
  const calc = calcQuote(data);
  const { company, quote, client, vehicle, sales_rep } = data;

  // Header company address: collapse the multi-line settings value to one line.
  const addressLine = (company.address || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');

  // Big vehicle title: "{year} {MODEL UPPERCASE}" (year lighter grey, model bold).
  const modelDisplay = (vehicle.title || `${vehicle.make} ${vehicle.model} ${vehicle.variant}`)
    .trim()
    .toUpperCase();

  const specA: Array<[string, string]> = [
    ['Colour', orDash(vehicle.color)],
    ['Mileage', orDash(vehicle.mileage)],
    ['Reg No', orDash(vehicle.reg_no)],
    ['Stock No', orDash(vehicle.stock_no)],
  ];
  const specB: Array<[string, string]> = [
    ['VIN No', orDash(vehicle.vin)],
    ['Engine No', orDash(vehicle.engine_no)],
    ['M&M Code', orDash(vehicle.mm_code)],
    ['Transmission', orDash(vehicle.transmission)],
  ];

  const renderTable = (items: QuoteLineItem[], nettTotal: number) => {
    const rows = items && items.length > 0 ? items : null;
    return (
      <>
        <div className="q-tbl-head">
          <span>Description</span>
          <span>Amount</span>
        </div>
        {rows
          ? rows.map((it, i) => (
              <div className="q-tbl-row" key={i}>
                <span className="desc">{orDash(it.description)}</span>
                <span className="amt">{fmtR(Number(it.amount) || 0)}</span>
              </div>
            ))
          : (
            <div className="q-tbl-row">
              <span className="desc">—</span>
              <span className="amt">—</span>
            </div>
          )}
        <div className="q-tbl-nett">
          <span className="lbl">Nett Total</span>
          <span className="amt">{fmtR(nettTotal)}</span>
        </div>
      </>
    );
  };

  return (
    <div className="quote-doc">
      <section className="page">

        {/* ==================================================== OBSIDIAN HEADER */}
        <header className="q-head">
          <div className="q-head-left">
            <div className="q-wordmark">
              <span className="lm">LUMINA</span> <span className="au">AUTO</span>
            </div>
            <div className="q-co">
              <div>{company.legal_name} &middot; Reg No {orDash(company.reg_no)}</div>
              <div>{addressLine || '—'}</div>
              <div>{orDash(company.phone)} &middot; {orDash(company.email)}</div>
              {data.vat_registered && (
                <div>VAT No {orDash(data.vat_number)}</div>
              )}
            </div>
          </div>

          <div className="q-head-right">
            <div className="q-quotation">QUOTATION</div>
            <div className="q-meta">
              <div className="q-meta-row">
                <span className="ml">Quote No</span>
                <span className="mv">{orDash(quote.ref)}</span>
              </div>
              <div className="q-meta-row">
                <span className="ml">Date</span>
                <span className="mv">{orDash(quote.date)}</span>
              </div>
              <div className="q-meta-row">
                <span className="ml">Valid Until</span>
                <span className="mv">{orDash(quote.valid_until)}</span>
              </div>
            </div>
          </div>
        </header>

        {/* ============================================================== BODY */}
        <div className="q-body">

          {/* ROW 1 — CLIENT DETAILS / SALE SUMMARY */}
          <div className="q-row1">
            <div>
              <div className="q-h">Client Details</div>
              <div className="q-dl">
                <div className="q-dl-row"><span className="k">Client</span><span className="v">{orDash(client.name)}</span></div>
                <div className="q-dl-row"><span className="k">ID / Passport</span><span className="v">{orDash(client.id_number)}</span></div>
                <div className="q-dl-row"><span className="k">Cell</span><span className="v">{orDash(client.cell)}</span></div>
                <div className="q-dl-row"><span className="k">Email</span><span className="v">{orDash(client.email)}</span></div>
                <div className="q-dl-row"><span className="k">Address</span><span className="v">{orDash(client.address)}</span></div>
              </div>
            </div>
            <div>
              <div className="q-h">Sale Summary</div>
              <div className="q-dl">
                <div className="q-dl-row"><span className="k">Vehicle</span><span className="v">{orDash(vehicle.title)}</span></div>
                <div className="q-dl-row"><span className="k">Retail Price</span><span className="v">{fmtR(data.retail_price)}</span></div>
                <div className="q-dl-row"><span className="k">Accessories</span><span className="v">{fmtR(calc.accessoriesTotal)}</span></div>
                <div className="q-dl-row"><span className="k">Value Added Products</span><span className="v">{fmtR(calc.vapsTotal)}</span></div>
                <div className="q-dl-row"><span className="k">Sales Consultant</span><span className="v">{orDash(sales_rep.name)}</span></div>
              </div>
            </div>
          </div>

          {/* VEHICLE DETAILS */}
          <div className="q-h">Vehicle Details</div>
          <div className="q-vtitle">
            <span className="yr">{orDash(vehicle.year)}</span>
            <span className="md">{modelDisplay || '—'}</span>
          </div>

          <div className="q-vgrid">
            {/* image / no-image placeholder + caption */}
            <div>
              <div className="q-img">
                {vehicle.image_url ? (
                  <img src={vehicle.image_url} alt={modelDisplay} />
                ) : (
                  <div className="q-img-ph">
                    <svg viewBox="0 0 240 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path
                        d="M18 66 L40 66 M200 66 L222 66
                           M52 66 C52 74 44 74 44 66 C44 58 52 58 52 66 Z
                           M196 66 C196 74 188 74 188 66 C188 58 196 58 196 66 Z"
                        stroke="#4C4C4F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                      />
                      <path
                        d="M22 66 C22 56 30 52 44 51 L70 33 C74 30 79 28 85 28 L150 28
                           C168 28 182 36 196 51 C208 52 218 56 218 66"
                        stroke="#4C4C4F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                      />
                      <path d="M78 33 L120 33 L120 52 L58 52 Z M128 33 L150 33 C162 33 172 40 180 52 L128 52 Z"
                        stroke="#4C4C4F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                      />
                    </svg>
                    <div className="wm">LUMINA AUTO</div>
                  </div>
                )}
              </div>
              <div className="q-cap">Image depicts the vehicle on offer. Features and options as per specification below.</div>
            </div>

            {/* two-sub-column spec grid */}
            <div className="q-spec">
              <div className="q-dl">
                {specA.map(([k, v]) => (
                  <div className="q-dl-row" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
                ))}
              </div>
              <div className="q-dl">
                {specB.map(([k, v]) => (
                  <div className="q-dl-row" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
                ))}
              </div>
            </div>
          </div>

          {/* ROW 2 — ACCESSORIES / VALUE ADDED PRODUCTS + comments / totals + rep */}
          <div className="q-row2">

            {/* LEFT column: accessories, comments, sales rep */}
            <div className="q-col">
              <div>
                <div className="q-h">Accessories</div>
                {renderTable(data.accessories, calc.accessoriesTotal)}
              </div>

              <div className="q-comments-wrap">
                <div className="q-h">Comments</div>
                <div className="q-comments">{orDash(data.comments)}</div>
              </div>

              <div className="q-rep">
                <div className="sig" />
                <div className="role">Sales Representative</div>
                <div className="name">{orDash(sales_rep.name)}</div>
                <div className="cell">{orDash(sales_rep.cell)}</div>
              </div>
            </div>

            {/* RIGHT column: value added products, totals, TOTAL DUE band */}
            <div className="q-col">
              <div>
                <div className="q-h">Value Added Products</div>
                {renderTable(data.vaps, calc.vapsTotal)}
              </div>

              <div className="q-totals">
                <div className="q-tot-row">
                  <span className="lbl">Retail Price</span>
                  <span className="amt">{fmtR(data.retail_price)}</span>
                </div>
                <div className="q-tot-row">
                  <span className="lbl">Accessories</span>
                  <span className="amt">{fmtR(calc.accessoriesTotal)}</span>
                </div>
                <div className="q-tot-row">
                  <span className="lbl">Value Added Products</span>
                  <span className="amt">{fmtR(calc.vapsTotal)}</span>
                </div>

                {/* VAT-registered conditional rows (VAT-inclusive split of total) */}
                {calc.vatRegistered && (
                  <>
                    <div className="q-tot-row strong">
                      <span className="lbl">Subtotal (Excl. VAT)</span>
                      <span className="amt">{fmtR(calc.subtotalExcl ?? 0)}</span>
                    </div>
                    <div className="q-tot-row">
                      <span className="lbl">VAT @ 15%</span>
                      <span className="amt">{fmtR(calc.vat ?? 0)}</span>
                    </div>
                  </>
                )}

                <div className="q-totaldue">
                  <span className="lbl">Total Due</span>
                  <span className="amt">{fmtR(calc.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================== OBSIDIAN FOOTER */}
        <footer className="q-foot">
          <span className="l">
            This quotation is valid for {quote.validity_days} days and is subject to a signed Offer to Purchase.
          </span>
          <span className="r">{company.legal_name} t/a {company.trading_name}</span>
        </footer>

      </section>
    </div>
  );
}
