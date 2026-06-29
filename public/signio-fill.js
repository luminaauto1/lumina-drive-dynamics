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
    'african bank': '430000', discovery: '679000', investec: '580105', bidvest: '462005',
    'old mutual': '462005' }; // Old Mutual uses the universal branch code 462005
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
    if (/oldmutual/.test(k)) return 'OLD MUTUAL BANK';
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

  // ---- province inference + random in-province location (for the Relative address) ----
  // The relative's City/Suburb/Postal are READ-ONLY on the form (filled via a lookup
  // popup), but a programmatic value-set writes through fine and needs no region code,
  // so we fill a real random town in the CUSTOMER'S province directly.
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const STREETS = ['Main Road', 'Church Street', 'Park Avenue', 'Oak Street', 'Acacia Road',
    'Long Street', 'Market Street', 'Station Road', 'Kerk Street', 'Voortrekker Road', 'Pretorius Street', 'Du Plessis Avenue'];
  const PROVINCE_CITIES = {
    'Gauteng': [
      { suburb: 'Sandton', city: 'Johannesburg', postal: '2196' }, { suburb: 'Centurion', city: 'Centurion', postal: '0157' },
      { suburb: 'Randburg', city: 'Johannesburg', postal: '2194' }, { suburb: 'Arcadia', city: 'Pretoria', postal: '0083' },
      { suburb: 'Benoni', city: 'Benoni', postal: '1501' }, { suburb: 'Roodepoort', city: 'Roodepoort', postal: '1724' },
      { suburb: 'Boksburg', city: 'Boksburg', postal: '1459' }, { suburb: 'Kempton Park', city: 'Kempton Park', postal: '1619' } ],
    'Western Cape': [
      { suburb: 'Bellville', city: 'Cape Town', postal: '7530' }, { suburb: 'Claremont', city: 'Cape Town', postal: '7708' },
      { suburb: 'Durbanville', city: 'Cape Town', postal: '7550' }, { suburb: 'George', city: 'George', postal: '6529' },
      { suburb: 'Paarl', city: 'Paarl', postal: '7646' }, { suburb: 'Stellenbosch', city: 'Stellenbosch', postal: '7600' } ],
    'KwaZulu-Natal': [
      { suburb: 'Umhlanga', city: 'Durban', postal: '4319' }, { suburb: 'Berea', city: 'Durban', postal: '4001' },
      { suburb: 'Pinetown', city: 'Pinetown', postal: '3610' }, { suburb: 'Scottsville', city: 'Pietermaritzburg', postal: '3201' },
      { suburb: 'Ballito', city: 'Ballito', postal: '4420' }, { suburb: 'Richards Bay', city: 'Richards Bay', postal: '3900' } ],
    'Eastern Cape': [
      { suburb: 'Summerstrand', city: 'Gqeberha', postal: '6001' }, { suburb: 'Vincent', city: 'East London', postal: '5247' },
      { suburb: 'Southernwood', city: 'Mthatha', postal: '5099' }, { suburb: 'Uitenhage', city: 'Kariega', postal: '6230' } ],
    'Free State': [
      { suburb: 'Westdene', city: 'Bloemfontein', postal: '9301' }, { suburb: 'Welkom', city: 'Welkom', postal: '9460' },
      { suburb: 'Bethlehem', city: 'Bethlehem', postal: '9701' }, { suburb: 'Sasolburg', city: 'Sasolburg', postal: '1947' } ],
    'Mpumalanga': [
      { suburb: 'Sonheuwel', city: 'Mbombela', postal: '1200' }, { suburb: 'Witbank', city: 'Emalahleni', postal: '1035' },
      { suburb: 'Secunda', city: 'Secunda', postal: '2302' }, { suburb: 'Middelburg', city: 'Middelburg', postal: '1050' } ],
    'Limpopo': [
      { suburb: 'Bendor', city: 'Polokwane', postal: '0699' }, { suburb: 'Tzaneen', city: 'Tzaneen', postal: '0850' },
      { suburb: 'Bela-Bela', city: 'Bela-Bela', postal: '0480' }, { suburb: 'Mokopane', city: 'Mokopane', postal: '0600' } ],
    'North West': [
      { suburb: 'Rustenburg', city: 'Rustenburg', postal: '0299' }, { suburb: 'Potchefstroom', city: 'Potchefstroom', postal: '2531' },
      { suburb: 'Klerksdorp', city: 'Klerksdorp', postal: '2571' }, { suburb: 'Brits', city: 'Brits', postal: '0250' } ],
    'Northern Cape': [
      { suburb: 'Kimberley', city: 'Kimberley', postal: '8301' }, { suburb: 'Upington', city: 'Upington', postal: '8801' },
      { suburb: 'Springbok', city: 'Springbok', postal: '8240' } ],
  };
  // Keyword → province (matched against the customer's address text).
  const PROVINCE_KEYWORDS = [
    ['Gauteng', /gauteng|johannesburg|joburg|jhb|pretoria|tshwane|sandton|midrand|centurion|soweto|randburg|roodepoort|kempton|benoni|boksburg|germiston|vereeniging|vanderbijl|krugersdorp|alberton|edenvale|gp\b/i],
    ['Western Cape', /western\s*cape|cape\s*town|kaapstad|bellville|stellenbosch|paarl|george|worcester|somerset\s*west|durbanville|claremont|mitchell|table\s*view|wc\b/i],
    ['KwaZulu-Natal', /kwazulu|natal|kzn|durban|pietermaritzburg|umhlanga|pinetown|newcastle|richards\s*bay|ballito|chatsworth|umlazi/i],
    ['Eastern Cape', /eastern\s*cape|port\s*elizabeth|gqeberha|east\s*london|mthatha|umtata|queenstown|king\s*william|uitenhage|kariega|ec\b/i],
    ['Free State', /free\s*state|vrystaat|bloemfontein|welkom|bethlehem|sasolburg|kroonstad|fs\b/i],
    ['Mpumalanga', /mpumalanga|nelspruit|mbombela|witbank|emalahleni|secunda|middelburg|ermelo|standerton|mp\b/i],
    ['Limpopo', /limpopo|polokwane|pietersburg|tzaneen|thohoyandou|mokopane|bela\s*bela|musina|lp\b/i],
    ['North West', /north\s*west|noordwes|rustenburg|mahikeng|mafikeng|potchefstroom|klerksdorp|brits|lichtenburg|nw\b/i],
    ['Northern Cape', /northern\s*cape|noord\s*kaap|kimberley|upington|springbok|kuruman|de\s*aar|nc\b/i],
  ];
  // Approximate postal-code → province (4-digit ranges), used when no keyword matches.
  function provinceFromPostal(pc) {
    const n = parseInt(String(pc || '').replace(/\D/g, '').slice(0, 4), 10);
    if (!n) return null;
    if (n <= 249) return 'Gauteng';
    if (n <= 499) return 'North West';
    if (n <= 599) return 'North West';
    if (n <= 999) return 'Limpopo';
    if (n <= 1399) return 'Mpumalanga';
    if (n <= 2199) return 'Gauteng';
    if (n <= 2499) return 'Mpumalanga';
    if (n <= 2899) return 'North West';
    if (n <= 4730) return 'KwaZulu-Natal';
    if (n <= 6499) return 'Eastern Cape';
    if (n <= 8099) return 'Western Cape';
    if (n <= 8999) return 'Northern Cape';
    return 'Free State';
  }
  function provinceOf(d) {
    const text = [d.province, d.city, d.town, d.suburb, d.street_address].filter(Boolean).join(' ');
    for (const [prov, re] of PROVINCE_KEYWORDS) if (re.test(text)) return prov;
    return provinceFromPostal(d.area_code) || 'Gauteng';
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
    setSelN('sameAsRes', 'Use Residential Address'); // "Postal Address" dropdown → copy the residential address
    setSelN('ownerTenantLodger', d.residence_type || 'Tenant', { fuzzy: true }) || ensureSelN('ownerTenantLodger', /tenant|owner/i);

    // Next of kin
    const kinTokens = String(d.kin_name || '').trim().split(/\s+/).filter(Boolean);
    setN('relativeFirstNames', d.kin_first_name || kinTokens[0]);
    setN('relativeSurname', d.kin_surname || kinTokens.slice(1).join(' '));
    setSelN('relativeRelation', d.kin_relation, { fuzzy: true }) || ensureSelN('relativeRelation', /other|family|parent|sibling/i);
    if (d.kin_relation == null) flag('Next-of-kin relation not in Lumina — defaulted; set it if you know it.');
    setN('relativeCellphone', (d.kin_contact || '').replace(/\D/g, ''));
    setSelN('relativePreferredContactMethod', 'Cellphone', { fuzzy: true });
    // Relative address — a RANDOM real town in the CUSTOMER'S OWN province (per requirement).
    // The City/Suburb/Postal fields are read-only (normally set via a lookup popup), but a
    // programmatic value-set writes through and needs no region code, so we fill directly.
    const relProv = provinceOf(d);
    const relLoc = rand(PROVINCE_CITIES[relProv] || PROVINCE_CITIES['Gauteng']);
    setN('relativeAddressLine1', (Math.floor(Math.random() * 98) + 1) + ' ' + rand(STREETS));
    setN('relativeAddressSuburb', relLoc.suburb);
    setN('relativeAddressCity', relLoc.city);
    setN('relativeAddressPostalCode', relLoc.postal);

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

    // Payment History — all adverse-credit questions answered "No" (standard clean profile).
    ['debtReviewIndicator', 'debtCounselling', 'administrationOrderIndicator', 'DebtAdminHist',
      'previousJudgementIndicator', 'DebtDisp', 'debtSeqOrder'].forEach((n) => setSelN(n, 'No'));

    // Application Details consents — both "Yes" (marketing share + credit-bureau access).
    setSelN('marketingConsentIndicator', 'Yes');
    setSelN('itcConcentIndicator', 'Yes');

    // Vehicle — FIXED placeholder car, selected via the SELECT VEHICLE (M&M) lookup so the
    // make/model/code populate exactly as Signio expects (direct typing is rejected — the
    // Model field is controlled by the lookup). Standard car for every quote: 2026 Suzuki
    // Swift 1.2 GL, M&M 59007082, R220 000, Used / Private.
    setSelN('articleType', 'Motor Vehicle', { fuzzy: true });
    setSelN('articleCondition', 'Used', { fuzzy: true });
    setSelN('articleUse', 'Private', { fuzzy: true });
    const vehicleOk = await selectFixedVehicle('59007082');
    if (vehicleOk) setN('purchasePrice', '220000.00');
    else flag('Could not auto-select the vehicle — click "SELECT VEHICLE", search M&M 59007082, pick it, then set Purchase Price 220000.');
  }

  // Drive the "Vehicle Lookup" modal to select a car by its M&M code, the way the form
  // expects (open → type code → Search → wait for the match → OK → fields populate).
  async function selectFixedVehicle(mm) {
    try {
      const openBtn = document.querySelector('[onclick*="lookupVehicle"]');
      if (!openBtn) return false;
      openBtn.click();
      const search = await waitFor(() => document.querySelector('#searchMMCode, [name="searchMMCode"]'), { timeout: 6000 });
      if (!search) return false;
      setVal(search, mm);
      const searchBtn = document.querySelector('#cmdMMCode')
        || [...document.querySelectorAll('input[type=button],button')].find((b) => /search/i.test(b.value || b.textContent || ''));
      if (searchBtn) searchBtn.click();
      // Wait for the lookup to resolve the model select to the matching code.
      await waitFor(() => { const m = document.querySelector('#selectModel'); return m && /\d{6,}/.test(m.value || ''); }, { timeout: 8000 });
      const okBtn = document.querySelector('#cmdVehicleOk')
        || [...document.querySelectorAll('input[type=button],button')].find((b) => /^ok$/i.test((b.value || b.textContent || '').trim()));
      if (okBtn) okBtn.click();
      // Confirm the main form's M&M code populated.
      const ok = await waitFor(() => { const c = byName('mmCode'); return c && (c.value || '').replace(/\D/g, '') === mm; }, { timeout: 5000 });
      return !!ok;
    } catch (e) { console.warn('[Lumina] vehicle select failed', e); return false; }
  }

  async function run() {
    flags = [];
    const d = fetchData();
    if (!d) { alert('No Lumina application data found.\n\nIn Lumina click "Push to Signio" → "Open Signio form", then click this bookmark on that tab.'); return; }
    await waitFor(() => byName('customerIdNumber'), { timeout: 12000 });
    try { await fillAll(d); } catch (e) { console.error('[Lumina]', e); flag('Engine error: ' + (e && e.message)); }
    const body = flags.length ? '\n\nCheck:\n• ' + flags.join('\n• ') : '';
    alert('Lumina auto-fill done (LIGHTSTONE).' + body + '\n\nVehicle set to the standard quote car (Suzuki Swift 1.2 GL). Now: review any highlighted/empty required fields, tick the declaration, clear the reCAPTCHA, then Submit.');
  }

  const HANDOFF_PREFIX = 'LUMINA_SIGNIO:';
  function fetchData() {
    if ((window.name || '').startsWith(HANDOFF_PREFIX)) { try { return JSON.parse(window.name.slice(HANDOFF_PREFIX.length)); } catch (e) { flag('Could not read Lumina payload.'); } }
    return window.__LUMINA_APP__ || null;
  }
  run();
})();
