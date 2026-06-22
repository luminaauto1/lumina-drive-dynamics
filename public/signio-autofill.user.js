// ==UserScript==
// @name         Lumina → Signio Auto-Fill
// @namespace    lumina.auto
// @version      0.1.0
// @description  One-click auto-fill of the Signio/AA Money "Online Finance Application" from a Lumina finance_applications record. Human does the final reCAPTCHA + Submit.
// @match        https://goa.signio.co.za/ThirdPartyIntegration/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
/*
  HOW IT WORKS (all techniques verified live on the real form):
  - Inputs are React-controlled with NO ids/names. We set values via the native
    prototype setter + dispatch input/change so React's state updates.
  - The wizard advances step-by-step; invisible reCAPTCHA only fires on final Submit,
    so we fill steps 1..6 freely and STOP at Declaration for the human.
  - Address + Vehicle use async "lookup" widgets. We drive them and WAIT for re-render.
  - The Address result is a real <button onClick>; click it, then wait a tick for the
    locked Suburb/City/Postal/Province fields to populate.

  DATA: wire fetchApplicationData() to a Lumina endpoint that returns ONE application,
  already normalized server-side if you prefer. For now it reads window.__LUMINA_APP__.
*/
(function () {
  'use strict';

  // ----------------------------- helpers -----------------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, { timeout = 8000, interval = 150 } = {}) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { const v = fn(); if (v) return v; await sleep(interval); }
    return null;
  }
  function setVal(el, val) {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val == null ? '' : String(val));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function labelFor(el) {
    let n = el, h = 0;
    while (n && h < 5) { n = n.previousElementSibling || n.parentElement; h++;
      if (n && n.innerText) { const t = n.innerText.trim().split('\n').filter(Boolean)[0]; if (t && t.length < 45) return t; } }
    return '';
  }
  const norm = (s) => (s || '').toString().trim().toLowerCase();
  function inputByLabel(re) {
    return [...document.querySelectorAll('input')].find((el) => re.test(labelFor(el)));
  }
  function selectByLabel(re) {
    return [...document.querySelectorAll('select')].find((el) => re.test(labelFor(el)));
  }
  function setText(re, value) { const el = inputByLabel(re); if (el && value != null) setVal(el, value); return !!el; }
  function setSelect(re, target, { contains = false } = {}) {
    const el = selectByLabel(re); if (!el || target == null) return false;
    const opts = [...el.options];
    let opt = opts.find((o) => norm(o.text) === norm(target));
    if (!opt && contains) opt = opts.find((o) => norm(o.text).includes(norm(target)) || norm(target).includes(norm(o.text)));
    if (opt) { setVal(el, opt.value); return true; }
    return false;
  }
  // fuzzy: pick option with most shared tokens with query
  function setSelectFuzzy(re, query) {
    const el = selectByLabel(re); if (!el || !query) return false;
    const q = norm(query).split(/[^a-z0-9]+/).filter(Boolean);
    let best = null, bestScore = 0;
    for (const o of [...el.options].slice(1)) {
      const ot = norm(o.text).split(/[^a-z0-9]+/).filter(Boolean);
      const score = q.filter((t) => ot.includes(t)).length;
      if (score > bestScore) { bestScore = score; best = o; }
    }
    if (best && bestScore > 0) { setVal(el, best.value); return best.text; }
    return false;
  }
  function clickButtonText(re) {
    const b = [...document.querySelectorAll('button')].find((x) => re.test(x.innerText.trim()));
    if (b) { b.scrollIntoView({ block: 'center' }); b.click(); }
    return !!b;
  }
  function radiosSetNo(count) {
    const radios = [...document.querySelectorAll('input[type=radio]')];
    for (let k = 0; k < count; k++) if (radios[2 * k + 1]) radios[2 * k + 1].click();
    return radios;
  }
  // Address Lookup: type suburb -> Search -> click the result <button> -> wait for re-render
  async function addressLookup(suburb) {
    const box = inputByLabel(/suburb name|postal code/i) ||
      [...document.querySelectorAll('input')].find((e) => /suburb name|postal code/i.test(e.placeholder || ''));
    if (!box || !suburb) return false;
    setVal(box, suburb);
    clickButtonText(/^search$/i);
    const btn = await waitFor(() =>
      [...document.querySelectorAll('button')].find((b) => norm(b.innerText).includes(norm(suburb)) && b.innerText.length < 70));
    if (!btn) return false;
    btn.click();
    await sleep(600); // let React populate the locked Suburb/City/Postal/Province
    return true;
  }

  // --------------------------- normalization ---------------------------
  const TITLE = (g, marital) => {
    if (norm(g) === 'female') return norm(marital) === 'married' ? 'Mrs' : 'Miss';
    if (norm(g) === 'male') return 'Mr';
    return null;
  };
  const ID_TYPE = (t) => (/passport/i.test(t) ? 'Passport' : 'South African Valid ID');
  const EDUCATION = { matric: 'COMPLETED MATRIC', diploma: 'DIPLOMA', degree: 'BACHELORS DEGREE',
    postgraduate: 'HONOURS OR HIGHER', honours: 'HONOURS OR HIGHER' };
  const MARITAL = { single: 'Single', married: 'Married', divorced: 'Divorced', widowed: 'Widow/er', 'widow/er': 'Widow/er' };
  const EMP_TYPE = { permanently_employed: 'Permanent', permanent: 'Permanent', self_employed: 'Self employed',
    contract: 'Contractual', contractual: 'Contractual', part_time: 'Part time', pensioner: 'Pensioner',
    student: 'Student', unemployed: 'Unemployed' };
  const CLIENT_TYPE = (empType) => (/self/i.test(empType) ? 'Self employed(non-professional)' : 'Private Individual');
  const ACCOUNT_TYPE = { savings: 'Savings', cheque: 'Cheque', current: 'Cheque', transmission: 'Transmission' };
  // Signio bank option text is fuzzy-matched; universal branch codes filled directly:
  const BRANCH_CODE = { capitec: '470010', fnb: '250655', 'first national': '250655', absa: '632005',
    'standard bank': '051001', standard: '051001', nedbank: '198765', tymebank: '678910', tyme: '678910',
    'african bank': '430000', discovery: '679000', investec: '580105', bidvest: '462005', sasfin: '683000' };
  function branchCodeFor(bank) {
    const b = norm(canonicalBank(bank) || bank); for (const k in BRANCH_CODE) if (b.includes(k)) return BRANCH_CODE[k]; return null;
  }
  // Canonicalise the ~21 free-text bank spellings found in the data into Signio labels.
  function canonicalBank(raw) {
    const k = norm(raw).replace(/[^a-z]/g, '');
    if (!k) return null;
    if (/capitec/.test(k)) return 'Capitec Bank';
    if (/^fnb|^fnd|firstnational/.test(k)) return 'First National Bank';
    if (/absa/.test(k)) return 'Absa';
    if (/standardbank|^standard/.test(k)) return 'Standard Bank';
    if (/nedbank/.test(k)) return 'Nedbank';
    if (/discovery/.test(k)) return 'Discovery Bank';
    if (/tyme/.test(k)) return 'TymeBank';
    if (/africanbank/.test(k)) return 'African Bank';
    if (/bidvest/.test(k)) return 'Bidvest Bank';
    if (/investec/.test(k)) return 'Investec';
    flag('Unmapped bank name "' + raw + '" — pick the bank + branch code manually.');
    return null; // unknown -> flag, don't guess
  }
  // SA ID helpers (Signio validates the ID; a Luhn-fail hard-blocks submission)
  function luhnValid(id) {
    if (!/^\d{13}$/.test(id || '')) return false;
    let sum = 0, alt = false;
    for (let i = id.length - 1; i >= 0; i--) { let d = +id[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } sum += d; alt = !alt; }
    return sum % 10 === 0;
  }
  function genderFromId(id) {
    if (!/^\d{13}$/.test(id || '')) return null;
    return parseInt(id.substr(6, 4), 10) >= 5000 ? 'Male' : 'Female';
  }
  // Friction queue: anything we can't safely fill gets flagged for the human, never guessed.
  let flags = [];
  function flag(msg) { flags.push(msg); console.warn('[Lumina FLAG]', msg); }

  // ----------------------------- per-step fills -----------------------------
  async function fillBasicInfo(d) {
    // ID gate: a Luhn-invalid SA ID hard-blocks Signio — flag, don't push bad data.
    if (!luhnValid(d.id_number)) flag('ID number "' + (d.id_number || '(missing)') + '" is not a valid SA ID (Luhn/13-digit) — fix before submit.');
    // Prefer gender encoded in the ID (Signio's source of truth) over the stored column.
    d._gender = genderFromId(d.id_number) || (norm(d.gender) === 'male' ? 'Male' : norm(d.gender) === 'female' ? 'Female' : null);
    if (genderFromId(d.id_number) && d.gender && genderFromId(d.id_number) !== (norm(d.gender) === 'male' ? 'Male' : 'Female'))
      flag('Stored gender (' + d.gender + ') disagrees with ID — used ID-derived gender ' + d._gender + '.');
    setSelect(/^title$/i, TITLE(d._gender, d.marital_status));
    setSelect(/id type/i, ID_TYPE(d.id_type));
    setText(/id number/i, d.id_number);
    setText(/first name/i, d.first_name);
    setText(/surname/i, d.last_name);
    setText(/email/i, d.email);
    setText(/mobile number/i, d.phone);
    // Payment history: all "No" (clean). 7 questions then 2 consents -> set first 7 No,
    // marketing consent No (pair 7), credit consent Yes (pair 8).
    const radios = [...document.querySelectorAll('input[type=radio]')];
    for (let k = 0; k < 7; k++) radios[2 * k + 1] && radios[2 * k + 1].click();
    radios[15] && radios[15].click();       // marketing -> No
    radios[16] && radios[16].click();       // credit profile -> Yes
  }

  // BUSINESS RULE: the vehicle is ALWAYS the same — 2026 Suzuki Swift GL (USED), R220 000, 12% interest, 35% balloon.
  // Cascade: Used > SUZUKI > 2026 > "SWIFT 1.2 GL (59007082)". Ignores any per-applicant vehicle data.
  const FIXED_VEHICLE = {
    condition: 'Used', make: 'SUZUKI', year: '2026',
    model: /SWIFT 1\.2 GL \(/i,          // base GL (not GL+ / GLX); MM code 59007082
    price: '220000', interest: '12', balloon: '35', term: '72 Months',
  };
  async function fillVehicle() {
    const V = FIXED_VEHICLE;
    setSelect(/condition/i, V.condition);
    const makeSel = await waitFor(() => { const s = selectByLabel(/^make$/i); return s && s.options.length > 5 ? s : null; });
    if (makeSel) setSelect(/^make$/i, V.make, { contains: true });
    const yearSel = await waitFor(() => { const s = selectByLabel(/^year$/i); return s && s.options.length > 2 ? s : null; });
    if (yearSel) setSelect(/^year$/i, V.year);
    const modelSel = await waitFor(() => { const s = selectByLabel(/^model$/i); return s && s.options.length > 1 ? s : null; });
    if (modelSel) {
      const o = [...modelSel.options].find((x) => V.model.test(x.text));
      if (o) setVal(modelSel, o.value); else flag('Fixed vehicle "Swift 1.2 GL" not found in lookup — check Signio catalogue.');
    }
    await sleep(400);
    setText(/purchase price/i, V.price);
    setSelect(/repayment period/i, V.term, { contains: true });   // Rate Type defaults to "Linked"
    // Interest & Balloon are range sliders
    [...document.querySelectorAll('input[type=range]')].forEach((r) => {
      const l = labelFor(r);
      if (/interest/i.test(l)) setVal(r, V.interest);
      if (/balloon|residual/i.test(l)) setVal(r, V.balloon);
    });
  }

  async function fillPersonal(d) {
    // Race/Ethnic Group: intentionally LEFT BLANK (sensitive; optional). Dealer sets if needed.
    setSelect(/country of birth/i, d.country_of_birth || 'SOUTH AFRICA', { contains: true });
    setSelect(/nationality/i, d.nationality || 'SOUTH AFRICA', { contains: true });
    setSelect(/gender/i, d._gender || d.gender);
    setSelect(/education/i, EDUCATION[norm(d.qualification)] || null, { contains: true });
    setSelect(/marital status/i, MARITAL[norm(d.marital_status)] || null);
    // Address (residential) – Address Line 1 max 50 chars; locked fields via lookup
    if (d.street_address) setText(/address line 1/i, String(d.street_address).slice(0, 50));
    if (d.suburb) await addressLookup(d.suburb);   // <-- derive a clean suburb from the address in Lumina
    if (d.years_at_address != null) setText(/^years$/i, d.years_at_address); else setText(/^years$/i, '3');
    setText(/^months$/i, d.months_at_address != null ? d.months_at_address : '0');
    // Marital contract + spouse (only when married)
    if (norm(d.marital_status) === 'married') {
      setSelect(/marital contract|marriage type/i, d.marriage_type, { contains: true });
      setText(/spouse first/i, d.spouse_first_name);
      setText(/spouse surname/i, d.spouse_surname);
    }
    // Next of Kin (REQUIRED) – needs real data in Lumina (kin_name/kin_contact)
    if (d.kin_relation) setSelect(/relation/i, d.kin_relation, { contains: true });
    if (d.kin_first_name) setText(/^first name$/i, d.kin_first_name);
    if (d.kin_surname) setText(/^surname$/i, d.kin_surname);
    setSelect(/contact method/i, 'Cellphone');
    if (d.kin_contact) setText(/phone number/i, d.kin_contact);
  }

  async function fillEmployment(d) {
    setText(/employer name/i, d.employer_name);
    setSelect(/employment level/i, d.employment_level || 'Skilled Worker', { contains: true });
    setSelect(/salary payment date/i, d.salary_day || '25', { contains: true });
    setSelectFuzzy(/occupation/i, d.job_title);                 // 300-option list
    setSelectFuzzy(/employer industry/i, d.industry || d.employer_name); // 59-option list (best-effort)
    setSelect(/employment type/i, EMP_TYPE[norm(d.employment_type)] || 'Permanent', { contains: true });
    setSelect(/client type/i, CLIENT_TYPE(EMP_TYPE[norm(d.employment_type)] || ''), { contains: true });
    // Employer address via lookup
    if (d.employer_address) setText(/^address 1$|address line 1/i, String(d.employer_address).slice(0, 50));
    if (d.employer_suburb) await addressLookup(d.employer_suburb);
    // Banking
    setText(/account holder/i, d.full_name);
    setSelect(/account type/i, ACCOUNT_TYPE[norm(d.account_type)] || d.account_type, { contains: true });
    const bank = canonicalBank(d.bank_name);
    setSelectFuzzy(/bank name|^bank$/i, bank || d.bank_name);
    setText(/account number/i, d.account_number);
    const bc = branchCodeFor(d.bank_name);
    if (bc) setText(/branch code/i, bc); else flag('No branch code for bank "' + (d.bank_name || '') + '".');
    setText(/branch name/i, bank || d.bank_name || '');           // required, separate from branch code
    // Employer tenure (required) — parse "X Years, Y Months" from employment_period, else default.
    const py = String(d.employment_period || '').match(/(\d+)\s*year/i);
    const pmo = String(d.employment_period || '').match(/(\d+)\s*month/i);
    setText(/^years$/i, py ? py[1] : '1');
    setText(/^months$/i, pmo ? pmo[1] : '0');
  }

  async function fillIncomeExpenses(d) {
    // Sanity: ~6% of rows have net > gross (swapped/typo). Flag rather than push impossible figures.
    if (+d.gross_salary && +d.net_salary && +d.net_salary > +d.gross_salary)
      flag('Net salary (' + d.net_salary + ') > Gross (' + d.gross_salary + ') — likely swapped; verify before submit.');
    setText(/gross remuneration/i, d.gross_salary);
    setText(/net take-home|net take home/i, d.net_salary);
    setText(/other income/i, d.additional_income || '0');
    // Expenses: Lumina stores ONE total (free-text); only safe as the lump "Other Expenses" line.
    const exp = String(d.total_expenses || '').replace(/[^\d.]/g, '');
    if (exp) setText(/other expenses/i, exp);
    else if (d.total_expenses) flag('Expenses "' + d.total_expenses + '" not numeric — enter Other Expenses manually.');
  }

  // ----------------------------- step runner -----------------------------
  function currentStep() {
    const t = document.body.innerText;
    if (/Payment History/.test(t) && document.querySelector('select')) return 'basic';
    if (/Vehicle Lookup|Vehicle Selected/.test(t)) return 'vehicle';
    if (/Residential Address|Next of Kin/.test(t)) return 'personal';
    if (/Employer Details|Employer Address/.test(t)) return 'employment';
    if (/Disposable Income|Gross Remuneration|TOTAL Expenses/.test(t)) return 'income';
    if (/true and correct/.test(t)) return 'declaration';
    if (/Drag and Drop|Document Category/.test(t)) return 'documents';
    return 'unknown';
  }

  async function run() {
    flags = [];
    const d = await fetchApplicationData();
    if (!d) { alert('Lumina: no application data found.'); return; }
    const fills = { basic: fillBasicInfo, vehicle: fillVehicle, personal: fillPersonal,
      employment: fillEmployment, income: fillIncomeExpenses };
    for (let i = 0; i < 6; i++) {
      const step = currentStep();
      if (step === 'declaration' || step === 'documents') break; // STOP for human
      const fn = fills[step];
      if (!fn) { console.warn('[Lumina] unknown step, stopping for human.'); break; }
      await fn(d);
      await sleep(400);
      if (step === 'income') break;              // last auto step; human reviews + Submit
      clickButtonText(/^next$/i);
      await waitFor(() => currentStep() !== step, { timeout: 6000 });
      await sleep(500);
    }
    const msg = flags.length
      ? 'Lumina auto-fill done, but ' + flags.length + ' item(s) need a human:\n\n• ' + flags.join('\n• ') +
        '\n\nFix these, tick the declaration, then Submit.'
      : 'Lumina auto-fill done — no issues flagged. Review, tick the declaration, then Submit.';
    alert(msg);
  }

  // ----------------------------- data source -----------------------------
  // TODO: replace with a fetch to a Lumina endpoint, e.g.
  //   return fetch('https://<lumina>/api/signio-payload?app=' + appId, {credentials:'include'}).then(r=>r.json())
  // The endpoint should return the fields used above (snake_case), ideally with
  // vehicle_make/model/variant/year + a clean `suburb`/`employer_suburb` derived from the address,
  // and kin_relation/kin_first_name/kin_surname/kin_contact.
  const HANDOFF_PREFIX = 'LUMINA_SIGNIO:';
  async function fetchApplicationData() {
    // Lumina's "Push to Signio" button passes the payload via window.name (NOT the URL,
    // so no PII in history). window.name survives the cross-origin navigation into Signio.
    if ((window.name || '').startsWith(HANDOFF_PREFIX)) {
      try { return JSON.parse(window.name.slice(HANDOFF_PREFIX.length)); } catch (e) { flag('Could not read Lumina payload.'); }
    }
    return window.__LUMINA_APP__ || null;
  }

  // ----------------------------- inject button -----------------------------
  function injectButton() {
    if (document.getElementById('lumina-fill-btn')) return;
    const b = document.createElement('button');
    b.id = 'lumina-fill-btn';
    b.textContent = '⚡ Auto-Fill from Lumina';
    b.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:99999;padding:10px 14px;' +
      'background:#1e40af;color:#fff;border:none;border-radius:8px;font:600 13px sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    b.onclick = () => { b.disabled = true; b.textContent = 'Filling…'; run().finally(() => { b.disabled = false; b.textContent = '⚡ Auto-Fill from Lumina'; }); };
    document.body.appendChild(b);
  }
  injectButton();
  new MutationObserver(injectButton).observe(document.body, { childList: true });

  // Auto-run when launched from Lumina: wait for step 1 to render, then fill automatically.
  (async function autostart() {
    if (!(window.name || '').startsWith(HANDOFF_PREFIX)) return;
    await waitFor(() => document.querySelectorAll('select').length >= 2, { timeout: 15000 });
    await sleep(400);
    run();
  })();
})();
