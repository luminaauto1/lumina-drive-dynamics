/* Lumina → Signio Auto-Fill ENGINE (bookmarklet source).
   This is the SAME field-fill logic verified against the live Signio form — only the
   delivery changed: it runs as a bookmarklet (drag "⚡ Fill Signio" to your bookmarks
   bar) instead of a Tampermonkey userscript. The Lumina "Push to Signio" modal fetches
   this file's text and wraps it into a javascript: bookmarklet, so the whole engine is
   inlined (no extension, no external script load → unaffected by Signio's CSP).
   Reads the payload from window.name (set when the modal opens the Signio tab), fills
   steps 1–5, and STOPS at the Declaration for the human (reCAPTCHA stays human). */
(function () {
  'use strict';

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
  // Did the locked Suburb/Town field get populated by a lookup result?
  function suburbFilled() {
    const el = inputByLabel(/^suburb$/i) || inputByLabel(/town\/?city|^city$/i);
    return !!(el && String(el.value || '').trim());
  }
  // Select the "Search by Suburb" / "Search by Postal Code" radio before searching.
  function setSearchMode(byPostal) {
    const r = [...document.querySelectorAll('input[type=radio]')].find((x) =>
      (byPostal ? /postal/i : /suburb/i).test(labelFor(x) + ' ' + ((x.parentElement && x.parentElement.innerText) || '')));
    if (r && !r.checked) r.click();
  }
  // Address Lookup: try each candidate (suburb name, then postal code). Type → Search →
  // click the best result row → wait for the locked Suburb/Town/Postal/Province to fill.
  // NB: result rows are <button>s whose innerText reads EMPTY in some runtimes, so we
  // match on textContent. When a postal code is known, prefer the row that contains it
  // (a suburb search can return several rows, e.g. Sandton 2146 vs 2196).
  async function addressLookup(candidates, preferPostal) {
    const queries = (Array.isArray(candidates) ? candidates : [candidates])
      .map((c) => (c == null ? '' : String(c).trim())).filter(Boolean);
    if (!queries.length) return false;
    const box = inputByLabel(/suburb name|postal code/i) ||
      [...document.querySelectorAll('input')].find((e) => /suburb name|postal code/i.test(e.placeholder || ''));
    if (!box) return false;
    const rowText = (b) => String((b.innerText && b.innerText.trim()) || b.textContent || '').trim();
    for (const q of queries) {
      setSearchMode(/^\d{4}$/.test(q));
      await sleep(150);
      setVal(box, q);
      clickButtonText(/^\s*search\s*$/i);
      const btn = await waitFor(() => {
        const rows = [...document.querySelectorAll('button')].filter((b) => {
          const t = rowText(b);
          return t.length > 3 && t.length < 90 && !/^\s*search\s*$/i.test(t) && t.includes(',');
        });
        if (!rows.length) return null;
        return (preferPostal && rows.find((b) => rowText(b).includes(String(preferPostal)))) ||
               rows.find((b) => norm(rowText(b)).includes(norm(q))) || rows[0];
      }, { timeout: 4000 });
      if (!btn) continue;
      btn.click();
      await sleep(800); // let React populate the locked Suburb/City/Postal/Province
      if (suburbFilled()) return true;
    }
    return false;
  }

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
  const BRANCH_CODE = { capitec: '470010', fnb: '250655', 'first national': '250655', absa: '632005',
    'standard bank': '051001', standard: '051001', nedbank: '198765', tymebank: '678910', tyme: '678910',
    'african bank': '430000', discovery: '679000', investec: '580105', bidvest: '462005', sasfin: '683000' };
  function branchCodeFor(bank) {
    const b = norm(canonicalBank(bank) || bank); for (const k in BRANCH_CODE) if (b.includes(k)) return BRANCH_CODE[k]; return null;
  }
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
    return null;
  }
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
  let flags = [];
  function flag(msg) { flags.push(msg); console.warn('[Lumina FLAG]', msg); }

  // Next-of-Kin Relation: use Lumina's value if present; else default to "Other"; else the
  // first real option. Lumina doesn't capture kin relation, so this keeps the step unblocked.
  function selectRelation(rel) {
    const el = selectByLabel(/relation/i);
    if (!el) return false;
    const opts = [...el.options];
    let opt = null;
    if (rel) {
      opt = opts.find((o) => norm(o.text) === norm(rel)) ||
            opts.find((o) => norm(o.text).includes(norm(rel)) || norm(rel).includes(norm(o.text)));
    }
    if (!opt) opt = opts.find((o) => /other/i.test(o.text));
    if (!opt) opt = opts.find((o) => o.value && !/not selected|please select|^select|^$/i.test(o.text.trim()));
    if (opt) { setVal(el, opt.value); return true; }
    return false;
  }

  async function fillBasicInfo(d) {
    if (!luhnValid(d.id_number)) flag('ID number "' + (d.id_number || '(missing)') + '" is not a valid SA ID (Luhn/13-digit) — fix before submit.');
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
    const radios = [...document.querySelectorAll('input[type=radio]')];
    for (let k = 0; k < 7; k++) radios[2 * k + 1] && radios[2 * k + 1].click();
    radios[15] && radios[15].click();
    radios[16] && radios[16].click();
  }

  const FIXED_VEHICLE = {
    condition: 'Used', make: 'SUZUKI', year: '2026',
    model: /SWIFT 1\.2 GL \(/i,
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
    setSelect(/repayment period/i, V.term, { contains: true });
    [...document.querySelectorAll('input[type=range]')].forEach((r) => {
      const l = labelFor(r);
      if (/interest/i.test(l)) setVal(r, V.interest);
      if (/balloon|residual/i.test(l)) setVal(r, V.balloon);
    });
  }

  async function fillPersonal(d) {
    setSelect(/country of birth/i, d.country_of_birth || 'SOUTH AFRICA', { contains: true });
    setSelect(/nationality/i, d.nationality || 'SOUTH AFRICA', { contains: true });
    setSelect(/gender/i, d._gender || d.gender);
    setSelect(/education/i, EDUCATION[norm(d.qualification)] || null, { contains: true });
    setSelect(/marital status/i, MARITAL[norm(d.marital_status)] || null);
    if (d.street_address) setText(/address line 1/i, String(d.street_address).slice(0, 50));
    const resOk = await addressLookup([d.suburb, d.area_code], d.area_code);
    if (!resOk) flag('Residential address not auto-resolved — in the Address Lookup box type the suburb or postal code, Search, and pick the result (fills Suburb/Town/Postal/Province).');
    if (d.years_at_address != null) setText(/^years$/i, d.years_at_address); else setText(/^years$/i, '3');
    setText(/^months$/i, d.months_at_address != null ? d.months_at_address : '0');
    if (norm(d.marital_status) === 'married') {
      setSelect(/marital contract|marriage type/i, d.marriage_type, { contains: true });
      setText(/spouse first/i, d.spouse_first_name);
      setText(/spouse surname/i, d.spouse_surname);
    }
    // Relation: Lumina doesn't capture it, so DEFAULT to a safe option ("Other") so the
    // required field never blocks the step. (Pick the real one on the form if known.)
    const relSet = selectRelation(d.kin_relation);
    if (!d.kin_relation && relSet) flag('Next-of-Kin Relation defaulted (not captured in Lumina) — change it on the form if you know it.');
    else if (!relSet) flag('Next-of-Kin "Relation" could not be set — pick it on the form (required).');
    if (d.kin_first_name) setText(/^first name$/i, d.kin_first_name);
    if (d.kin_surname) setText(/^surname$/i, d.kin_surname);
    setSelect(/contact method/i, 'Cellphone');
    if (d.kin_contact) setText(/phone number/i, d.kin_contact);
  }

  async function fillEmployment(d) {
    setText(/employer name/i, d.employer_name);
    setSelect(/employment level/i, d.employment_level || 'Skilled Worker', { contains: true });
    setSelect(/salary payment date/i, d.salary_day || '25', { contains: true });
    setSelectFuzzy(/occupation/i, d.job_title);
    setSelectFuzzy(/employer industry/i, d.industry || d.employer_name);
    setSelect(/employment type/i, EMP_TYPE[norm(d.employment_type)] || 'Permanent', { contains: true });
    setSelect(/client type/i, CLIENT_TYPE(EMP_TYPE[norm(d.employment_type)] || ''), { contains: true });
    if (d.employer_address) setText(/^address 1$|address line 1/i, String(d.employer_address).slice(0, 50));
    if (d.employer_suburb) { const eOk = await addressLookup([d.employer_suburb], d.employer_area_code); if (!eOk) flag('Employer address not auto-resolved — pick the suburb/postal in the employer Address Lookup.'); }
    setText(/account holder/i, d.full_name);
    setSelect(/account type/i, ACCOUNT_TYPE[norm(d.account_type)] || d.account_type, { contains: true });
    const bank = canonicalBank(d.bank_name);
    setSelectFuzzy(/bank name|^bank$/i, bank || d.bank_name);
    setText(/account number/i, d.account_number);
    const bc = branchCodeFor(d.bank_name);
    if (bc) setText(/branch code/i, bc); else flag('No branch code for bank "' + (d.bank_name || '') + '".');
    setText(/branch name/i, bank || d.bank_name || '');
    const py = String(d.employment_period || '').match(/(\d+)\s*year/i);
    const pmo = String(d.employment_period || '').match(/(\d+)\s*month/i);
    setText(/^years$/i, py ? py[1] : '1');
    setText(/^months$/i, pmo ? pmo[1] : '0');
  }

  async function fillIncomeExpenses(d) {
    if (+d.gross_salary && +d.net_salary && +d.net_salary > +d.gross_salary)
      flag('Net salary (' + d.net_salary + ') > Gross (' + d.gross_salary + ') — likely swapped; verify before submit.');
    setText(/gross remuneration/i, d.gross_salary);
    setText(/net take-home|net take home/i, d.net_salary);
    setText(/other income/i, d.additional_income || '0');
    const exp = String(d.total_expenses || '').replace(/[^\d.]/g, '');
    if (exp) setText(/other expenses/i, exp);
    else if (d.total_expenses) flag('Expenses "' + d.total_expenses + '" not numeric — enter Other Expenses manually.');
  }

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
    const d = fetchApplicationData();
    if (!d) {
      alert('No Lumina application data found.\n\nIn Lumina, click "Push to Signio" → "Open Signio form", then click this bookmark on that tab.');
      return;
    }
    const fills = { basic: fillBasicInfo, vehicle: fillVehicle, personal: fillPersonal,
      employment: fillEmployment, income: fillIncomeExpenses };
    // Give step 1 a moment to render if the bookmark is clicked early.
    await waitFor(() => document.querySelectorAll('select').length >= 2, { timeout: 10000 });
    let filledStep = null;     // fill each step ONCE (no glitchy re-fill loop)
    let stuckStep = null;      // the step we couldn't advance past (needs human input)
    for (let i = 0; i < 10; i++) {
      let step = currentStep();
      if (step === 'unknown') { await sleep(700); step = currentStep(); }
      if (step === 'declaration' || step === 'documents') break;
      const fn = fills[step];
      if (!fn) { console.warn('[Lumina] unknown step — stopping for human.'); break; }
      if (step !== filledStep) { await fn(d); filledStep = step; await sleep(400); }
      if (step === 'income') break; // last auto-fill step; human reviews + submits
      clickButtonText(/^next$/i);
      const advanced = await waitFor(() => currentStep() !== step, { timeout: 6000 });
      if (!advanced) {
        // A required field on this step couldn't be filled from Lumina (e.g. the
        // residential Suburb/Town via Address Lookup, or the Next-of-Kin Relation).
        // Stop cleanly here instead of fighting the form's validation.
        stuckStep = step;
        break;
      }
      await sleep(500);
    }
    const head = stuckStep
      ? 'Filled everything I could, then stopped on the "' + stuckStep + '" step — it has required fields I can\'t fill from your data.'
      : 'Lumina auto-fill done.';
    const tail = stuckStep
      ? '\n\nComplete the highlighted required fields above (e.g. use the Address Lookup for Suburb/Town, pick the Next-of-Kin Relation), then click Next and continue. Everything else is already filled.'
      : '\n\nReview, tick the declaration, then Submit.';
    const body = flags.length ? '\n\nAlso check:\n• ' + flags.join('\n• ') : '';
    alert(head + body + tail);
  }

  const HANDOFF_PREFIX = 'LUMINA_SIGNIO:';
  function fetchApplicationData() {
    if ((window.name || '').startsWith(HANDOFF_PREFIX)) {
      try { return JSON.parse(window.name.slice(HANDOFF_PREFIX.length)); } catch (e) { flag('Could not read Lumina payload.'); }
    }
    return window.__LUMINA_APP__ || null;
  }

  run();
})();
