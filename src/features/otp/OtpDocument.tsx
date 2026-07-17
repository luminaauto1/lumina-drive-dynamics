import './OtpDocument.css';
import type { OtpData } from './types';
import { calcOtp } from './calc';
import { fmtZAR } from './format';

export function OtpDocument({ data }: { data: OtpData }) {
  const calc = calcOtp(data);
  const { company, offer, client, sales, vehicle, finance, financials, lines } = data;

  const totalIncl = fmtZAR(calc.totalIncl);
  const balanceLabel = calc.vatRegistered ? 'Balance Payable (incl. VAT)' : 'Balance Payable';
  const totalLabel = calc.vatRegistered ? 'Total Price (incl. VAT)' : 'Total Price';

  return (
    <div className="otp-doc">

      {/* ============================================================= PAGE 1 */}
      <section className="page">

        <div className="masthead">
          <div className="wordmark">
            <span className="lm">LUMINA</span>
            <span className="au">AUTO</span>
          </div>
          <div className="co-block">
            <div className="co-name">{company.legal_name}</div>
            <div>t/a {company.trading_name}</div>
            <div>{company.address}</div>
            <div>{company.email} &bull; {company.phone}</div>
            <div>Reg: {company.reg_no} &nbsp; VAT: {company.vat_no}</div>
          </div>
        </div>

        <div className="title-row">
          <span className="rule"></span>
          <h1>OFFER TO PURCHASE</h1>
          <span className="rule"></span>
        </div>
        <div className="ref-row">
          <span>Quote Ref: <b>{offer.ref}</b></span>
          <span>Date: <b>{offer.date}</b> &nbsp;|&nbsp; Valid Until: <b>{offer.valid_until}</b></span>
        </div>

        <div className="intro-grid">
          <div>
            <div className="block-title">Contact Information</div>
            <div className="kv"><span className="lbl">Name</span><span className="val">{client.title} {client.name}</span></div>
            <div className="kv"><span className="lbl">ID</span><span className="val">{client.id}</span></div>
            <div className="kv"><span className="lbl">Address</span><span className="val">{client.address}</span></div>
            <div className="kv"><span className="lbl">Postal</span><span className="val">{client.postal}</span></div>
            <div className="kv"><span className="lbl">Email</span><span className="val">{client.email}</span></div>
            <div className="kv"><span className="lbl">Cell</span><span className="val">{client.cell}</span></div>
          </div>
          <div>
            <div className="block-title">Offer Details</div>
            <div className="kv"><span className="lbl">From</span><span className="val">{sales.exec_name} {sales.exec_phone}</span></div>
            <div className="kv"><span className="lbl">Re</span><span className="val">Quote {offer.ref} — {vehicle.make} {vehicle.model}</span></div>
            <div className="kv"><span className="lbl">Date</span><span className="val">{offer.date}</span></div>
            <div className="kv"><span className="lbl">Valid Until</span><span className="val">{offer.valid_until}</span></div>
          </div>
        </div>

        <div className="greeting">
          <div className="dear">Dear {client.title} {client.name},</div>
          Thank you for your enquiry. As per your request, it gives us great pleasure to submit the following
          offer to purchase, prepared according to your individual requirements. This document, once accepted in
          writing by an authorised manager of {company.trading_name}, constitutes a binding agreement subject to the
          Conditions of Offer set out herein.
        </div>

        <div className="deal-grid">

          {/* LEFT: vehicle + finance + notes */}
          <div>
            <div className="panel">
              <div className="panel-head">Vehicle Details</div>
              <table className="spec">
                <tbody>
                  <tr><td className="k">Make</td><td className="v">{vehicle.make}</td><td className="k2">Year</td><td className="v">{vehicle.year}</td></tr>
                  <tr><td className="k">Model</td><td className="v">{vehicle.model}</td><td className="k2">Order Type</td><td className="v">{vehicle.order_type}</td></tr>
                  <tr><td className="k">Reg No.</td><td className="v">{vehicle.reg_no}</td><td className="k2">Mileage</td><td className="v">{vehicle.mileage}</td></tr>
                  <tr><td className="k">Colour</td><td className="v">{vehicle.colour}</td><td className="k2">Trim</td><td className="v">{vehicle.trim}</td></tr>
                  <tr><td className="k">VIN No.</td><td className="v">{vehicle.vin}</td><td className="k2">Engine No.</td><td className="v">{vehicle.engine_no}</td></tr>
                  <tr><td className="k">Stock No.</td><td className="v">{vehicle.stock_no}</td><td className="k2">M&amp;M Code</td><td className="v">{vehicle.mm_code}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="panel">
              <div className="panel-head">Vehicle Finance Details</div>
              <table className="spec">
                <tbody>
                  <tr><td className="k">Finance Method</td><td className="v">{finance.method}</td></tr>
                  <tr><td className="k">Financed By</td><td className="v">{finance.financed_by}</td></tr>
                  <tr><td className="k">Bank / Branch</td><td className="v">{finance.bank_branch}</td></tr>
                  <tr><td className="k">Branch Phone</td><td className="v">{finance.branch_phone}</td></tr>
                  <tr><td className="k">Branch Contact</td><td className="v">{finance.branch_contact}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="panel">
              <div className="panel-head">Notes</div>
              <div className="notes-body">{data.notes}</div>
            </div>
          </div>

          {/* RIGHT: price + summary + balance */}
          <div>
            <div className="panel">
              <div className="price-head"><span>Vehicle Price</span><span>{totalIncl}</span></div>
              <div className="price-row"><span className="lbl">Base Vehicle Price</span><span className="amt">{fmtZAR(financials.base_price)}</span></div>
              {lines.extras && (
                financials.extras_items && financials.extras_items.length
                  ? financials.extras_items
                      .filter((it) => it.description.trim() || Number(it.amount))
                      .map((it, i) => (
                        <div key={i} className="price-row">
                          <span className="lbl">{it.description.trim() || 'Extras'}</span>
                          <span className="amt">{fmtZAR(Number(it.amount) || 0)}</span>
                        </div>
                      ))
                  : (
                    <div className="price-row"><span className="lbl">Extras</span><span className="amt">{fmtZAR(financials.extras)}</span></div>
                  )
              )}
              {lines.vap && (
                <div className="price-row"><span className="lbl">Value Added Products</span><span className="amt">{fmtZAR(financials.vap)}</span></div>
              )}
              {lines.admin_fee && (
                <div className="price-row"><span className="lbl">Administration Fee</span><span className="amt">{fmtZAR(financials.admin_fee)}</span></div>
              )}
              {lines.delivery_fee && (
                <div className="price-row"><span className="lbl">Delivery Fee</span><span className="amt">{fmtZAR(financials.delivery_fee)}</span></div>
              )}
              {lines.licensing && (
                <div className="price-row"><span className="lbl">Licensing &amp; Registration{calc.novatTag}</span><span className="amt">{fmtZAR(financials.licensing)}</span></div>
              )}
            </div>

            <div className="panel">
              <div className="panel-head">Summary</div>
              {calc.vatRegistered && (
                <div className="subtotal-row"><span>Subtotal (excl. VAT)</span><span>{fmtZAR(calc.subtotalExcl!)}</span></div>
              )}
              <div className="price-row"><span className="lbl">VAT</span><span className="amt">{calc.vatRegistered ? fmtZAR(calc.vat!) : 'n/a'}</span></div>
              <div className="subtotal-row tot"><span>{totalLabel}</span><span>{totalIncl}</span></div>
              <div className="price-row"><span className="lbl">Less: Deposit</span><span className="amt">- {fmtZAR(calc.deposit)}</span></div>
            </div>

            <div className="balance-bar"><span>{balanceLabel}</span><span>{fmtZAR(calc.balance)}</span></div>
            <div style={{ fontSize: '7px', color: 'var(--grey)', textAlign: 'right', padding: '5px 2px 0', lineHeight: 1.4 }}>{calc.vatNote}</div>
          </div>
        </div>

        <div className="sign-block">
          <div className="vw-sign-row">
            <div className="vw-sign">
              <div className="vw-line"><span className="vw-lbl">Client:</span><span className="vw-rule"></span></div>
              <div className="vw-name">{client.title} {client.name}</div>
            </div>
            <div className="vw-sign">
              <div className="vw-line"><span className="vw-lbl">Sales Executive:</span><span className="vw-rule"></span></div>
              <div className="vw-name">{sales.exec_name} {sales.exec_phone}</div>
            </div>
            <div className="vw-otp">OTP No: <b>{offer.ref}</b></div>
          </div>
          <div className="vw-sign-row pd">
            <div className="vw-sign">
              <div className="vw-line"><span className="vw-lbl">Place:</span><span className="vw-rule"></span></div>
            </div>
            <div className="vw-sign">
              <div className="vw-line"><span className="vw-lbl">Date:</span><span className="vw-rule"></span></div>
            </div>
            <div className="vw-otp"></div>
          </div>
        </div>

        <div className="servicenote">
          <b>{company.trading_name}</b> offers a comprehensive suite of services to ensure a seamless buying experience:
          <ul>
            <li>Vehicle finance applications, negotiation and processing at all major banks.</li>
            <li>Vehicle insurance, extended warranty, service and maintenance plans.</li>
            <li>Risk products such as credit cover and tyre warranty.</li>
            <li>Value added accessories: tracker, smash &amp; grab, paint protection and more.</li>
          </ul>
        </div>
      </section>

      {/* ============================================================= PAGE 2 */}
      <section className="page">
        <div className="legal-head"><span>OTP No: <b>{offer.ref}</b></span><span>Dated: <b>{offer.date}</b></span></div>
        <div className="legal-title">Conditions of Offer — All Vehicle Sales</div>
        <div className="legal-sub">Please refer to special conditions for new / pre-owned</div>

        <div className="legal">
          <h2>1. Definitions</h2>
          <p className="c">1.1 "I", "me" and "my" refer to the Purchaser; "you", "they" and "Company" refer to Makhulu Holdings (Pty) Ltd t/a {company.trading_name}, which is the Seller; and "us" or "we" refer to the Company and me jointly.</p>
          <p className="c">1.2 "Offer" means this offer to purchase that I have made to the Company on the terms and conditions contained in this document. Once the Company has accepted this offer, I acknowledge that it will become a binding contract between us.</p>
          <p className="c">1.3 "Risk" refers to the possibility of suffering harm or loss of a physical or financial nature, and the responsibility for the harm or loss suffered.</p>

          <h2>2. General Conditions of Offer</h2>
          <p className="c">2.1 I acknowledge and agree that you will not be obliged to make the vehicle available or deliver it to me until a duly authorised manager on behalf of the Company accepts this offer in writing.</p>
          <p className="c">2.2 If you accept this offer, I acknowledge and agree that:</p>
          <p className="cc">2.2.1 I will be liable for, and agree to pay against delivery of the vehicle, the balance of the purchase price, which includes, amongst others, those additional items calculated on the vehicle price as contained in this offer;</p>
          <p className="cc">2.2.2 risk in the vehicle shall pass to me on delivery;</p>
          <p className="cc">2.2.3 you will continue to own the vehicle until I have paid all monies outstanding;</p>
          <p className="cc">2.2.4 I have had a proper opportunity to consider the implications of this offer, which is made of my own free will.</p>
          <p className="c">2.3 The offer will lapse if I am not able to provide satisfactory proof of my ability to pay for the vehicle, or written approval or guarantee of financing of the vehicle by a registered credit provider, within fourteen (14) days of the date of this offer or any extension given by you.</p>

          <h2>3. Delivery</h2>
          <p className="c">3.1 I accept and agree that delivery of the vehicle (plus any additional items and services I order) will be made:</p>
          <p className="cc">3.1.1 on the date and at the time as agreed with you, at the Company premises; or</p>
          <p className="cc">3.1.2 on another date, time and/or premises as you may advise me;</p>
          <p className="cc">3.1.3 in the event that clause 3.1.2 applies, you agree to advise me of any arrangements or changes within a reasonable period and to take the convenience of both parties into account, and I in turn agree to do the same.</p>
          <p className="c">3.2 In the event that delivery at the agreed date and time is not possible or proves difficult, you undertake to inform me timeously and to arrange delivery on the soonest possible business day thereafter.</p>
          <p className="c">3.3 Prior to taking delivery I have the right to examine the vehicle for the purpose of quality and description, without removing the vehicle from your premises or in any way altering it.</p>

          <h2>4. Warranty, Service and Maintenance Plans — If Applicable</h2>
          <p className="c">In the event that the vehicle still carries a manufacturer's warranty and/or a service plan and/or a maintenance plan, then:</p>
          <p className="c">4.1 I confirm that the sale of the goods is subject to the applicable manufacturer's warranty, service and/or maintenance plans.</p>
          <p className="c">4.2 I acknowledge that you have advised me that the vehicle may only be used according to the manufacturer's specifications.</p>
          <p className="c">4.3 I will read the manufacturer's warranty and user's manual and make myself fully aware of what must and must not be done with and to the goods — being the vehicle, the tyres and the extras — in order for the goods to function correctly and safely.</p>
          <p className="c">4.4 I will make myself familiar with my obligations in respect of the warranty, the warranty periods, the service requirements, and the terms and conditions which fall outside of the manufacturer's warranty.</p>
          <p className="c">4.5 I confirm that I have been advised that any manufacturer's warranty, service and/or maintenance plans may be void or cancelled (in whole or in part) if the terms and conditions in those documents or the owner's manual have not been complied with.</p>
          <p className="c">4.6 The warranty runs concurrently with any other statutory warranty applicable to the vehicle.</p>
          <p className="c">4.7 I acknowledge that no other warranties, undertakings or representations have been given (express or implied) other than those contained in this offer to purchase.</p>

          <h2>5. Ordering Fee</h2>
          <p className="c">If I have paid an ordering fee, you will hold this ordering fee until you accept the offer. Should you accept the offer, the ordering fee will be deducted from the balance of the purchase price. If I am in breach of this contract, or if I am entitled to cancel it, I will remain liable for any amounts that were due to you in terms of this agreement up to and including the date of cancellation. I agree that you may deduct a reasonable charge for cancellation.</p>
        </div>

        <div className="legal-sign">
          <div className="vw-sign-row">
            <div className="vw-sign">
              <div className="vw-line"><span className="vw-lbl">Client:</span><span className="vw-rule"></span></div>
              <div className="vw-name">{client.title} {client.name}</div>
            </div>
            <div className="vw-sign">
              <div className="vw-line"><span className="vw-lbl">Sales Executive:</span><span className="vw-rule"></span></div>
              <div className="vw-name">{sales.exec_name}</div>
            </div>
            <div className="vw-otp">OTP No: <b>{offer.ref}</b></div>
          </div>
        </div>
      </section>

      {/* ============================================================= PAGE 3 */}
      <section className="page">
        <div className="legal-head"><span>OTP No: <b>{offer.ref}</b></span><span>Dated: <b>{offer.date}</b></span></div>

        <div className="legal">
          <h2>6. Special Conditions Relating to Trade-Ins — If Applicable</h2>
          <div className="two-col">
            <div>
              <p className="c">6.1 I warrant that:</p>
              <p className="cc">6.1.1 the traded-in vehicle is my sole property;</p>
              <p className="cc">6.1.2 no other person has any right in or to it;</p>
              <p className="cc">6.1.3 it is not subject to any right of retention or other legal impediment;</p>
              <p className="cc">6.1.4 all defects in the trade-in vehicle have been disclosed prior to the valuation by you;</p>
              <p className="cc">6.1.5 I have disclosed all modifications on the vehicle to you;</p>
              <p className="cc">6.1.6 the vehicle has not suffered any accident damage exceeding R20 000.</p>
              <p className="c">6.2 I hereby authorise you to settle any amount owing to the financial institution, or any third party, for my traded-in vehicle.</p>
              <p className="c">6.3 I warrant that the date of first registration and/or the year of manufacture of the traded-in vehicle, together with all other information I supply in respect of the vehicle, is correct, and I agree that you based your valuation on this warranty.</p>
              <p className="c">6.4 I agree that you may, at your election, reduce the value of the vehicle traded-in if, in your opinion, it is not in the same condition as when you valued it, or if the year of manufacture and/or date of first registration or any other information I supplied is incorrect; or, in the alternative, cancel this agreement.</p>
            </div>
            <div>
              <div className="dec-box">
                <div className="dh">Trade-in declarations</div>
                <div className="dl"></div><div className="dl"></div><div className="dl"></div><div className="dl"></div><div className="dl"></div>
              </div>
            </div>
          </div>

          <h2>7. Hazardous Nature of Motor Vehicle</h2>
          <p className="c">I am aware that a motor vehicle, and its various parts, are goods that could be dangerous and hazardous, and that if used contrary to specifications and/or instructions, or if used incorrectly or inappropriately, or in a manner or for a purpose for which these goods were not designed, or if I abuse or misuse the items, then these goods could cause damage and harm.</p>

          <h2>8. Fit for Purpose</h2>
          <p className="c">8.1 If I require the vehicle for a specific purpose, I will communicate this purpose to you in writing prior to making this offer.</p>
          <p className="c">8.2 I have read all of the material made available to me by you setting out the specifications and capabilities of the vehicle, and I confirm that this vehicle appears fit for the purpose for which I am purchasing it.</p>
          <p className="c">8.3 The vehicle that I propose to purchase meets my needs in all material respects. I have had sufficient opportunity to inspect the vehicle and am satisfied that I have been made fully aware of the operating instructions and dangers inherent in its operation. I further confirm that the vehicle matches my lifestyle needs and that I have not been subject to any untoward influence by any person in the employ of {company.trading_name} to purchase the vehicle.</p>

          <h2>9. Return</h2>
          <p className="c">If I am entitled to return the vehicle to you:</p>
          <p className="cc">9.1 for any reason whatsoever and I want to cancel the sale, then I understand that by returning it and cancelling the sale, the value of this vehicle may drop. If I choose to do this, I understand that:</p>
          <p className="ccc">9.1.1 I will have to immediately pay to you the full difference between the price I paid for the vehicle and the price at which you will sell the vehicle to somebody else; and</p>
          <p className="ccc">9.1.2 I will then also be liable for all the costs that you will reasonably incur to restock the vehicle.</p>

          <h2>10. Miscellaneous Conditions</h2>
          <p className="c">10.1 If a complaint or dispute arises between us, I shall inform you in writing of the extent and nature of the complaint or dispute. The Company will attempt to resolve the matter amicably within ten (10) business days. If we are unable to resolve it within that period, either party shall be entitled to refer the matter to the accredited Motor Industry Ombudsman. This procedure does not affect our rights to approach a competent court.</p>
          <p className="c">10.2 No variation of these terms and conditions will be of any force or effect unless in writing and signed by both of us.</p>
          <p className="c">10.3 The failure of either of us to enforce any rights in terms of this offer shall not amount to a waiver of such rights.</p>
          <p className="c">10.4 I have read the terms and conditions contained in this offer and I understand and accept them in every respect.</p>
          <p className="c">10.5 If any of the terms and conditions in this agreement are found to be invalid, that will not invalidate the remainder of this agreement.</p>
          <p className="c">10.6 For the purpose of the service of any legal documents or notices in terms of this offer, we choose the addresses reflected in this schedule.</p>
        </div>

        <div className="legal-sign">
          <div className="vw-sign-row">
            <div className="vw-sign">
              <div className="vw-line"><span className="vw-lbl">Client:</span><span className="vw-rule"></span></div>
              <div className="vw-name">{client.title} {client.name}</div>
            </div>
            <div className="vw-sign">
              <div className="vw-line"><span className="vw-lbl">Sales Executive:</span><span className="vw-rule"></span></div>
              <div className="vw-name">{sales.exec_name}</div>
            </div>
            <div className="vw-otp">OTP No: <b>{offer.ref}</b></div>
          </div>
        </div>
      </section>

      {/* ============================================================= PAGE 4 */}
      <section className="page">
        <div className="legal-head"><span>OTP No: <b>{offer.ref}</b></span><span>Dated: <b>{offer.date}</b></span></div>

        <div className="legal">
          <h2>11. Vehicle Specifications (Specifically Applies to Pre-Owned Vehicles)</h2>
          <p className="c">11.1 I acknowledge that you and your representatives/employees sell a variety of motor vehicles and may not have knowledge of all of the manufacturer's specifications of the vehicle I am purchasing, and as such I will consider any recommendations made by them to be those of an ordinary person and not an expert.</p>
          <p className="c">11.2 I further confirm that I have had sufficient opportunity, on my own, to consider whether this vehicle is appropriate for my needs.</p>
          <p className="c">11.3 I acknowledge that the manufacturer's sales and promotional material containing additional information regarding the vehicle, other than the specifications contained in the owner's manual (if available), may no longer be available.</p>
          <p className="c">11.4 I particularly accept that, to the best of your knowledge, you believe the date of first registration and/or the year of manufacture to be the date stated in this document, and that the odometer reading on the vehicle is correct, but that you cannot warrant this. I accept that in certain circumstances this information may not be correct.</p>
          <p className="c">11.5 In the event that the odometer reading, year of manufacture, date of first registration or any other information used in valuing the vehicle proves inaccurate or incorrect, you will at the soonest reasonable opportunity reimburse me the difference between the vehicle value appearing on this offer and the vehicle's correct value at the time of delivery.</p>

          <div className="legal-sub" style={{ marginTop: '8px' }}>Special Acknowledgment</div>
          <p className="c">11.6 I accept that you have disclosed the following risk(s), defect(s), failure(s), hazard(s) or unsafe item(s), and that I will accept the vehicle in that condition:</p>
          <div style={{ margin: '6px 0 4px' }}>
            <p style={{ margin: '7px 0' }}>1. <span className="fill" style={{ minWidth: '74%' }}></span></p>
            <p style={{ margin: '7px 0' }}>2. <span className="fill" style={{ minWidth: '74%' }}></span></p>
            <p style={{ margin: '7px 0' }}>3. <span className="fill" style={{ minWidth: '74%' }}></span></p>
            <p style={{ margin: '7px 0' }}>4. <span className="fill" style={{ minWidth: '74%' }}></span></p>
            <p style={{ margin: '7px 0' }}>5. <span className="fill" style={{ minWidth: '74%' }}></span></p>
          </div>
          <p style={{ textAlign: 'right', marginTop: '6px' }}><span className="fill" style={{ minWidth: '160px' }}></span><br /><span style={{ fontSize: '7px', color: 'var(--grey)' }}>Customer Signature if applicable</span></p>

          <h2>12. Vehicle Specifications (Specifically Applies to New Vehicles)</h2>
          <p className="c">I confirm that you have referred me to the sales and promotional material of the manufacturer, including the specifications of the vehicle, to inform me what the vehicle is capable of, and I confirm that, based on that material, I am satisfied that the vehicle is suited for the purpose for which I have indicated to you and for which I am purchasing it.</p>

          <h2>13. Special Conditions of Sale (Specifically Applies to New Vehicles)</h2>
          <p className="c">13.1 You have advised me that the list price (the manufacturer's recommended retail price) applicable at the date of delivery may be higher than the price appearing on this offer. I have been advised that, should I opt to cancel the contract on the basis of the price difference, you may deduct a reasonable charge for cancellation.</p>
          <p className="c">13.2 I agree that the vehicle is new, notwithstanding —</p>
          <p className="cc">13.2.1 that it may have been driven under its own power (with or without the distance travelled having been recorded on the odometer) from the place of assembly to the place of delivery, for demonstration purposes, or for pre-delivery testing;</p>
          <p className="cc">13.2.2 that it may have incurred minor wear and tear in the course of the above.</p>
          <p className="c">13.3 If the vehicle is not in stock and I decide to proceed, you will give me an estimate of when delivery can take place, and I agree to take delivery whether or not delivery takes place on, before or after the estimated date, provided that it: is of the make and model set out in this offer; differs only in minor respects due to manufacturer design changes; and the delay was due to factors outside the dealership's control.</p>
        </div>

        <div className="legal-sign">
          <div className="vw-sign-row">
            <div className="vw-sign">
              <div className="vw-line"><span className="vw-lbl">Client:</span><span className="vw-rule"></span></div>
              <div className="vw-name">{client.title} {client.name}</div>
            </div>
            <div className="vw-sign">
              <div className="vw-line"><span className="vw-lbl">Sales Executive:</span><span className="vw-rule"></span></div>
              <div className="vw-name">{sales.exec_name}</div>
            </div>
            <div className="vw-otp">OTP No: <b>{offer.ref}</b></div>
          </div>
        </div>
      </section>

      {/* ============================================================= PAGE 5 */}
      <section className="page">
        <div className="legal-head"><span>OTP No: <b>{offer.ref}</b></span><span>Dated: <b>{offer.date}</b></span></div>

        <div className="legal">
          <h2>14. Data Protection Information</h2>
          <p className="c">14.1 I am aware that when I purchase a vehicle from {company.trading_name}, Makhulu Holdings (Pty) Ltd t/a {company.trading_name} processes my personal information as the Responsible Party.</p>
          <p className="c">14.2 I am aware that you do not sell my information to third parties. However, you may from time to time disclose and jointly process my personal information with your service providers, finance and insurance partners, agents and affiliates, strictly for the purpose of rendering the services I have requested.</p>
          <p className="c">14.3 I am aware that I have the right to access the personal information you hold about me and to make corrections if necessary, and the right to object to the processing of my personal information. I also have the right to withdraw any consent I have previously given and to ask you to erase or delete information you hold about me.</p>
          <p className="c">14.4 I am aware that if I am dissatisfied, I have the right to lodge a complaint with {company.trading_name} or directly with the Information Regulator.</p>
          <p className="c">14.5 I am aware that {company.trading_name} may inform me of necessary vehicle and service information related to the maintenance of my vehicle. I may withdraw consent to this processing at any time.</p>
          <p className="c">14.6 I am aware that {company.trading_name} may conduct surveys to improve its service and product offerings and may occasionally contact me to request my participation. I may withdraw consent to this processing at any time.</p>
          <p className="c">14.7 I wish to receive promotional communication (e.g. retail offers, service offers, parts specials). I may withdraw consent at any time. &nbsp; Yes <span className="fill-sm"></span> &nbsp; No <span className="fill-sm"></span></p>
          <p className="c">14.8 I wish to receive beneficial information (e.g. event invitations, newsletters). I may withdraw consent at any time. &nbsp; Yes <span className="fill-sm"></span> &nbsp; No <span className="fill-sm"></span></p>
          <p className="c">14.9 I may: refuse to accept; inform you in writing to discontinue; or register a pre-emptive block with the Registry for Direct Marketing against any direct marketing communication from you.</p>

          <h2>15. Consent to Process Personal Information (POPIA, Act 4 of 2013)</h2>
          <p className="c">15.1 I am required by law to provide you with all documentation in terms of the Financial Intelligence Centre Act, No. 38 of 2001 (FICA), and should I fail to provide the required documentation, this offer cannot proceed.</p>
          <p className="c">15.2 I authorise you to submit my particulars to the eNaTIS system for registration of the vehicle on the national database of roadworthy vehicles and licensed drivers.</p>
          <p className="c">15.3 I give my consent to {company.trading_name} to collect, process and distribute my personal information where {company.trading_name} is legally required to do so.</p>
          <p className="c">15.4 I understand my right to privacy and the right to have my personal information processed in accordance with the conditions for lawful processing.</p>
          <p className="c">15.5 I acknowledge that I understand the purposes for which my personal information is required and will be used — namely, to enable {company.trading_name} to render the required services to me.</p>
          <p className="c">15.6 I consent to {company.trading_name} sharing my personal information strictly for reporting to the relevant authorities and to render the services requested by me.</p>
          <p className="c">15.7 I understand that, should I refuse to provide the required consent and/or information, {company.trading_name} will be unable to assist me with any of the services requested.</p>
          <p className="c">15.8 I understand that all personal information I provide will be held and/or stored securely for the purpose for which it was collected.</p>
          <p className="c">15.9 I declare that all personal information supplied is accurate, up-to-date, not misleading, and complete in all respects, and I undertake to immediately advise {company.trading_name} of any changes.</p>
        </div>

        <div className="ack-bar">
          By my signature hereto, I acknowledge that {company.trading_name} is required to submit my particulars to the eNaTIS system for registration of the vehicle on the national database of roadworthy vehicles and licensed drivers, and I authorise this submission to the extent required.
        </div>
        <div className="consent-line">I would like to receive promotional emails such as retail and service offers and specials from {company.trading_name}: &nbsp; Yes <span className="fill-sm"></span> &nbsp; No <span className="fill-sm"></span></div>
        <div className="consent-line">I would like to receive beneficial information such as event invitations and newsletters: &nbsp; Yes <span className="fill-sm"></span> &nbsp; No <span className="fill-sm"></span></div>
        <div className="consent-line" style={{ color: 'var(--grey)' }}>You are free to withdraw your consent to the above communications by unsubscribing at any time. By signing this document I acknowledge that it was fully completed with the information you are allowed to use.</div>

        <div className="final-sign">
          Sales Manager / DP: <span className="fill" style={{ minWidth: '200px' }}></span> &nbsp; Place: <span className="fill" style={{ minWidth: '120px' }}></span> &nbsp; Date: <span className="fill" style={{ minWidth: '120px' }}></span><br /><br />
          Signed at <span className="fill" style={{ minWidth: '150px' }}></span> on <span className="fill" style={{ minWidth: '120px' }}></span>
          <br /><br />
          <table style={{ width: '100%', fontSize: '7.8px', marginTop: '6px' }}>
            <tbody>
              <tr>
                <td style={{ borderTop: '1px solid var(--ink)', paddingTop: '4px', width: '45%' }}>{client.title} {client.name}<br /><span style={{ color: 'var(--grey)', fontSize: '7px' }}>Purchaser Signature &amp; Date</span></td>
                <td style={{ width: '10%' }}></td>
                <td style={{ borderTop: '1px solid var(--ink)', paddingTop: '4px', width: '45%' }}>{sales.exec_name}<br /><span style={{ color: 'var(--grey)', fontSize: '7px' }}>Sales Executive Signature &amp; Date</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="contact-grid">
          <div className="contact-box">
            <div className="ch">Information Regulator</div>
            Physical: JD House, 27 Stiemens Street, Braamfontein, Johannesburg, 2001<br />
            Postal: P.O. Box 31533, Braamfontein, Johannesburg, 2017<br />
            Complaints: complaints.IR@justice.gov.za<br />
            Enquiries: inforeg@justice.gov.za
          </div>
          <div className="contact-box">
            <div className="ch">Motor Industry Ombudsman (MIOSA)</div>
            Physical: Meiring Naudé Rd, Scientia 627-Jr, Pretoria, 0184<br />
            How to complain: www.miosa.co.za/how-to-complain.php<br />
            Complaints: info@miosa.co.za<br />
            Enquiries: info@miosa.co.za
          </div>
        </div>

        <div className="internal-box">
          <span className="ih">For internal use only — Privacy data loaded.</span><br />
          By <span className="fill" style={{ minWidth: '150px' }}></span> &nbsp; Date <span className="fill" style={{ minWidth: '120px' }}></span> &nbsp; Sign <span className="fill" style={{ minWidth: '150px' }}></span>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '12px', textAlign: 'center', fontSize: '7px', color: 'var(--grey)', borderTop: '1px solid var(--line-soft)' }}>
          Makhulu Holdings (Pty) Ltd t/a {company.trading_name} &bull; Offer to Purchase &bull; {offer.ref}
        </div>
      </section>

    </div>
  );
}
