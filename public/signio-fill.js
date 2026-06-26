/* Lumina → Signio Auto-Fill ENGINE — LIGHTSTONE skin (single-page e-application).
   The new Signio link (thirdparty.signio.co.za/.../application?skin=LIGHTSTONE) is ONE long
   page (not the old multi-step wizard) and exposes clean field `name` attributes, so this
   engine fills by NAME (reliable) instead of by label/step. It reads the Lumina payload from
   window.name (set when the "Push to Signio" modal opens the tab), fills every section it can,
   and STOPS for the human to pick the vehicle (SELECT VEHICLE), tick the declaration and clear
   the reCAPTCHA before submitting.

   ADDRESS FIX: the F&I reported addresses were inaccurate. The old engine drove Signio's fuzzy
   "Address Lookup" widget, which often picked the wrong suburb/postal row. The new form has
   EXPLICIT address fields (Suburb / City / Postal Code), so we now fill those DIRECTLY from the
   application data — no guessing. */
(function () {
  'use strict';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, { timeout = 8000, interval = 150 } = {}) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { const v = fn(); if (v) return v; await sleep(interval); }
    return null;
  }
  const norm = (s) => (s || '').toString().trim().toLowerCase();
  let flags = [];
  function flag(m) { flags.push(m); console.warn('[Lumina FLAG]', m); }

  // React-aware value setter (writes through the native setter so React's onChange fires).
  function setVal(el, val) {
    if (!el) return false;
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val == null ? '' : String(val));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  const byName = (n) => document.querySelector('[name="' + n + '"]');
  function setN(name, val) { const el = byName(name); if (el && val != null && String(val).trim() !== '') return setVal(el, val); return false; }
  // Set a <select> by matching option text: exact → contains → token-overlap fuzzy.
  function setSelN(name, target, { fuzzy = false } = {}) {
    const el = byName(name); if (!el || el.tagName !== 'SELECT' || target == null || target === '') return false;
    const opts = [...el.options];
    let opt = opts.find((o) => norm(o.text) === norm(target))
      || opts.find((o) => norm(o.text).includes(norm(target)) || norm(target).includes(norm(o.text)));
    if (!opt && fuzzy) {
      const q = norm(target).split(/[^a-z0-9]+/).filter(Boolean);
      let best = null, score = 0;
      for (const o of opts.slice(1)) { const ot = norm(o.text).split(/[^a-z0-9]+/).filter(Boolean); const sc = q.filter((t) => ot.includes(t)).length; if (sc > score) { score = sc; best = o; } }
      if (best && score > 0) opt = best;
    }
    if (opt && opt.value) { setVal(el, opt.value); return true; }
    return false;
  }
  const isPlaceholder = (t) => /not selected|please|^\s*select|^\s*$|choose|unknown/i.test(String(t || '').trim());
  // Guarantee a required <select> ends on a real option (never the blank default).
  function ensureSelN(name, preferRe) {
    const el = byName(name); if (!el || el.tagName !== 'SELECT') return false;
    if (el.selectedIndex > 0 && el.value && !isPlaceholder((el.options[el.selectedIndex] || {}).text)) return true;
    const real = [...el.options].filter((o) => o.value && !isPlaceholder(o.text));
    const opt = (preferRe && real.find((o) => preferRe.test(o.text))) || real[0];
    if (opt) { setVal(el, opt.value); return true; }
    return false;
  }

  // ---- value mappings -------------------------------------------------------
  const TITLE = (g, m) => norm(g) === 'female' ? (norm(m) === 'married' ? 'Mrs' : 'Miss') : norm(g) === 'male' ? 'Mr' : null;
  const MARITAL = { single: 'Single', married: 'Married', divorced: 'Divorced', widowed: 'Widow/er', 'widow/er': 'Widow/er', separated: 'Separated' };
  const MARRIAGE_TYPE = { cop: 'In Community of property', 'in community of property': 'In Community of property',
    anc: 'Antenuptual Contract', antenuptial: 'Antenuptual Contract', 'out of community': 'Antenuptual Contract' };
  const ACCOUNT_TYPE = { savings: 'Savings', cheque: 'Cheque', current: 'Cheque', transmission: 'Transmission' };
  const BRANCH_CODE = { capitec: '470010', fnb: '250655', 'first national': '250655', absa: '632005',
    'standard bank': '051001', standard: '051001', nedbank: '198765', tymebank: '678910', tyme: '678910',
    'african bank': '430000', discovery: '679000', investec: '580105', bidvest: '462005' };
  function bankOptionName(raw) { // match the form's uppercased bank list
    const k = norm(raw).replace(/[^a-z]/g, '');
    if (!k) return null;
    if (/capitec/.test(k)) return 'CAPITEC BANK';
    if (/^fnb|firstnational/.test(k)) return 'FIRST NATIONAL BANK';
    if (/absa/.test(k)) return 'ABSA BANK';
    if (/standardbank|^standard/.test(k)) return 'STANDARD BANK';
    if (/nedbank/.test(k)) return 'NEDBANK';
    if (/discovery/.test(k)) return 'DISCOVERY BANK';
    if (/tyme/.test(k)) return 'TYME BANK';
    if (/africanbank/.test(k)) return 'AFRICAN BANK';
    if (/bidvest/.test(k)) return 'BIDVEST BANK';
    if (/investec/.test(k)) return 'INVESTEC';
    return null;
  }
  function branchCodeFor(bank) { const b = norm(bank); for (const k in BRANCH_CODE) if (b.includes(k)) return BRANCH_CODE[k]; return null; }
  const EMP_STATUS = { permanently_employed: 'Permanent', permanent: 'Permanent', self_employed: 'Self', 'self employed': 'Self',
    contract: 'Contract', contractual: 'Contract', part_time: 'Part', 'part time': 'Part', pensioner: 'Pension', student: 'Student', unemployed: 'Unemployed' };
  function luhnValid(id) { if (!/^\d{13}$/.test(id || '')) return false; let s = 0, a = false; for (let i = id.length - 1; i >= 0; i--) { let d = +id[i]; if (a) { d *= 2; if (d > 9) d -= 9; } s += d; a = !a; } return s % 10 === 0; }
  function genderFromId(id) { return /^\d{13}$/.test(id || '') ? (parseInt(id.substr(6, 4), 10) >= 5000 ? 'Male' : 'Female') : null; }
  // SA ID → CCYYMMDD date of birth. Century pivots on the current 2-digit year.
  function dobFromId(id) {
    if (!/^\d{6}/.test(id || '')) return null;
    const yy = +id.substr(0, 2), mm = id.substr(2, 2), dd = id.substr(4, 2);
    const cur = new Date().getFullYear() % 100;
    const cc = yy <= cur ? '20' : '19';
    return cc + id.substr(0, 2) + mm + dd; // CCYYMMDD
  }

  // ---- expense intelligence (sum amounts; keep fixed; normalise variable to income) ----
  const EXPENSE_CATS = [
    { re: /bond|home\s*loan|mortgage/i, name: 'sumExpensesCustomerBondPayment', fixed: true },
    { re: /\brent\b|lease|accommodation/i, name: 'rentPayment', fixed: true },
    { re: /rates|water|electric|lights|municipal|utilit/i, name: 'sumExpensesCustomerRates', fixed: true },
    { re: /vehicle|car\s*(finance|instal|payment)|instal?ment/i, name: 'sumExpensesCustomerVehicleInstallments', fixed: true },
    { re: /personal\s*loan|micro\s*loan|\bloan\b/i, name: 'sumExpensesCustomerLoanRepayments', fixed: true },
    { re: /credit\s*card/i, name: 'sumExpensesCustomerCreditCardRepayments', fixed: true },
    { re: /furniture|appliance/i, name: 'sumExpensesCustomerFurnitureAccounts', fixed: true },
    { re: /clothing|clothes|\baccounts?\b|retail|store\s*card/i, name: 'sumExpensesCustomerClothingAccounts', fixed: true },
    { re: /overdraft/i, name: 'sumExpensesCustomerOverdraftRepayments', fixed: true },
    { re: /policy|insurance|funeral|medical\s*aid/i, name: 'sumExpensesCustomerInsurancePayments', fixed: true },
    { re: /maintenance|alimony/i, name: 'sumExpensesCustomerMaintenance', fixed: true },
    { re: /telephone|airtime|\bdata\b|cell\s*phone/i, name: 'sumExpensesCustomerTelephonePayments', fixed: false },
    { re: /transport|fuel|petrol|diesel|taxi|travel/i, name: 'sumExpensesCustomerTransport', fixed: false },
  ];
  const parseAmt = (s) => { const m = String(s).replace(/[, ]/g, '').match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
  const realisticLiving = (net) => { const n = Math.max(0, +net || 0); return Math.min(Math.max(Math.round(n * 0.4 / 100) * 100, 3000), 14000); };
  function computeExpenses(d) {
    const net = +d.net_salary || +d.gross_salary || 0;
    const cleaned = String(d.total_expenses || '').replace(/(?<=\d)[ ,](?=\d{3}(\D|$))/g, '');
    const chunks = cleaned.split(/[,\n;]+|(?<=\d)\s+(?=[A-Za-z])/).map((s) => s.trim()).filter(Boolean);
    const byField = new Map(); let fixedTotal = 0, variableDeclared = 0;
    for (const ch of chunks) {
      const amt = parseAmt(ch); if (!amt) continue;
      const cat = EXPENSE_CATS.find((c) => c.re.test(ch));
      if (cat && cat.fixed) { byField.set(cat.name, (byField.get(cat.name) || 0) + amt); fixedTotal += amt; }
      else variableDeclared += amt; // unlabelled / phone / transport / groceries → variable
    }
    let variable = variableDeclared; let adjusted = false;
    const floor = realisticLiving(net);
    if (net > 0 && variable < floor) { variable = floor; adjusted = true; }
    if (net > 0) { const cap = Math.max(0, Math.round(net * 0.92) - fixedTotal); if (cap > 0 && variable > cap) { variable = cap; adjusted = true; } }
    // Variable living → Food & Entertainment line (the form's general living bucket).
    byField.set('sumExpensesCustomerFoodAndEntertainment', Math.round(variable));
    return { byField, total: Math.round(fixedTotal + variable), adjusted };
  }

  // Address: split free-text / Google address into line1 + suburb + city + postal.
  function splitAddr(full) {
    const s = String(full || '');
    const postal = (s.match(/\b\d{4}\b/g) || []).pop() || '';
    const segs = s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean)
      .filter((x) => !/south africa/i.test(x) && x !== postal);
    const line1 = segs[0] || '';
    // suburb/city are the trailing non-numeric segments
    const tail = segs.filter((x) => !/^\d{4}$/.test(x));
    const city = tail.length ? tail[tail.length - 1].replace(/\b\d{4}\b/, '').trim() : '';
    const suburb = tail.length >= 2 ? tail[tail.length - 2].replace(/\b\d{4}\b/, '').trim() : '';
    return { line1, suburb, city, postal };
  }
  function fillAddressDirect(prefix, parsed, explicit) {
    // explicit values from Lumina win; fall back to parsed-from-text.
    setN(prefix + 'AddressLine1', explicit.line1 || parsed.line1);
    if (explicit.line2) setN(prefix + 'AddressLine2', explicit.line2);
    const suburb = explicit.suburb || parsed.suburb || parsed.city;
    const city = explicit.city || parsed.city || explicit.suburb || parsed.suburb;
    const postal = explicit.postal || parsed.postal;
    const okSub = suburb ? setN(prefix + 'AddressSuburb', suburb) || setN(prefix + 'Suburb', suburb) : false;
    const okCity = city ? setN(prefix + 'AddressCity', city) || setN(prefix + 'City', city) : false;
    const okPost = postal ? setN(prefix + 'AddressPostalCode', postal) || setN(prefix + 'PostalCode', postal) : false;
    return { okSub, okCity, okPost, suburb, city, postal };
  }

  // ---- main fill ------------------------------------------------------------
  async function fillAll(d) {
    const idGender = genderFromId(d.id_number);
    if (!luhnValid(d.id_number)) flag('ID number "' + (d.id_number || '(missing)') + '" is not a valid 13-digit SA ID — fix before submit.');
    const gender = idGender || (norm(d.gender) === 'male' ? 'Male' : norm(d.gender) === 'female' ? 'Female' : null);

    // Identity
    setN('customerFirstName', d.first_name);
    if (d.middle_name) setN('customerMiddleName', d.middle_name);
    setN('customerSurname', d.last_name);
    setN('customerIdNumber', d.id_number);
    const dob = d.date_of_birth || dobFromId(d.id_number);
    if (dob) setN('customerDateOfBirth', String(dob).replace(/\D/g, '').slice(0, 8));

    // Personal
    setSelN('customerTitle', TITLE(gender, d.marital_status));
    setSelN('customerGender', gender);
    setSelN('customerNationality', d.nationality || 'SOUTH AFRICA', { fuzzy: true }) || setSelN('customerNationality', 'South Africa', { fuzzy: true });
    setSelN('customerPreferredLanguage', d.language || 'English', { fuzzy: true });
    // "Graduate" is a Yes/No on this form (not an education level).
    setSelN('customerGraduate', /diploma|degree|honours|postgrad|bachelor|masters|doctor/i.test(norm(d.qualification)) ? 'Yes' : 'No');
    setSelN('customerMaritalStatus', MARITAL[norm(d.marital_status)] || d.marital_status);
    setN('customerEmail', d.email);
    setN('customerMobilePhoneNumber', (d.phone || '').replace(/\D/g, ''));
    setSelN('customerPreferredContactMethod', d.email ? 'Email' : 'Cellphone', { fuzzy: true }) || ensureSelN('customerPreferredContactMethod', /cell|mobile|email/i);
    if (norm(d.marital_status) === 'married') {
      setSelN('customerMaritalContract', MARRIAGE_TYPE[norm(d.marriage_type)] || d.marriage_type, { fuzzy: true });
      setN('spouseFirstNames', d.spouse_first_name);
      setN('spouseSurname', d.spouse_surname);
    }

    // Residential address — DIRECT fill (the accuracy fix).
    const resParsed = splitAddr(d.street_address);
    const res = fillAddressDirect('customerResidential', resParsed, {
      line1: d.street_address ? String(d.street_address).split(/[,\n]/)[0].trim().slice(0, 60) : '',
      suburb: d.suburb, city: d.city, postal: d.area_code,
    });
    if (!res.okSub && !res.okPost) flag('Residential suburb/postal missing — fill Residential Suburb/City/Postal on the form.');
    setN('customerResidentialAddressLine1', (d.street_address ? String(d.street_address).split(/[,\n]/)[0].trim() : '').slice(0, 60));
    setN('customerPeriodAtCurrentAddressYears', d.years_at_address != null ? d.years_at_address : 3);
    setN('customerPeriodAtCurrentAddressMonths', d.months_at_address != null ? d.months_at_address : 0);
    setSelN('sameAsRes', 'Yes', { fuzzy: true }); // postal = residential (avoids re-entry)
    setSelN('ownerTenantLodger', d.residence_type || 'Tenant', { fuzzy: true }) || ensureSelN('ownerTenantLodger', /tenant|owner/i);

    // Next of kin
    const kinTokens = String(d.kin_name || '').trim().split(/\s+/).filter(Boolean);
    setN('relativeFirstNames', d.kin_first_name || kinTokens[0]);
    setN('relativeSurname', d.kin_surname || kinTokens.slice(1).join(' '));
    setSelN('relativeRelation', d.kin_relation, { fuzzy: true }) || ensureSelN('relativeRelation', /other|family|parent|sibling/i);
    if (d.kin_relation == null) flag('Next-of-kin relation not in Lumina — defaulted; set it if you know it.');
    setN('relativeCellphone', (d.kin_contact || '').replace(/\D/g, ''));
    setSelN('relativePreferredContactMethod', 'Cellphone', { fuzzy: true });

    // Employer
    setN('employerName', d.employer_name);
    if (!setSelN('customerOccupation', d.job_title, { fuzzy: true })) { ensureSelN('customerOccupation', /other|general|admin|clerical|operator|worker|assistant/i); flag('Occupation "' + (d.job_title || '(blank)') + '" had no match — generic option chosen; verify.'); }
    setSelN('employerIndustryType', d.industry || d.employer_name, { fuzzy: true }) || ensureSelN('employerIndustryType', /other|service|general/i);
    const empType = EMP_STATUS[norm(d.employment_type)] || 'Permanent';
    setSelN('customerEmploymentStatus', empType, { fuzzy: true }) || ensureSelN('customerEmploymentStatus', /self/i.test(empType) ? /self/i : /permanent|full/i);
    setSelN('employmentLevel', d.employment_level || 'Skilled', { fuzzy: true }) || ensureSelN('employmentLevel', /skilled|semi|other/i);
    setSelN('sourceOfIncome', 'Salary', { fuzzy: true }) || ensureSelN('sourceOfIncome', /salary|employ|wage/i);
    // Employer address — DIRECT fill from the Google-resolved business address.
    const empFull = d.business_address_auto || d.employer_address || '';
    const empParsed = splitAddr(empFull);
    fillAddressDirect('employer', empParsed, {
      line1: empFull ? String(empFull).split(/[,\n]/)[0].trim().slice(0, 60) : '',
      suburb: d.employer_suburb, city: d.employer_city, postal: d.employer_postal_code,
    });
    setN('employerAddressLine1', (empFull ? String(empFull).split(/[,\n]/)[0].trim() : '').slice(0, 60));
    const py = String(d.employment_period || '').match(/(\d+)\s*year/i);
    const pmo = String(d.employment_period || '').match(/(\d+)\s*month/i);
    setN('customerPeriodAtCurrentEmployerYears', py ? py[1] : 1);
    setN('customerPeriodAtCurrentEmployerMonths', pmo ? pmo[1] : 0);

    // Income
    if (+d.gross_salary && +d.net_salary && +d.net_salary > +d.gross_salary) flag('Net (' + d.net_salary + ') > Gross (' + d.gross_salary + ') — likely swapped; verify.');
    setN('sumIncomeCustomerGrossRemuneration', d.gross_salary);
    setN('addIncomeCustomerNetTakeHomePay', d.net_salary);
    if (+d.additional_income) setN('addIncomeCustomerOtherIncome', d.additional_income);

    // Bank
    setSelN('customerBankAccountBank', bankOptionName(d.bank_name) || d.bank_name, { fuzzy: true }) || flag('Bank "' + (d.bank_name || '') + '" not matched — pick it manually.');
    const chk = byName('chkAccApplicant'); if (chk && chk.type === 'checkbox' && !chk.checked) { chk.click(); } // account holder = applicant
    setN('customerBankAccountHolder', d.full_name);
    setN('customerBankAccountNumber', (d.account_number || '').replace(/\s/g, ''));
    setSelN('customerBankAccountType', ACCOUNT_TYPE[norm(d.account_type)] || d.account_type || 'Savings', { fuzzy: true }) || ensureSelN('customerBankAccountType', /savings|cheque|current/i);
    const bc = branchCodeFor(d.bank_name); if (bc) setN('customerBankAccountBranchCode', bc); else flag('No branch code for "' + (d.bank_name || '') + '".');

    // Expenses
    const ex = computeExpenses(d);
    // Some expense inputs only appear conditionally (e.g. Rent shows for Tenants). If the
    // primary field isn't fillable, fall back to its always-present total field.
    const EXP_FALLBACK = { rentPayment: 'sumExpensesCustomerRent' };
    for (const [name, amt] of ex.byField) {
      if (amt <= 0) continue;
      if (!setN(name, Math.round(amt)) && EXP_FALLBACK[name]) setN(EXP_FALLBACK[name], Math.round(amt));
    }
    if (ex.adjusted) flag('Variable living expenses normalised to a realistic level for the income (≈ R' + ex.total + ' total) — adjust if needed.');

    // Vehicle — sensible defaults; the human picks the actual car via SELECT VEHICLE (M&M lookup).
    setSelN('articleType', 'Motor Vehicle', { fuzzy: true });
    setSelN('articleCondition', d.vehicle_condition || 'Used', { fuzzy: true });
    setSelN('articleUse', 'Private', { fuzzy: true });
    if (+d.purchase_price) setN('purchasePrice', d.purchase_price);
    flag('VEHICLE: pick the actual car with the "SELECT VEHICLE" button (M&M lookup) — type/condition/use were defaulted.');
  }

  async function run() {
    flags = [];
    const d = fetchData();
    if (!d) { alert('No Lumina application data found.\n\nIn Lumina click "Push to Signio" → "Open Signio form", then click this bookmark on that tab.'); return; }
    await waitFor(() => byName('customerIdNumber'), { timeout: 12000 });
    try { await fillAll(d); } catch (e) { console.error('[Lumina]', e); flag('Engine error: ' + (e && e.message)); }
    const body = flags.length ? '\n\nCheck:\n• ' + flags.join('\n• ') : '';
    alert('Lumina auto-fill done (LIGHTSTONE).' + body + '\n\nNow: pick the vehicle (SELECT VEHICLE), review highlighted/empty required fields, tick the declaration, clear the reCAPTCHA, then Submit.');
  }

  const HANDOFF_PREFIX = 'LUMINA_SIGNIO:';
  function fetchData() {
    if ((window.name || '').startsWith(HANDOFF_PREFIX)) { try { return JSON.parse(window.name.slice(HANDOFF_PREFIX.length)); } catch (e) { flag('Could not read Lumina payload.'); } }
    return window.__LUMINA_APP__ || null;
  }
  run();
})();
