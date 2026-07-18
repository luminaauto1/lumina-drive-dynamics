/* eslint-disable react/no-unescaped-entities */
// Real-text (vector) rendering of the designed 5-sheet OTP — a 1:1 port of
// OtpDocument.tsx + OtpDocument.css into @react-pdf/renderer primitives.
// Owner 2026-07-18: the html-to-image raster pipeline made the fonts look
// fuzzy; the reference is the Chromium PRINT output (Lumina-Auto-OTP-Sample
// .pdf) — crisp embedded Montserrat, ~130KB. This module reproduces that
// exact look with a direct download and real pagination (a sheet that grows
// past A4 flows onto a clean continuation page; signature blocks never split).
//
// Keep this file in lockstep with OtpDocument.tsx — same sections, same
// wording, same order. The px()/track() helpers carry the CSS values across
// verbatim so a style tweak in the CSS has one obvious mirror here.
import { Fragment, type ReactNode } from 'react';
import { Document, Page, View, Text } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { OtpData } from '../types';
import { calcOtp } from '../calc';
import { fmtZAR } from '../format';
import { px, mm, track, INK, OBSIDIAN, GREY, LINE, LINE_SOFT, PAPER, BAND } from './theme';

/* ----------------------------------------------------------- shared styles */
const page: Style = {
  fontFamily: 'Montserrat',
  fontWeight: 400,
  backgroundColor: PAPER,
  color: INK,
  paddingTop: mm(16),
  paddingHorizontal: mm(15),
  paddingBottom: mm(14),
  display: 'flex',
  flexDirection: 'column',
};

const panel: Style = { borderWidth: px(1), borderColor: LINE, borderStyle: 'solid' };
const panelHead: Style = {
  backgroundColor: BAND, color: '#FFFFFF', fontSize: px(9), fontWeight: 700,
  letterSpacing: track(9, 0.16), textTransform: 'uppercase',
  paddingVertical: px(6), paddingHorizontal: px(10),
};

const specRow: Style = { flexDirection: 'row', borderBottomWidth: px(1), borderBottomColor: LINE_SOFT, borderBottomStyle: 'solid' };
const specCell: Style = { paddingVertical: px(4), paddingHorizontal: px(10), fontSize: px(8.7) };
const specK: Style = { ...specCell, color: GREY, fontWeight: 500, width: '34%' };
// The CSS table auto-layout gives the first value column more room than the
// second ("Polo Vivo 1.4 5dr" stays on one line in the reference print).
const specV: Style = { ...specCell, fontWeight: 600, color: INK, flex: 1.5 };
const specV2: Style = { ...specCell, fontWeight: 600, color: INK, flex: 1 };
const specK2: Style = { ...specCell, color: GREY, fontWeight: 500, width: '22%' };

const priceRow: Style = {
  flexDirection: 'row', justifyContent: 'space-between', fontSize: px(8.7),
  paddingVertical: px(5), paddingHorizontal: px(10),
  borderBottomWidth: px(1), borderBottomColor: LINE_SOFT, borderBottomStyle: 'solid',
};

const legalText: Style = { fontSize: px(7.7), lineHeight: 1.5, color: '#222222' };
const h2: Style = { fontSize: px(8.4), fontWeight: 700, letterSpacing: track(8.4, 0.04), marginTop: px(9), marginBottom: px(3), color: INK };

/* ------------------------------------------------------- small primitives */

/** Underlined fill-in blank that sits on the text baseline (the CSS `.fill`). */
const Fill = ({ w }: { w: number }) => (
  <View style={{ minWidth: px(w), borderBottomWidth: px(1), borderBottomColor: '#AAAAAA', borderBottomStyle: 'solid', height: px(9), flexGrow: 0 }} />
);

/** Inline underlined blank inside a sentence (the CSS `.fill-sm`) — an
 *  underlined run of NBSPs, the only inline-block react-pdf allows in Text. */
const U = ({ n = 10 }: { n?: number }) => (
  <Text style={{ textDecoration: 'underline' }}>{' '.repeat(n)}</Text>
);

/** Numbered legal clause with the CSS hanging indent (`.c`/`.cc`/`.ccc`):
 *  the number owns the first `numW` px and wrapped lines align with the body. */
const Cl = ({ n, indent = 0, numW = 14, children }: { n: string; indent?: number; numW?: number; children: ReactNode }) => (
  <View style={{ flexDirection: 'row', marginLeft: px(indent), marginVertical: px(1.5) }}>
    <Text style={{ ...legalText, minWidth: px(numW) }}>{n}</Text>
    <Text style={{ ...legalText, flex: 1 }}>{children}</Text>
  </View>
);

/** Un-numbered legal paragraph. */
const P = ({ children, style }: { children: ReactNode; style?: Style }) => (
  <Text style={{ ...legalText, marginVertical: px(1.5), ...style }}>{children}</Text>
);

/** VW-style signature line: "Label: · · · ·" with the name centred beneath. */
const SignCol = ({ label, name, fs }: { label: string; name?: string; fs: number }) => (
  <View style={{ flex: 1 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <Text style={{ fontSize: px(fs), color: INK }}>{label}</Text>
      <View style={{ flex: 1, marginLeft: px(6), marginBottom: px(2), borderBottomWidth: px(1), borderBottomColor: '#6A6A6C', borderBottomStyle: 'dotted', height: px(1) }} />
    </View>
    {name !== undefined && (
      <Text style={{ fontSize: px(fs), fontWeight: 600, textAlign: 'center', marginTop: px(4) }}>{name}</Text>
    )}
  </View>
);

const SignRow = ({ client, exec, otpRef, fs }: { client: string; exec: string; otpRef?: string; fs: number }) => (
  <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
    <SignCol label="Client:" name={client} fs={fs} />
    <View style={{ width: px(30) }} />
    <SignCol label="Sales Executive:" name={exec} fs={fs} />
    <View style={{ width: px(30) }} />
    <Text style={{ width: px(120), fontSize: px(fs), color: GREY, textAlign: 'right' }}>
      {otpRef !== undefined ? <>OTP No: <Text style={{ color: INK, fontWeight: 700 }}>{otpRef}</Text></> : ' '}
    </Text>
  </View>
);

/** Grey page header on the legal sheets. */
const LegalHead = ({ otpRef, date }: { otpRef: string; date: string }) => (
  <View style={{
    flexDirection: 'row', justifyContent: 'space-between',
    borderBottomWidth: px(1), borderBottomColor: LINE, borderBottomStyle: 'solid',
    paddingBottom: px(5), marginBottom: px(3),
  }}>
    <Text style={{ fontSize: px(7.5), color: GREY, letterSpacing: track(7.5, 0.04) }}>
      OTP No: <Text style={{ color: INK, fontWeight: 700 }}>{otpRef}</Text>
    </Text>
    <Text style={{ fontSize: px(7.5), color: GREY, letterSpacing: track(7.5, 0.04) }}>
      Dated: <Text style={{ color: INK, fontWeight: 700 }}>{date}</Text>
    </Text>
  </View>
);

const LegalSign = ({ client, exec, otpRef }: { client: string; exec: string; otpRef: string }) => (
  <View wrap={false} style={{ marginTop: px(16), paddingTop: px(10), borderTopWidth: px(1), borderTopColor: LINE, borderTopStyle: 'solid' }}>
    <SignRow client={client} exec={exec} otpRef={otpRef} fs={7.6} />
  </View>
);

/* ------------------------------------------------------------ the document */
export function OtpPdfDocument({ data }: { data: OtpData }) {
  const calc = calcOtp(data);
  const { company, offer, client, sales, vehicle, finance, financials, lines } = data;

  const totalIncl = fmtZAR(calc.totalIncl);
  const balanceLabel = calc.vatRegistered ? 'Balance Payable (incl. VAT)' : 'Balance Payable';
  const totalLabel = calc.vatRegistered ? 'Total Price (incl. VAT)' : 'Total Price';
  const clientFull = `${client.title} ${client.name}`.trim();
  const execFull = `${sales.exec_name} ${sales.exec_phone}`.trim();

  const kv = (lbl: string, val: string) => (
    <View style={{ flexDirection: 'row', marginBottom: px(1.5) }}>
      <Text style={{ fontSize: px(9), lineHeight: 1.55, color: GREY, fontWeight: 500, letterSpacing: track(9, 0.03), width: px(74) }}>{lbl}</Text>
      <Text style={{ fontSize: px(9), lineHeight: 1.55, fontWeight: 600, flex: 1 }}>{val}</Text>
    </View>
  );

  const spec4 = (k1: string, v1: string, k2: string, v2: string, last?: boolean) => (
    <View style={{ ...specRow, ...(last ? { borderBottomWidth: 0 } : null) }}>
      <Text style={specK}>{k1}</Text>
      <Text style={specV}>{v1 || ' '}</Text>
      <Text style={specK2}>{k2}</Text>
      <Text style={specV2}>{v2 || ' '}</Text>
    </View>
  );

  const spec2 = (k1: string, v1: string, last?: boolean) => (
    <View style={{ ...specRow, ...(last ? { borderBottomWidth: 0 } : null) }}>
      <Text style={specK}>{k1}</Text>
      <Text style={specV}>{v1 || ' '}</Text>
    </View>
  );

  const priceLine = (lbl: string, amt: string) => (
    <View style={priceRow}>
      <Text style={{ color: GREY }}>{lbl}</Text>
      <Text style={{ fontWeight: 600 }}>{amt}</Text>
    </View>
  );

  const financeRows: Array<[string, string]> = [
    ['Finance Method', finance.method],
    ['Financed By', finance.financed_by],
    ['Bank / Branch', finance.bank_branch],
    ['Branch Phone', finance.branch_phone],
    ['Branch Contact', finance.branch_contact],
    // Empty bank rows are dropped — a Cash deal must not print blank labels.
  ].filter((r, i) => i === 0 || r[1].trim() !== '') as Array<[string, string]>;

  const extrasItems = (financials.extras_items ?? []).filter((it) => it.description.trim() || Number(it.amount));

  return (
    <Document title={`Lumina Auto — Offer to Purchase ${offer.ref}`} author={company.trading_name}>

      {/* ============================================================ PAGE 1 */}
      <Page size="A4" style={page}>

        {/* masthead — full bleed over the page padding */}
        <View style={{
          backgroundColor: OBSIDIAN, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingVertical: px(14), paddingHorizontal: px(20),
          marginTop: -mm(16), marginHorizontal: -mm(15),
        }}>
          <View>
            <Text style={{ color: '#FFFFFF', fontWeight: 800, fontSize: px(25), letterSpacing: track(25, 0.34), paddingLeft: track(25, 0.34) }}>LUMINA</Text>
            <Text style={{ color: '#CFCFD1', fontWeight: 500, fontSize: px(9), letterSpacing: track(9, 0.62), textAlign: 'right', alignSelf: 'stretch', marginTop: px(3) }}>AUTO</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#FFFFFF', fontWeight: 700, fontSize: px(10), letterSpacing: track(10, 0.04), lineHeight: 1.5 }}>{company.legal_name}</Text>
            <Text style={{ color: '#D6D6D8', fontSize: px(8.5), lineHeight: 1.5 }}>t/a {company.trading_name}</Text>
            <Text style={{ color: '#D6D6D8', fontSize: px(8.5), lineHeight: 1.5 }}>{company.address}</Text>
            <Text style={{ color: '#D6D6D8', fontSize: px(8.5), lineHeight: 1.5 }}>{company.email} • {company.phone}</Text>
            <Text style={{ color: '#D6D6D8', fontSize: px(8.5), lineHeight: 1.5 }}>Reg: {company.reg_no}   VAT: {company.vat_no}</Text>
          </View>
        </View>

        {/* title row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: px(18), marginBottom: px(6) }}>
          <View style={{ flex: 1, height: px(1), backgroundColor: INK }} />
          <Text style={{ fontWeight: 700, fontSize: px(17), letterSpacing: track(17, 0.32), marginHorizontal: px(14) }}>OFFER TO PURCHASE</Text>
          <View style={{ flex: 1, height: px(1), backgroundColor: INK }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: px(14) }}>
          <Text style={{ fontSize: px(9), color: GREY, letterSpacing: track(9, 0.05) }}>
            Quote Ref: <Text style={{ color: INK, fontWeight: 600 }}>{offer.ref}</Text>
          </Text>
          <Text style={{ fontSize: px(9), color: GREY, letterSpacing: track(9, 0.05) }}>
            Date: <Text style={{ color: INK, fontWeight: 600 }}>{offer.date}</Text>  |  Valid Until: <Text style={{ color: INK, fontWeight: 600 }}>{offer.valid_until}</Text>
          </Text>
        </View>

        {/* intro grid */}
        <View style={{ flexDirection: 'row', marginBottom: px(12) }}>
          <View style={{ flex: 1.15, marginRight: px(22) }}>
            <Text style={{ fontSize: px(8), fontWeight: 700, letterSpacing: track(8, 0.18), textTransform: 'uppercase', color: GREY, borderBottomWidth: px(1), borderBottomColor: LINE, borderBottomStyle: 'solid', paddingBottom: px(4), marginBottom: px(6) }}>Contact Information</Text>
            {kv('Name', clientFull)}
            {kv('ID', client.id)}
            {kv('Address', client.address)}
            {kv('Postal', client.postal)}
            {kv('Email', client.email)}
            {kv('Cell', client.cell)}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: px(8), fontWeight: 700, letterSpacing: track(8, 0.18), textTransform: 'uppercase', color: GREY, borderBottomWidth: px(1), borderBottomColor: LINE, borderBottomStyle: 'solid', paddingBottom: px(4), marginBottom: px(6) }}>Offer Details</Text>
            {kv('From', execFull)}
            {kv('Re', `Quote ${offer.ref} — ${vehicle.make} ${vehicle.model}`)}
            {kv('Date', offer.date)}
            {kv('Valid Until', offer.valid_until)}
          </View>
        </View>

        {/* greeting */}
        <View style={{ marginTop: px(6), marginBottom: px(16) }}>
          <Text style={{ fontSize: px(9), lineHeight: 1.6, fontWeight: 600, marginBottom: px(5) }}>Dear {clientFull},</Text>
          <Text style={{ fontSize: px(9), lineHeight: 1.6 }}>
            Thank you for your enquiry. As per your request, it gives us great pleasure to submit the following
            offer to purchase, prepared according to your individual requirements. This document, once accepted in
            writing by an authorised manager of {company.trading_name}, constitutes a binding agreement subject to the
            Conditions of Offer set out herein.
          </Text>
        </View>

        {/* deal grid */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>

          {/* LEFT: vehicle + finance + notes */}
          <View style={{ flex: 1.25, marginRight: px(14) }}>
            <View style={panel}>
              <Text style={panelHead}>Vehicle Details</Text>
              {spec4('Make', vehicle.make, 'Year', vehicle.year)}
              {spec4('Model', vehicle.model, 'Order Type', vehicle.order_type)}
              {spec4('Reg No.', vehicle.reg_no, 'Mileage', vehicle.mileage)}
              {spec4('Colour', vehicle.colour, 'Trim', vehicle.trim)}
              {spec4('VIN No.', vehicle.vin, 'Engine No.', vehicle.engine_no)}
              {spec4('Stock No.', vehicle.stock_no, 'M&M Code', vehicle.mm_code, true)}
            </View>

            <View style={{ ...panel, marginTop: px(10) }}>
              <Text style={panelHead}>Vehicle Finance Details</Text>
              {financeRows.map(([k, v], i) => <Fragment key={k}>{spec2(k, v, i === financeRows.length - 1)}</Fragment>)}
            </View>

            <View style={{ ...panel, marginTop: px(10) }}>
              <Text style={panelHead}>Notes</Text>
              <Text style={{ fontSize: px(8.5), lineHeight: 1.5, color: INK, paddingVertical: px(8), paddingHorizontal: px(10), minHeight: px(34) }}>{data.notes || ' '}</Text>
            </View>
          </View>

          {/* RIGHT: price + summary + balance */}
          <View style={{ flex: 1 }}>
            <View style={panel}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: BAND, paddingVertical: px(7), paddingHorizontal: px(10) }}>
                <Text style={{ color: '#FFFFFF', fontSize: px(10), fontWeight: 700, letterSpacing: track(10, 0.05) }}>Vehicle Price</Text>
                <Text style={{ color: '#FFFFFF', fontSize: px(10), fontWeight: 700, letterSpacing: track(10, 0.05) }}>{totalIncl}</Text>
              </View>
              {priceLine('Base Vehicle Price', fmtZAR(financials.base_price))}
              {lines.extras && ((financials.extras_items?.length ?? 0) > 0
                ? extrasItems.map((it, i) => <Fragment key={i}>{priceLine(it.description.trim() || 'Extras', fmtZAR(Number(it.amount) || 0))}</Fragment>)
                : priceLine('Extras', fmtZAR(financials.extras)))}
              {lines.vap && priceLine('Value Added Products', fmtZAR(financials.vap))}
              {lines.admin_fee && priceLine('Administration Fee', fmtZAR(financials.admin_fee))}
              {lines.delivery_fee && priceLine('Delivery Fee', fmtZAR(financials.delivery_fee))}
              {lines.licensing && priceLine(`Licensing & Registration${calc.novatTag}`, fmtZAR(financials.licensing))}
            </View>

            <View style={{ ...panel, marginTop: px(10) }}>
              <Text style={panelHead}>Summary</Text>
              {calc.vatRegistered && (
                <View style={{ ...priceRow, fontWeight: 700 }}>
                  <Text style={{ fontWeight: 700 }}>Subtotal (excl. VAT)</Text>
                  <Text style={{ fontWeight: 700 }}>{fmtZAR(calc.subtotalExcl!)}</Text>
                </View>
              )}
              {priceLine('VAT', calc.vatRegistered ? fmtZAR(calc.vat!) : 'n/a')}
              <View style={{ ...priceRow, borderTopWidth: px(2), borderTopColor: INK, borderTopStyle: 'solid' }}>
                <Text style={{ fontWeight: 700 }}>{totalLabel}</Text>
                <Text style={{ fontWeight: 700 }}>{totalIncl}</Text>
              </View>
              {priceLine('Less: Deposit', `- ${fmtZAR(calc.deposit)}`)}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: OBSIDIAN, paddingVertical: px(11), paddingHorizontal: px(10), marginTop: px(10) }}>
              <Text style={{ color: '#FFFFFF', fontWeight: 700, fontSize: px(12), letterSpacing: track(12, 0.04) }}>{balanceLabel}</Text>
              <Text style={{ color: '#FFFFFF', fontWeight: 700, fontSize: px(12), letterSpacing: track(12, 0.04) }}>{fmtZAR(calc.balance)}</Text>
            </View>
            {calc.vatNote !== '' && (
              <Text style={{ fontSize: px(7), color: GREY, textAlign: 'right', paddingTop: px(5), paddingHorizontal: px(2), lineHeight: 1.4 }}>{calc.vatNote}</Text>
            )}
          </View>
        </View>

        {/* signature block */}
        <View wrap={false} style={{ marginTop: px(26) }}>
          <SignRow client={clientFull} exec={execFull} otpRef={offer.ref} fs={8.5} />
          <View style={{ marginTop: px(24) }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <SignCol label="Place:" fs={8.5} />
              <View style={{ width: px(30) }} />
              <SignCol label="Date:" fs={8.5} />
              <View style={{ width: px(30) }} />
              <View style={{ width: px(120) }} />
            </View>
          </View>
        </View>

        {/* service footnote — pinned to the bottom of the sheet */}
        <View wrap={false} style={{ marginTop: 'auto', paddingTop: px(14), borderTopWidth: px(1), borderTopColor: LINE_SOFT, borderTopStyle: 'solid' }}>
          <Text style={{ fontSize: px(7.6), lineHeight: 1.55, color: GREY }}>
            <Text style={{ color: INK, fontWeight: 600 }}>{company.trading_name}</Text> offers a comprehensive suite of services to ensure a seamless buying experience:
          </Text>
          {[
            'Vehicle finance applications, negotiation and processing at all major banks.',
            'Vehicle insurance, extended warranty, service and maintenance plans.',
            'Risk products such as credit cover and tyre warranty.',
            'Value added accessories: tracker, smash & grab, paint protection and more.',
          ].map((li, i) => (
            <View key={i} style={{ flexDirection: 'row', marginTop: i === 0 ? px(4) : 0 }}>
              <Text style={{ fontSize: px(7.6), lineHeight: 1.55, color: GREY, width: px(10) }}>–</Text>
              <Text style={{ fontSize: px(7.6), lineHeight: 1.55, color: GREY, flex: 1 }}>{li}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* ============================================================ PAGE 2 */}
      <Page size="A4" style={page}>
        <LegalHead otpRef={offer.ref} date={offer.date} />
        <Text style={{ fontSize: px(9), fontWeight: 700, letterSpacing: track(9, 0.1), textTransform: 'uppercase', marginTop: px(8), marginBottom: px(2) }}>Conditions of Offer — All Vehicle Sales</Text>
        <Text style={{ fontSize: px(7.5), fontWeight: 600, letterSpacing: track(7.5, 0.08), textTransform: 'uppercase', color: GREY, marginBottom: px(8) }}>Please refer to special conditions for new / pre-owned</Text>

        <View>
          <Text style={h2}>1. Definitions</Text>
          <Cl n="1.1">"I", "me" and "my" refer to the Purchaser; "you", "they" and "Company" refer to Makhulu Holdings (Pty) Ltd t/a {company.trading_name}, which is the Seller; and "us" or "we" refer to the Company and me jointly.</Cl>
          <Cl n="1.2">"Offer" means this offer to purchase that I have made to the Company on the terms and conditions contained in this document. Once the Company has accepted this offer, I acknowledge that it will become a binding contract between us.</Cl>
          <Cl n="1.3">"Risk" refers to the possibility of suffering harm or loss of a physical or financial nature, and the responsibility for the harm or loss suffered.</Cl>

          <Text style={h2}>2. General Conditions of Offer</Text>
          <Cl n="2.1">I acknowledge and agree that you will not be obliged to make the vehicle available or deliver it to me until a duly authorised manager on behalf of the Company accepts this offer in writing.</Cl>
          <Cl n="2.2">If you accept this offer, I acknowledge and agree that:</Cl>
          <Cl n="2.2.1" indent={14} numW={18}>I will be liable for, and agree to pay against delivery of the vehicle, the balance of the purchase price, which includes, amongst others, those additional items calculated on the vehicle price as contained in this offer;</Cl>
          <Cl n="2.2.2" indent={14} numW={18}>risk in the vehicle shall pass to me on delivery;</Cl>
          <Cl n="2.2.3" indent={14} numW={18}>you will continue to own the vehicle until I have paid all monies outstanding;</Cl>
          <Cl n="2.2.4" indent={14} numW={18}>I have had a proper opportunity to consider the implications of this offer, which is made of my own free will.</Cl>
          <Cl n="2.3">The offer will lapse if I am not able to provide satisfactory proof of my ability to pay for the vehicle, or written approval or guarantee of financing of the vehicle by a registered credit provider, within fourteen (14) days of the date of this offer or any extension given by you.</Cl>

          <Text style={h2}>3. Delivery</Text>
          <Cl n="3.1">I accept and agree that delivery of the vehicle (plus any additional items and services I order) will be made:</Cl>
          <Cl n="3.1.1" indent={14} numW={18}>on the date and at the time as agreed with you, at the Company premises; or</Cl>
          <Cl n="3.1.2" indent={14} numW={18}>on another date, time and/or premises as you may advise me;</Cl>
          <Cl n="3.1.3" indent={14} numW={18}>in the event that clause 3.1.2 applies, you agree to advise me of any arrangements or changes within a reasonable period and to take the convenience of both parties into account, and I in turn agree to do the same.</Cl>
          <Cl n="3.2">In the event that delivery at the agreed date and time is not possible or proves difficult, you undertake to inform me timeously and to arrange delivery on the soonest possible business day thereafter.</Cl>
          <Cl n="3.3">Prior to taking delivery I have the right to examine the vehicle for the purpose of quality and description, without removing the vehicle from your premises or in any way altering it.</Cl>

          <Text style={h2}>4. Warranty, Service and Maintenance Plans — If Applicable</Text>
          <P>In the event that the vehicle still carries a manufacturer's warranty and/or a service plan and/or a maintenance plan, then:</P>
          <Cl n="4.1">I confirm that the sale of the goods is subject to the applicable manufacturer's warranty, service and/or maintenance plans.</Cl>
          <Cl n="4.2">I acknowledge that you have advised me that the vehicle may only be used according to the manufacturer's specifications.</Cl>
          <Cl n="4.3">I will read the manufacturer's warranty and user's manual and make myself fully aware of what must and must not be done with and to the goods — being the vehicle, the tyres and the extras — in order for the goods to function correctly and safely.</Cl>
          <Cl n="4.4">I will make myself familiar with my obligations in respect of the warranty, the warranty periods, the service requirements, and the terms and conditions which fall outside of the manufacturer's warranty.</Cl>
          <Cl n="4.5">I confirm that I have been advised that any manufacturer's warranty, service and/or maintenance plans may be void or cancelled (in whole or in part) if the terms and conditions in those documents or the owner's manual have not been complied with.</Cl>
          <Cl n="4.6">The warranty runs concurrently with any other statutory warranty applicable to the vehicle.</Cl>
          <Cl n="4.7">I acknowledge that no other warranties, undertakings or representations have been given (express or implied) other than those contained in this offer to purchase.</Cl>

          <Text style={h2}>5. Ordering Fee</Text>
          <P>If I have paid an ordering fee, you will hold this ordering fee until you accept the offer. Should you accept the offer, the ordering fee will be deducted from the balance of the purchase price. If I am in breach of this contract, or if I am entitled to cancel it, I will remain liable for any amounts that were due to you in terms of this agreement up to and including the date of cancellation. I agree that you may deduct a reasonable charge for cancellation.</P>
        </View>

        <LegalSign client={clientFull} exec={sales.exec_name} otpRef={offer.ref} />
      </Page>

      {/* ============================================================ PAGE 3 */}
      <Page size="A4" style={page}>
        <LegalHead otpRef={offer.ref} date={offer.date} />

        <View>
          <Text style={h2}>6. Special Conditions Relating to Trade-Ins — If Applicable</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: px(20) }}>
              <Cl n="6.1">I warrant that:</Cl>
              <Cl n="6.1.1" indent={14} numW={18}>the traded-in vehicle is my sole property;</Cl>
              <Cl n="6.1.2" indent={14} numW={18}>no other person has any right in or to it;</Cl>
              <Cl n="6.1.3" indent={14} numW={18}>it is not subject to any right of retention or other legal impediment;</Cl>
              <Cl n="6.1.4" indent={14} numW={18}>all defects in the trade-in vehicle have been disclosed prior to the valuation by you;</Cl>
              <Cl n="6.1.5" indent={14} numW={18}>I have disclosed all modifications on the vehicle to you;</Cl>
              <Cl n="6.1.6" indent={14} numW={18}>the vehicle has not suffered any accident damage exceeding R20 000.</Cl>
              <Cl n="6.2">I hereby authorise you to settle any amount owing to the financial institution, or any third party, for my traded-in vehicle.</Cl>
              <Cl n="6.3">I warrant that the date of first registration and/or the year of manufacture of the traded-in vehicle, together with all other information I supply in respect of the vehicle, is correct, and I agree that you based your valuation on this warranty.</Cl>
              <Cl n="6.4">I agree that you may, at your election, reduce the value of the vehicle traded-in if, in your opinion, it is not in the same condition as when you valued it, or if the year of manufacture and/or date of first registration or any other information I supplied is incorrect; or, in the alternative, cancel this agreement.</Cl>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ borderWidth: px(1), borderColor: LINE, borderStyle: 'solid' }}>
                <Text style={{ fontSize: px(7.6), fontWeight: 700, paddingVertical: px(5), paddingHorizontal: px(8), borderBottomWidth: px(1), borderBottomColor: LINE, borderBottomStyle: 'solid' }}>Trade-in declarations</Text>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={{ height: px(15), borderBottomWidth: px(1), borderBottomColor: LINE_SOFT, borderBottomStyle: 'solid' }} />
                ))}
                <View style={{ height: px(15) }} />
              </View>
            </View>
          </View>

          <Text style={h2}>7. Hazardous Nature of Motor Vehicle</Text>
          <P>I am aware that a motor vehicle, and its various parts, are goods that could be dangerous and hazardous, and that if used contrary to specifications and/or instructions, or if used incorrectly or inappropriately, or in a manner or for a purpose for which these goods were not designed, or if I abuse or misuse the items, then these goods could cause damage and harm.</P>

          <Text style={h2}>8. Fit for Purpose</Text>
          <Cl n="8.1">If I require the vehicle for a specific purpose, I will communicate this purpose to you in writing prior to making this offer.</Cl>
          <Cl n="8.2">I have read all of the material made available to me by you setting out the specifications and capabilities of the vehicle, and I confirm that this vehicle appears fit for the purpose for which I am purchasing it.</Cl>
          <Cl n="8.3">The vehicle that I propose to purchase meets my needs in all material respects. I have had sufficient opportunity to inspect the vehicle and am satisfied that I have been made fully aware of the operating instructions and dangers inherent in its operation. I further confirm that the vehicle matches my lifestyle needs and that I have not been subject to any untoward influence by any person in the employ of {company.trading_name} to purchase the vehicle.</Cl>

          <Text style={h2}>9. Return</Text>
          <P>If I am entitled to return the vehicle to you:</P>
          <Cl n="9.1" indent={14} numW={14}>for any reason whatsoever and I want to cancel the sale, then I understand that by returning it and cancelling the sale, the value of this vehicle may drop. If I choose to do this, I understand that:</Cl>
          <Cl n="9.1.1" indent={26} numW={18}>I will have to immediately pay to you the full difference between the price I paid for the vehicle and the price at which you will sell the vehicle to somebody else; and</Cl>
          <Cl n="9.1.2" indent={26} numW={18}>I will then also be liable for all the costs that you will reasonably incur to restock the vehicle.</Cl>

          <Text style={h2}>10. Miscellaneous Conditions</Text>
          <Cl n="10.1" numW={18}>If a complaint or dispute arises between us, I shall inform you in writing of the extent and nature of the complaint or dispute. The Company will attempt to resolve the matter amicably within ten (10) business days. If we are unable to resolve it within that period, either party shall be entitled to refer the matter to the accredited Motor Industry Ombudsman. This procedure does not affect our rights to approach a competent court.</Cl>
          <Cl n="10.2" numW={18}>No variation of these terms and conditions will be of any force or effect unless in writing and signed by both of us.</Cl>
          <Cl n="10.3" numW={18}>The failure of either of us to enforce any rights in terms of this offer shall not amount to a waiver of such rights.</Cl>
          <Cl n="10.4" numW={18}>I have read the terms and conditions contained in this offer and I understand and accept them in every respect.</Cl>
          <Cl n="10.5" numW={18}>If any of the terms and conditions in this agreement are found to be invalid, that will not invalidate the remainder of this agreement.</Cl>
          <Cl n="10.6" numW={18}>For the purpose of the service of any legal documents or notices in terms of this offer, we choose the addresses reflected in this schedule.</Cl>
        </View>

        <LegalSign client={clientFull} exec={sales.exec_name} otpRef={offer.ref} />
      </Page>

      {/* ============================================================ PAGE 4 */}
      <Page size="A4" style={page}>
        <LegalHead otpRef={offer.ref} date={offer.date} />

        <View>
          <Text style={h2}>11. Vehicle Specifications (Specifically Applies to Pre-Owned Vehicles)</Text>
          <Cl n="11.1" numW={18}>I acknowledge that you and your representatives/employees sell a variety of motor vehicles and may not have knowledge of all of the manufacturer's specifications of the vehicle I am purchasing, and as such I will consider any recommendations made by them to be those of an ordinary person and not an expert.</Cl>
          <Cl n="11.2" numW={18}>I further confirm that I have had sufficient opportunity, on my own, to consider whether this vehicle is appropriate for my needs.</Cl>
          <Cl n="11.3" numW={18}>I acknowledge that the manufacturer's sales and promotional material containing additional information regarding the vehicle, other than the specifications contained in the owner's manual (if available), may no longer be available.</Cl>
          <Cl n="11.4" numW={18}>I particularly accept that, to the best of your knowledge, you believe the date of first registration and/or the year of manufacture to be the date stated in this document, and that the odometer reading on the vehicle is correct, but that you cannot warrant this. I accept that in certain circumstances this information may not be correct.</Cl>
          <Cl n="11.5" numW={18}>In the event that the odometer reading, year of manufacture, date of first registration or any other information used in valuing the vehicle proves inaccurate or incorrect, you will at the soonest reasonable opportunity reimburse me the difference between the vehicle value appearing on this offer and the vehicle's correct value at the time of delivery.</Cl>

          <Text style={{ fontSize: px(7.5), fontWeight: 600, letterSpacing: track(7.5, 0.08), textTransform: 'uppercase', color: GREY, marginTop: px(8), marginBottom: px(2) }}>Special Acknowledgment</Text>
          <Cl n="11.6" numW={18}>I accept that you have disclosed the following risk(s), defect(s), failure(s), hazard(s) or unsafe item(s), and that I will accept the vehicle in that condition:</Cl>
          <View style={{ marginTop: px(6), marginBottom: px(4) }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <View key={n} style={{ flexDirection: 'row', alignItems: 'flex-end', marginVertical: px(7) }}>
                <Text style={{ ...legalText }}>{n}. </Text>
                <View style={{ width: '74%', borderBottomWidth: px(1), borderBottomColor: '#AAAAAA', borderBottomStyle: 'solid', height: px(9) }} />
              </View>
            ))}
          </View>
          <View style={{ alignItems: 'flex-end', marginTop: px(6) }}>
            <Fill w={160} />
            <Text style={{ fontSize: px(7), color: GREY, marginTop: px(2) }}>Customer Signature if applicable</Text>
          </View>

          <Text style={h2}>12. Vehicle Specifications (Specifically Applies to New Vehicles)</Text>
          <P>I confirm that you have referred me to the sales and promotional material of the manufacturer, including the specifications of the vehicle, to inform me what the vehicle is capable of, and I confirm that, based on that material, I am satisfied that the vehicle is suited for the purpose for which I have indicated to you and for which I am purchasing it.</P>

          <Text style={h2}>13. Special Conditions of Sale (Specifically Applies to New Vehicles)</Text>
          <Cl n="13.1" numW={18}>You have advised me that the list price (the manufacturer's recommended retail price) applicable at the date of delivery may be higher than the price appearing on this offer. I have been advised that, should I opt to cancel the contract on the basis of the price difference, you may deduct a reasonable charge for cancellation.</Cl>
          <Cl n="13.2" numW={18}>I agree that the vehicle is new, notwithstanding —</Cl>
          <Cl n="13.2.1" indent={14} numW={22}>that it may have been driven under its own power (with or without the distance travelled having been recorded on the odometer) from the place of assembly to the place of delivery, for demonstration purposes, or for pre-delivery testing;</Cl>
          <Cl n="13.2.2" indent={14} numW={22}>that it may have incurred minor wear and tear in the course of the above.</Cl>
          <Cl n="13.3" numW={18}>If the vehicle is not in stock and I decide to proceed, you will give me an estimate of when delivery can take place, and I agree to take delivery whether or not delivery takes place on, before or after the estimated date, provided that it: is of the make and model set out in this offer; differs only in minor respects due to manufacturer design changes; and the delay was due to factors outside the dealership's control.</Cl>
        </View>

        <LegalSign client={clientFull} exec={sales.exec_name} otpRef={offer.ref} />
      </Page>

      {/* ============================================================ PAGE 5 */}
      <Page size="A4" style={page}>
        <LegalHead otpRef={offer.ref} date={offer.date} />

        <View>
          <Text style={h2}>14. Data Protection Information</Text>
          <Cl n="14.1" numW={18}>I am aware that when I purchase a vehicle from {company.trading_name}, Makhulu Holdings (Pty) Ltd t/a {company.trading_name} processes my personal information as the Responsible Party.</Cl>
          <Cl n="14.2" numW={18}>I am aware that you do not sell my information to third parties. However, you may from time to time disclose and jointly process my personal information with your service providers, finance and insurance partners, agents and affiliates, strictly for the purpose of rendering the services I have requested.</Cl>
          <Cl n="14.3" numW={18}>I am aware that I have the right to access the personal information you hold about me and to make corrections if necessary, and the right to object to the processing of my personal information. I also have the right to withdraw any consent I have previously given and to ask you to erase or delete information you hold about me.</Cl>
          <Cl n="14.4" numW={18}>I am aware that if I am dissatisfied, I have the right to lodge a complaint with {company.trading_name} or directly with the Information Regulator.</Cl>
          <Cl n="14.5" numW={18}>I am aware that {company.trading_name} may inform me of necessary vehicle and service information related to the maintenance of my vehicle. I may withdraw consent to this processing at any time.</Cl>
          <Cl n="14.6" numW={18}>I am aware that {company.trading_name} may conduct surveys to improve its service and product offerings and may occasionally contact me to request my participation. I may withdraw consent to this processing at any time.</Cl>
          <Cl n="14.7" numW={18}>I wish to receive promotional communication (e.g. retail offers, service offers, parts specials). I may withdraw consent at any time.   Yes <U />{' '} No <U /></Cl>
          <Cl n="14.8" numW={18}>I wish to receive beneficial information (e.g. event invitations, newsletters). I may withdraw consent at any time.   Yes <U />{' '} No <U /></Cl>
          <Cl n="14.9" numW={18}>I may: refuse to accept; inform you in writing to discontinue; or register a pre-emptive block with the Registry for Direct Marketing against any direct marketing communication from you.</Cl>

          <Text style={h2}>15. Consent to Process Personal Information (POPIA, Act 4 of 2013)</Text>
          <Cl n="15.1" numW={18}>I am required by law to provide you with all documentation in terms of the Financial Intelligence Centre Act, No. 38 of 2001 (FICA), and should I fail to provide the required documentation, this offer cannot proceed.</Cl>
          <Cl n="15.2" numW={18}>I authorise you to submit my particulars to the eNaTIS system for registration of the vehicle on the national database of roadworthy vehicles and licensed drivers.</Cl>
          <Cl n="15.3" numW={18}>I give my consent to {company.trading_name} to collect, process and distribute my personal information where {company.trading_name} is legally required to do so.</Cl>
          <Cl n="15.4" numW={18}>I understand my right to privacy and the right to have my personal information processed in accordance with the conditions for lawful processing.</Cl>
          <Cl n="15.5" numW={18}>I acknowledge that I understand the purposes for which my personal information is required and will be used — namely, to enable {company.trading_name} to render the required services to me.</Cl>
          <Cl n="15.6" numW={18}>I consent to {company.trading_name} sharing my personal information strictly for reporting to the relevant authorities and to render the services requested by me.</Cl>
          <Cl n="15.7" numW={18}>I understand that, should I refuse to provide the required consent and/or information, {company.trading_name} will be unable to assist me with any of the services requested.</Cl>
          <Cl n="15.8" numW={18}>I understand that all personal information I provide will be held and/or stored securely for the purpose for which it was collected.</Cl>
          <Cl n="15.9" numW={18}>I declare that all personal information supplied is accurate, up-to-date, not misleading, and complete in all respects, and I undertake to immediately advise {company.trading_name} of any changes.</Cl>
        </View>

        <View style={{ borderWidth: px(1), borderColor: INK, borderStyle: 'solid', backgroundColor: '#F6F6F6', paddingVertical: px(8), paddingHorizontal: px(10), marginVertical: px(10) }}>
          <Text style={{ fontSize: px(7.8), lineHeight: 1.5, fontWeight: 600 }}>
            By my signature hereto, I acknowledge that {company.trading_name} is required to submit my particulars to the eNaTIS system for registration of the vehicle on the national database of roadworthy vehicles and licensed drivers, and I authorise this submission to the extent required.
          </Text>
        </View>
        <Text style={{ fontSize: px(7.8), lineHeight: 1.6, marginVertical: px(5) }}>
          I would like to receive promotional emails such as retail and service offers and specials from {company.trading_name}:   Yes <U />{' '} No <U />
        </Text>
        <Text style={{ fontSize: px(7.8), lineHeight: 1.6, marginVertical: px(5) }}>
          I would like to receive beneficial information such as event invitations and newsletters:   Yes <U />{' '} No <U />
        </Text>
        <Text style={{ fontSize: px(7.8), lineHeight: 1.6, marginVertical: px(5), color: GREY }}>
          You are free to withdraw your consent to the above communications by unsubscribing at any time. By signing this document I acknowledge that it was fully completed with the information you are allowed to use.
        </Text>

        <View wrap={false} style={{ marginTop: px(16) }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: px(14) }}>
            <Text style={{ fontSize: px(7.8) }}>Sales Manager / DP: </Text>
            <Fill w={200} />
            <Text style={{ fontSize: px(7.8) }}>   Place: </Text>
            <Fill w={120} />
            <Text style={{ fontSize: px(7.8) }}>   Date: </Text>
            <Fill w={120} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: px(14) }}>
            <Text style={{ fontSize: px(7.8) }}>Signed at </Text>
            <Fill w={150} />
            <Text style={{ fontSize: px(7.8) }}> on </Text>
            <Fill w={120} />
          </View>
          <View style={{ flexDirection: 'row', marginTop: px(6) }}>
            <View style={{ width: '45%', borderTopWidth: px(1), borderTopColor: INK, borderTopStyle: 'solid', paddingTop: px(4) }}>
              <Text style={{ fontSize: px(7.8) }}>{clientFull}</Text>
              <Text style={{ fontSize: px(7), color: GREY }}>Purchaser Signature & Date</Text>
            </View>
            <View style={{ width: '10%' }} />
            <View style={{ width: '45%', borderTopWidth: px(1), borderTopColor: INK, borderTopStyle: 'solid', paddingTop: px(4) }}>
              <Text style={{ fontSize: px(7.8) }}>{sales.exec_name}</Text>
              <Text style={{ fontSize: px(7), color: GREY }}>Sales Executive Signature & Date</Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', marginTop: px(14) }}>
          <View style={{ flex: 1, marginRight: px(14), borderWidth: px(1), borderColor: LINE, borderStyle: 'solid', paddingVertical: px(9), paddingHorizontal: px(11) }}>
            <Text style={{ fontSize: px(7.8), fontWeight: 700, marginBottom: px(5), letterSpacing: track(7.8, 0.03) }}>Information Regulator</Text>
            <Text style={{ fontSize: px(7.4), lineHeight: 1.55 }}>Physical: JD House, 27 Stiemens Street, Braamfontein, Johannesburg, 2001</Text>
            <Text style={{ fontSize: px(7.4), lineHeight: 1.55 }}>Postal: P.O. Box 31533, Braamfontein, Johannesburg, 2017</Text>
            <Text style={{ fontSize: px(7.4), lineHeight: 1.55 }}>Complaints: complaints.IR@justice.gov.za</Text>
            <Text style={{ fontSize: px(7.4), lineHeight: 1.55 }}>Enquiries: inforeg@justice.gov.za</Text>
          </View>
          <View style={{ flex: 1, borderWidth: px(1), borderColor: LINE, borderStyle: 'solid', paddingVertical: px(9), paddingHorizontal: px(11) }}>
            <Text style={{ fontSize: px(7.8), fontWeight: 700, marginBottom: px(5), letterSpacing: track(7.8, 0.03) }}>Motor Industry Ombudsman (MIOSA)</Text>
            <Text style={{ fontSize: px(7.4), lineHeight: 1.55 }}>Physical: Meiring Naudé Rd, Scientia 627-Jr, Pretoria, 0184</Text>
            <Text style={{ fontSize: px(7.4), lineHeight: 1.55 }}>How to complain: www.miosa.co.za/how-to-complain.php</Text>
            <Text style={{ fontSize: px(7.4), lineHeight: 1.55 }}>Complaints: info@miosa.co.za</Text>
            <Text style={{ fontSize: px(7.4), lineHeight: 1.55 }}>Enquiries: info@miosa.co.za</Text>
          </View>
        </View>

        <View style={{ borderWidth: px(1), borderColor: LINE, borderStyle: 'solid', paddingVertical: px(9), paddingHorizontal: px(11), marginTop: px(12) }}>
          <Text style={{ fontSize: px(7.4), fontWeight: 600, color: INK, marginBottom: px(4) }}>For internal use only — Privacy data loaded.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={{ fontSize: px(7.4), color: GREY }}>By </Text>
            <Fill w={150} />
            <Text style={{ fontSize: px(7.4), color: GREY }}>   Date </Text>
            <Fill w={120} />
            <Text style={{ fontSize: px(7.4), color: GREY }}>   Sign </Text>
            <Fill w={150} />
          </View>
        </View>

        <View style={{ marginTop: 'auto', paddingTop: px(12), borderTopWidth: px(1), borderTopColor: LINE_SOFT, borderTopStyle: 'solid' }}>
          <Text style={{ fontSize: px(7), color: GREY, textAlign: 'center' }}>
            Makhulu Holdings (Pty) Ltd t/a {company.trading_name} • Offer to Purchase • {offer.ref}
          </Text>
        </View>
      </Page>

    </Document>
  );
}
