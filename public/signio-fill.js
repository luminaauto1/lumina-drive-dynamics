/* Lumina → Signio Auto-Fill ENGINE — DUAL MODE.
   Signio serves Lumina two different form flavours; this engine detects which one is
   open and fills it accordingly:

   • WIZARD  — goa.signio.co.za/ThirdPartyIntegration/?uuid=…  (Lightstone-branded
     7-step wizard: Basic Info → Vehicle → Personal → Employment → Income/Expenses →
     Declaration → Documents). Identity inputs carry NO name attributes → fill by
     nearest-label; Suburb/City/Postal resolve via the form's Address Lookup widget
     (postal-code-first for accuracy). Payment-history + consent radios have stable
     ids (#debtReviewIndicator-no, #marketing-yes, #itc-yes…). The engine walks steps
     1–5 and STOPS before the Declaration.

   • LIGHTSTONE — thirdparty.signio.co.za/…?skin=LIGHTSTONE (single long page with
     clean field `name` attributes) → fill by NAME, addresses filled DIRECTLY.

   Both modes read the Lumina payload from window.name (set when the "Push to Signio"
   modal opens the tab) and STOP for the human to review, tick the declaration and
   clear the reCAPTCHA before submitting. */
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
  const isPlaceholder = (t) => /not selected|please|^\s*select|^\s*$|choose|unknown/i.test(String(t || '').trim());

  // ---- shared value mappings ------------------------------------------------
  const TITLE = (g, m) => norm(g) === 'female' ? (norm(m) === 'married' ? 'Mrs' : 'Miss') : norm(g) === 'male' ? 'Mr' : null;
  const MARITAL = { single: 'Single', married: 'Married', divorced: 'Divorced', widowed: 'Widow/er', 'widow/er': 'Widow/er', separated: 'Separated' };
  const MARRIAGE_TYPE = { cop: 'In Community of property', 'in community of property': 'In Community of property',
    anc: 'Antenuptual Contract', antenuptial: 'Antenuptual Contract', 'out of community': 'Antenuptual Contract' };
  const ACCOUNT_TYPE = { savings: 'Savings', cheque: 'Cheque', current: 'Cheque', transmission: 'Transmission' };
  const BRANCH_CODE = { capitec: '470010', fnb: '250655', 'first national': '250655', absa: '632005',
    'standard bank': '051001', standard: '051001', nedbank: '198765', tymebank: '678910', tyme: '678910',
    'african bank': '430000', discovery: '679000', investec: '580105', bidvest: '462005',
    'old mutual': '462005' }; // Old Mutual uses the universal branch code 462005
  function bankOptionName(raw) { // match the forms' uppercased bank lists
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
  const parseAmt = (s) => { const m = String(s).replace(/[, ]/g, '').match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
  // Realistic minimum monthly variable living cost for a NET income — ~40% of net,
  // floored at R3 000, capped at R14 000. Tuneable + always flagged when applied.
  const realisticLiving = (net) => { const n = Math.max(0, +net || 0); return Math.min(Math.max(Math.round(n * 0.4 / 100) * 100, 3000), 14000); };
  const firstSegment = (addr) => (addr ? String(addr).split(/[,\n]/)[0].trim() : '');

  /* ══════════════════════════ LIGHTSTONE (single-page) mode ══════════════════════════ */

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
  // Guarantee a required <select> ends on a real option (never the blank default).
  function ensureSelN(name, preferRe) {
    const el = byName(name); if (!el || el.tagName !== 'SELECT') return false;
    if (el.selectedIndex > 0 && el.value && !isPlaceholder((el.options[el.selectedIndex] || {}).text)) return true;
    const real = [...el.options].filter((o) => o.value && !isPlaceholder(o.text));
    const opt = (preferRe && real.find((o) => preferRe.test(o.text))) || real[0];
    if (opt) { setVal(el, opt.value); return true; }
    return false;
  }
  const EMP_STATUS = { permanently_employed: 'Permanent', permanent: 'Permanent', self_employed: 'Self', 'self employed': 'Self',
    contract: 'Contract', contractual: 'Contract', part_time: 'Part', 'part time': 'Part', pensioner: 'Pension', student: 'Student', unemployed: 'Unemployed' };

  // ---- province inference + random in-province location (for the Relative address) ----
  // The relative's City/Suburb/Postal are READ-ONLY on the LIGHTSTONE form (filled via a
  // lookup popup), but a programmatic value-set writes through fine and needs no region
  // code, so we fill a real random town in the CUSTOMER'S province directly.
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

  // ---- LIGHTSTONE expense intelligence (fills by field NAME) ----
  const EXPENSE_CATS_LS = [
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
  function computeExpensesLS(d) {
    const net = +d.net_salary || +d.gross_salary || 0;
    const cleaned = String(d.total_expenses || '').replace(/(?<=\d)[ ,](?=\d{3}(\D|$))/g, '');
    const chunks = cleaned.split(/[,\n;]+|(?<=\d)\s+(?=[A-Za-z])/).map((s) => s.trim()).filter(Boolean);
    const byField = new Map(); let fixedTotal = 0, variableDeclared = 0;
    for (const ch of chunks) {
      const amt = parseAmt(ch); if (!amt) continue;
      const cat = EXPENSE_CATS_LS.find((c) => c.re.test(ch));
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

  // ---- LIGHTSTONE main fill --------------------------------------------------
  async function fillLightstone(d) {
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
      line1: firstSegment(d.street_address).slice(0, 60),
      suburb: d.suburb, city: d.city, postal: d.area_code,
    });
    if (!res.okSub && !res.okPost) flag('Residential suburb/postal missing — fill Residential Suburb/City/Postal on the form.');
    setN('customerResidentialAddressLine1', firstSegment(d.street_address).slice(0, 60));
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
      line1: firstSegment(empFull).slice(0, 60),
      suburb: d.employer_suburb, city: d.employer_city, postal: d.employer_postal_code,
    });
    setN('employerAddressLine1', firstSegment(empFull).slice(0, 60));
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
    const ex = computeExpensesLS(d);
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
    const vehicleOk = await selectFixedVehicleLS('59007082');
    if (vehicleOk) setN('purchasePrice', '220000.00');
    else flag('Could not auto-select the vehicle — click "SELECT VEHICLE", search M&M 59007082, pick it, then set Purchase Price 220000.');
  }

  // Drive the LIGHTSTONE "Vehicle Lookup" modal to select a car by its M&M code.
  async function selectFixedVehicleLS(mm) {
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

  /* ══════════════════════════ WIZARD (7-step goa.signio) mode ══════════════════════════
     Identity inputs carry no name/id attributes → fill by nearest label. Radios DO have
     stable ids (#debtReviewIndicator-no, #marketing-yes, #itc-yes). Suburb/City/Postal/
     Province are read-only and resolve via the Address Lookup widget (postal-code-first). */

  function labelFor(el) {
    let n = el, h = 0;
    while (n && h < 5) { n = n.previousElementSibling || n.parentElement; h++;
      if (n && n.innerText) { const t = n.innerText.trim().split('\n').filter(Boolean)[0]; if (t && t.length < 45) return t; } }
    return '';
  }
  function inputByLabel(re) { return [...document.querySelectorAll('input')].find((el) => re.test(labelFor(el))); }
  function selectByLabel(re) { return [...document.querySelectorAll('select')].find((el) => re.test(labelFor(el))); }
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
  // Guarantee a required <select> ends up with a real choice.
  function ensureSelected(re, preferRe) {
    const el = selectByLabel(re);
    if (!el) return false;
    if (el.selectedIndex > 0 && el.value && !isPlaceholder((el.options[el.selectedIndex] || {}).text)) return true;
    const real = [...el.options].filter((o) => o.value && !isPlaceholder(o.text));
    const opt = (preferRe && real.find((o) => preferRe.test(o.text))) || real[0];
    if (opt) { setVal(el, opt.value); return true; }
    return false;
  }
  function clickButtonText(re) {
    const b = [...document.querySelectorAll('button')].find((x) => re.test(x.innerText.trim()));
    if (b) { b.scrollIntoView({ block: 'center' }); b.click(); }
    return !!b;
  }
  // Click a radio by element id (this wizard gives radios stable ids). Returns success.
  function clickRadioId(id) { const r = document.getElementById(id); if (r && !r.checked) r.click(); return !!r; }
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
  // The single lookup text box (placeholder flips between "Enter suburb name" and "Enter
  // postal code" with the radio). Match by PLACEHOLDER among text inputs — never by label
  // (the radio labels also contain "postal code"). Re-query on demand — never cache (the
  // node is replaced when the mode toggles).
  function lookupBox() {
    return [...document.querySelectorAll('input')].find((e) =>
      (e.type === 'text' || !e.type) && /suburb name|postal code|enter (suburb|postal)/i.test(e.placeholder || ''));
  }
  // Address Lookup: try each candidate (postal code and/or suburb name). Type → Search →
  // click the best result row → wait for the locked Suburb/Town/Postal/Province to fill.
  // Result rows are <button>s whose innerText can read EMPTY → match on textContent; when
  // a postal code is known, prefer the row containing it (Sandton 2146 vs 2196).
  async function addressLookup(candidates, preferPostal) {
    const queries = (Array.isArray(candidates) ? candidates : [candidates])
      .map((c) => (c == null ? '' : String(c).trim())).filter(Boolean);
    if (!queries.length) return false;
    const rowText = (b) => String((b.innerText && b.innerText.trim()) || b.textContent || '').trim();
    for (const q of queries) {
      setSearchMode(/^\d{4}$/.test(q));
      await sleep(300);                 // let the input re-render after the mode switch
      let box = lookupBox();
      if (!box) continue;
      setVal(box, q);
      await sleep(150);
      box = lookupBox();
      if (box && box.value !== String(q)) { setVal(box, q); await sleep(120); }  // retry if the re-render cleared it
      clickButtonText(/^\s*search\s*$/i);
      const btn = await waitFor(() => {
        const rows = [...document.querySelectorAll('button')].filter((b) => {
          const t = rowText(b);
          return t.length > 3 && t.length < 90 && !/^\s*search\s*$/i.test(t) && t.includes(',');
        });
        if (!rows.length) return null;
        return (preferPostal && rows.find((b) => rowText(b).includes(String(preferPostal)))) ||
               rows.find((b) => norm(rowText(b)).includes(norm(q))) || rows[0];
      }, { timeout: 4500 });
      if (!btn) continue;
      btn.click();
      await sleep(900); // let React populate the locked Suburb/City/Postal/Province
      if (suburbFilled()) return true;
    }
    return false;
  }

  const ID_TYPE = (t) => (/passport/i.test(t) ? 'Passport' : 'South African Valid ID');
  const EDUCATION = { matric: 'COMPLETED MATRIC', diploma: 'DIPLOMA', degree: 'BACHELORS DEGREE',
    postgraduate: 'HONOURS OR HIGHER', honours: 'HONOURS OR HIGHER' };
  const EMP_TYPE_WIZ = { permanently_employed: 'Permanent', permanent: 'Permanent', self_employed: 'Self employed',
    'self employed': 'Self employed', contract: 'Contractual', contractual: 'Contractual',
    part_time: 'Part time', 'part time': 'Part time', pensioner: 'Pensioner',
    student: 'Student', unemployed: 'Unemployed' };

  // Employer keyword → this wizard's Industry Type option (59 fixed options, verified
  // live). Without this, "Eskom" matched nothing and the generic fallback landed on
  // "APPAREL AND OTHER TEXTILE PRODUCTS" (its "OTHER" matched the old fallback regex).
  const INDUSTRY_MAP = [
    [/eskom|escom/i, 'ESCOM'],
    [/telkom/i, 'TELKOM'],
    [/electric|power|energy/i, 'ELECTRICITY'],
    [/government|municipal|sars\b|home affairs|dept|department/i, 'GOVERNMENT'],
    [/police|saps\b|security|defen[cs]e|army|guard/i, 'PROTECTIVE SERVICES'],
    [/insurance/i, 'INSURANCE SERVICES'],
    [/bank|financ|invest/i, 'FINANCIAL SERVICES'],
    [/school|college|universit|educat|teach/i, 'EDUCATIONAL SERVICES'],
    [/software|information tech|computer/i, 'INFORMATION TECHNOLOGY'],
    [/construction|builder|building/i, 'BUILDING AND CONSTRUCTION'],
    [/agri|farm/i, 'AGRICULTURE'],
    [/engineer/i, 'ENGINEERING'],
    [/legal|attorney/i, 'LEGAL'],
    [/hotel|lodge|restaurant|catering|guest house/i, 'ACCOMMODATION'],
    [/transport|logistic|courier|freight|taxi/i, 'TRANSPORT INDUSTRY'],
    [/mining|\bmine\b/i, 'MINING'],
    [/medical|clinic|hospital|health/i, 'MEDICAL SERVICES'],
    [/estate agent|property|real estate/i, 'REAL ESTATE'],
    [/retail|supermarket|shop|store/i, 'RETAIL'],
    [/manufactur|factory/i, 'MANUFACTURING'],
    [/repair|workshop|panel beat/i, 'REPAIR SERVICES'],
  ];

  // Next-of-Kin Relation: Lumina's value if present; else "Other"; else first real option.
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

  async function wizBasicInfo(d) {
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
    // Payment History — the 7 adverse-credit questions all "No" (standard clean profile).
    // This wizard gives every radio a stable id (#<name>-yes / #<name>-no) — click by id,
    // never by DOM index (the old index math is kept only as a fallback and once set the
    // marketing consent to "No" by accident).
    const PH = ['debtReviewIndicator', 'debtCounselling', 'administrationOrderIndicator',
      'DebtAdminHist', 'previousJudgementIndicator', 'DebtDisp', 'debtSeqOrder'];
    const phOk = PH.map((n) => clickRadioId(n + '-no')).every(Boolean);
    if (!phOk) { // fallback: first 7 radio PAIRS are the payment-history questions
      const radios = [...document.querySelectorAll('input[type=radio]')];
      for (let k = 0; k < 7; k++) radios[2 * k + 1] && radios[2 * k + 1].click();
    }
    // Consents — BOTH "Yes" (marketing share + credit-bureau access), per the standing
    // owner decision (same as the LIGHTSTONE form's marketingConsentIndicator/itcConcentIndicator).
    const mkOk = clickRadioId('marketing-yes') || clickRadioId('marketingConsentIndicator-yes');
    const itcOk = clickRadioId('itc-yes') || clickRadioId('itcConcentIndicator-yes');
    if (!mkOk || !itcOk) flag('Consent radios not found by id — set BOTH consent questions to "Yes" manually.');
  }

  const FIXED_VEHICLE = {
    condition: 'Used', make: 'SUZUKI', year: '2026',
    model: /SWIFT 1\.2 GL \(/i, mm: '59007082',
    price: '220000', interest: '12', balloon: '35', term: '72 Months',
  };
  async function wizVehicle() {
    const V = FIXED_VEHICLE;
    setSelect(/condition/i, V.condition);
    const makeSel = await waitFor(() => { const s = selectByLabel(/^make$/i); return s && s.options.length > 5 ? s : null; }, { timeout: 15000 });
    if (makeSel) setSelect(/^make$/i, V.make, { contains: true });
    const yearSel = await waitFor(() => { const s = selectByLabel(/^year$/i); return s && s.options.length > 2 ? s : null; }, { timeout: 15000 });
    if (yearSel) setSelect(/^year$/i, V.year);
    const modelSel = await waitFor(() => { const s = selectByLabel(/^model$/i); return s && s.options.length > 1 ? s : null; }, { timeout: 15000 });
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
    // The form resolves the chosen model to its M&M code ASYNCHRONOUSLY ("Vehicle
    // Selected" panel). On a cold cache that takes several seconds, and Next silently
    // no-ops until it lands — so wait for the MM code to appear before moving on.
    await waitFor(() => [...document.querySelectorAll('input')].some((i) => (i.value || '').replace(/\D/g, '') === V.mm), { timeout: 12000 });
  }

  async function wizPersonal(d) {
    setSelect(/country of birth/i, d.country_of_birth || 'SOUTH AFRICA', { contains: true });
    setSelect(/nationality/i, d.nationality || 'SOUTH AFRICA', { contains: true });
    setSelect(/gender/i, d._gender || d.gender);
    setSelect(/education/i, EDUCATION[norm(d.qualification)] || null, { contains: true });
    setSelect(/marital status/i, MARITAL[norm(d.marital_status)] || null);
    // Address Line 1 = the street line only — suburb/city/postal live in their own
    // (lookup-resolved) fields, so the old full-blob fill just duplicated + truncated them.
    if (d.street_address) setText(/address line 1/i, firstSegment(d.street_address).slice(0, 50));
    // SUBURB-first here (the customer states their real suburb; the postal only picks the
    // right row among duplicates, e.g. Sandton 2196 vs 2146). Postal-first is correct only
    // for the EMPLOYER lookup, where the "suburb" is often a building/complex name.
    const resOk = await addressLookup([d.suburb, d.area_code], d.area_code);
    if (!resOk) flag('Residential address not auto-resolved — in the Address Lookup box type the suburb or postal code, Search, and pick the result (fills Suburb/Town/Postal/Province).');
    if (d.years_at_address != null) setText(/^years$/i, d.years_at_address); else setText(/^years$/i, '3');
    setText(/^months$/i, d.months_at_address != null ? d.months_at_address : '0');
    if (norm(d.marital_status) === 'married') {
      setSelect(/marital contract|marriage type/i, MARRIAGE_TYPE[norm(d.marriage_type)] || d.marriage_type, { contains: true });
      setText(/spouse first/i, d.spouse_first_name);
      setText(/spouse surname/i, d.spouse_surname);
    }
    // Relation: Lumina rarely captures it — default to a safe option so the required
    // field never blocks the step; flagged for the human either way.
    const relSet = selectRelation(d.kin_relation);
    if (!d.kin_relation && relSet) flag('Next-of-Kin Relation defaulted (not captured in Lumina) — change it on the form if you know it.');
    else if (!relSet) flag('Next-of-Kin "Relation" could not be set — pick it on the form (required).');
    if (d.kin_first_name) setText(/^first name$/i, d.kin_first_name);
    if (d.kin_surname) setText(/^surname$/i, d.kin_surname);
    setSelect(/contact method/i, 'Cellphone');
    if (d.kin_contact) setText(/phone number/i, d.kin_contact);
  }

  async function wizEmployment(d) {
    setText(/employer name/i, d.employer_name);
    setSelect(/employment level/i, d.employment_level || 'Skilled Worker', { contains: true });
    ensureSelected(/employment level/i, /skilled|semi|other/i);
    setSelect(/salary payment date/i, d.salary_day || '25', { contains: true });
    ensureSelected(/salary payment date/i);
    // Occupation: fuzzy-match the job title; if no overlap, pick a sensible fallback so the
    // required select is never blank — but FLAG it (a guessed occupation must be verified).
    if (!setSelectFuzzy(/occupation/i, d.job_title)) {
      ensureSelected(/occupation/i, /other|general|admin|clerical|operator|labour|worker|assistant/i);
      flag('Occupation "' + (d.job_title || '(blank)') + '" had no exact match — a generic option was selected; verify Occupation before submit.');
    }
    // Industry: keyword map first (ESCOM/ELECTRICITY/GOVERNMENT/…), then fuzzy, then the
    // honest "UNKNOWN" option — NEVER a regex fallback that can land on "APPAREL AND
    // OTHER TEXTILE PRODUCTS" (the old /other/ fallback did exactly that).
    const indSrc = [d.industry, d.employer_name].filter(Boolean).join(' ');
    let indSet = false;
    for (const [re, opt] of INDUSTRY_MAP) { if (re.test(indSrc)) { indSet = setSelect(/employer industry/i, opt, { contains: true }); if (indSet) break; } }
    if (!indSet) indSet = !!setSelectFuzzy(/employer industry/i, d.industry || d.employer_name);
    if (!indSet) {
      // Direct setSelect — NOT ensureSelected: the shared isPlaceholder() treats
      // "UNKNOWN" as a placeholder, so a prefer-regex could never land on it and
      // would fall back to the first option alphabetically (APPAREL/ACCOMMODATION).
      setSelect(/employer industry/i, 'UNKNOWN') || ensureSelected(/employer industry/i, /business services/i);
      flag('Employer industry for "' + (d.employer_name || '') + '" not matched — set to UNKNOWN; pick the right Industry Type.');
    }
    // Employment type + client type: ALWAYS an explicit choice, never the blank default.
    const empType = EMP_TYPE_WIZ[norm(d.employment_type)] || 'Permanent';
    const isSelf = /self/i.test(empType) || /self/i.test(String(d.employment_type || ''));
    if (!setSelect(/employment type/i, empType, { contains: true })) ensureSelected(/employment type/i, isSelf ? /self/i : /permanent|full/i);
    if (!setSelect(/client type/i, isSelf ? 'Self employed' : 'Private Individual', { contains: true })) ensureSelected(/client type/i, isSelf ? /self/i : /private|individual/i);
    // Employer address — prefer the Google-resolved business address; postal-first lookup
    // (the postal is the reliable key; a suburb/building name is the fallback).
    const empAddr = String(d.business_address_auto || d.employer_address || '').trim();
    if (empAddr) setText(/^address 1$|address line 1/i, firstSegment(empAddr).slice(0, 50));
    // LAST 4-digit token = the trailing SA postal (never a 4-digit street number).
    const empPostal = d.employer_postal_code || d.employer_area_code || (empAddr.match(/\b\d{4}\b/g) || []).pop() || '';
    const empCandidates = [empPostal, d.employer_suburb].map((x) => (x == null ? '' : String(x).trim())).filter(Boolean);
    if (empCandidates.length) {
      const eOk = await addressLookup(empCandidates, empPostal);
      if (!eOk) flag('Employer address not auto-resolved — pick the suburb/postal in the employer Address Lookup.');
    } else {
      flag('No employer suburb/postal on file — fill the employer Address Lookup manually.');
    }
    // Bank details
    setText(/account holder/i, d.full_name);
    setSelect(/account type/i, ACCOUNT_TYPE[norm(d.account_type)] || d.account_type || 'Savings', { contains: true });
    ensureSelected(/account type/i, /savings|cheque/i);
    const bank = bankOptionName(d.bank_name);
    if (!setSelectFuzzy(/bank name|^bank$/i, bank || d.bank_name)) flag('Bank "' + (d.bank_name || '') + '" not matched — pick the bank manually.');
    setText(/account number/i, d.account_number);
    const bc = branchCodeFor(d.bank_name);
    if (bc) setText(/branch code/i, bc); else flag('No branch code for bank "' + (d.bank_name || '') + '".');
    setText(/branch name/i, bank || d.bank_name || '');
    const py = String(d.employment_period || '').match(/(\d+)\s*year/i);
    const pmo = String(d.employment_period || '').match(/(\d+)\s*month/i);
    setText(/^years$/i, py ? py[1] : '1');
    setText(/^months$/i, pmo ? pmo[1] : '0');
  }

  // ---- wizard expense intelligence (fills by field LABEL on the Income step) ----
  const EXPENSE_CATS_WIZ = [
    { re: /bond|home\s*loan|mortgage/i,                          field: /bond/i,                 fixed: true },
    { re: /\brent\b|lease|accommodation/i,                       field: /^\s*rent\s*$/i,         fixed: true },
    { re: /rates|water|electric|lights|municipal|utilit/i,       field: /rates|water|electric/i, fixed: true },
    { re: /vehicle|car\s*(finance|instal|payment)|instal?ment/i, field: /vehicle instal/i,       fixed: true },
    { re: /personal\s*loan|micro\s*loan|\bloan\b/i,              field: /personal loan/i,        fixed: true },
    { re: /credit\s*card/i,                                      field: /credit card/i,          fixed: true },
    { re: /furniture|appliance/i,                                field: /furniture/i,            fixed: true },
    { re: /clothing|clothes|\baccounts?\b|retail|store\s*card/i,  field: /clothing/i,             fixed: true },
    { re: /overdraft/i,                                          field: /overdraft/i,            fixed: true },
    { re: /policy|insurance|funeral|medical\s*aid/i,             field: /policy|insurance/i,     fixed: true },
    { re: /telephone|airtime|\bdata\b|cell\s*phone/i,            field: /telephone/i,            fixed: false },
    { re: /transport|fuel|petrol|diesel|taxi|travel/i,           field: /transport/i,            fixed: false },
  ];
  function computeExpensesWiz(d) {
    const net = +d.net_salary || +d.gross_salary || 0;
    // Strip thousands separators ("R5,000" → 5000) BEFORE chunking so a separator is
    // never mistaken for an item delimiter; then sum per category.
    const cleaned = String(d.total_expenses || '').replace(/(?<=\d)[ ,](?=\d{3}(\D|$))/g, '');
    const chunks = cleaned.split(/[,\n;]+|(?<=\d)\s+(?=[A-Za-z])/).map((s) => s.trim()).filter(Boolean);
    const fixed = new Map(), variableLines = new Map();
    let fixedTotal = 0, variableDeclared = 0;
    for (const ch of chunks) {
      const amt = parseAmt(ch); if (!amt) continue;
      const cat = EXPENSE_CATS_WIZ.find((c) => c.re.test(ch));
      if (cat) {
        (cat.fixed ? fixed : variableLines).set(cat.field, ((cat.fixed ? fixed : variableLines).get(cat.field) || 0) + amt);
        if (cat.fixed) fixedTotal += amt; else variableDeclared += amt;
      } else { variableDeclared += amt; } // unlabelled / groceries / misc → variable "Other"
    }
    let variable = variableDeclared, adjusted = false;
    const floor = realisticLiving(net);
    if (net > 0 && variable < floor) { variable = floor; adjusted = true; }          // raise implausibly-low living costs
    if (net > 0) { const cap = Math.max(0, Math.round(net * 0.92) - fixedTotal); if (cap > 0 && variable > cap) { variable = cap; adjusted = true; } } // keep disposable believable
    // Scale itemised variable lines so they fit the final `variable` total.
    const declaredVarLine = [...variableLines.values()].reduce((a, b) => a + b, 0);
    const scale = declaredVarLine > 0 ? Math.min(1, variable / declaredVarLine) : 1;
    const byField = new Map(fixed);
    let scaledVar = 0;
    for (const [field, amt] of variableLines) { const v = Math.round(amt * scale); byField.set(field, v); scaledVar += v; }
    const otherExpenses = Math.max(0, Math.round(variable - scaledVar));
    return { byField, otherExpenses, total: Math.round(fixedTotal + variable), adjusted };
  }
  async function wizIncomeExpenses(d) {
    if (+d.gross_salary && +d.net_salary && +d.net_salary > +d.gross_salary)
      flag('Net salary (' + d.net_salary + ') > Gross (' + d.gross_salary + ') — likely swapped; verify before submit.');
    setText(/gross remuneration/i, d.gross_salary);
    setText(/net take-home|net take home/i, d.net_salary);
    setText(/other income/i, d.additional_income || '0');
    const ex = computeExpensesWiz(d);
    let other = ex.otherExpenses;
    for (const [field, amt] of ex.byField) {
      if (amt > 0 && !setText(field, Math.round(amt))) other += Math.round(amt);
    }
    if (other > 0) setText(/other expenses/i, other);
    if (ex.adjusted) flag('Variable living expenses normalised to a realistic level for the income (≈ R' + ex.total + ' total) — adjust on the form if needed.');
  }

  function wizStep() {
    const t = document.body.innerText;
    if (/Payment History/.test(t) && document.querySelector('select')) return 'basic';
    if (/Vehicle Lookup|Vehicle Selected|Article Details/.test(t)) return 'vehicle';
    if (/Residential Address|Next of Kin/.test(t)) return 'personal';
    if (/Employer Details|Employer Address/.test(t)) return 'employment';
    if (/Disposable Income|Gross Remuneration|TOTAL Expenses|Income Details/.test(t)) return 'income';
    if (/true and correct/.test(t)) return 'declaration';
    if (/Drag and Drop|Document Category/.test(t)) return 'documents';
    return 'unknown';
  }

  // Walk the wizard: fill each step once, click Next, stop on Income (the last
  // auto-fillable step) or wherever validation refuses to advance.
  async function runWizard(d) {
    const fills = { basic: wizBasicInfo, vehicle: wizVehicle, personal: wizPersonal,
      employment: wizEmployment, income: wizIncomeExpenses };
    await waitFor(() => document.querySelectorAll('select').length >= 2, { timeout: 10000 });
    let filledStep = null;     // fill each step ONCE (no glitchy re-fill loop)
    let stuckStep = null;      // the step we couldn't advance past (needs human input)
    for (let i = 0; i < 10; i++) {
      let step = wizStep();
      if (step === 'unknown') { await sleep(700); step = wizStep(); }
      if (step === 'declaration' || step === 'documents') break;
      const fn = fills[step];
      if (!fn) { console.warn('[Lumina] unknown step — stopping for human.'); stuckStep = step; break; } // never report "done" here
      if (step !== filledStep) { await fn(d); filledStep = step; await sleep(400); }
      if (step === 'income') break; // last auto-fill step; human reviews + submits
      clickButtonText(/^next$/i);
      let advanced = await waitFor(() => wizStep() !== step, { timeout: 9000 });
      if (!advanced) {
        // Slow async validation (e.g. the vehicle M&M resolution) can swallow the first
        // Next — retry once if we're genuinely still on the same step before giving up.
        if (wizStep() === step) clickButtonText(/^next$/i);
        advanced = await waitFor(() => wizStep() !== step, { timeout: 9000 });
      }
      if (!advanced) { stuckStep = step; break; } // required field we can't fill — stop cleanly
      await sleep(500);
    }
    const head = stuckStep
      ? 'Filled everything I could, then stopped on the "' + stuckStep + '" step — it has required fields I can\'t fill from your data.'
      : 'Lumina auto-fill done.';
    const tail = stuckStep
      ? '\n\nComplete the highlighted required fields above, then click Next and continue. Everything else is already filled.'
      : '\n\nVehicle is set to the standard quote car (Suzuki Swift 1.2 GL). Review each step, tick the declaration, then Submit.';
    const body = flags.length ? '\n\nAlso check:\n• ' + flags.join('\n• ') : '';
    alert(head + body + tail);
  }

  /* ══════════════════════════ mode detection + run ══════════════════════════ */

  async function run() {
    flags = [];
    const d = fetchData();
    if (!d) { alert('No Lumina application data found.\n\nIn Lumina click "Push to Signio" → "Open Signio form", then click this bookmark on that tab.'); return; }
    // The Lumina settings can DECLARE which system a link uses (payload.signio_system,
    // set per-link in Admin → Settings → Signio links). Trust the declaration as soon
    // as that form's markers actually mount; if they never do (misconfigured link),
    // fall back to auto-detection below.
    const declared = norm(d.signio_system || '');
    const declaredMode = /light|single|one/.test(declared) ? 'lightstone'
      : /wizard|step|goa/.test(declared) ? 'wizard' : null;
    let mode = null;
    if (declaredMode) {
      // Confirm the declaration against STABLE markers only. Do NOT consult wizStep()
      // here — the LIGHTSTONE page also shows "Payment History" text, so a text-based
      // check would CONFIRM a wrong "wizard" declaration and misroute the fill. With
      // stable markers, a wrong declaration just times out and auto-detection below
      // routes it correctly (slower, never broken).
      mode = await waitFor(() => declaredMode === 'lightstone'
        ? (byName('customerIdNumber') ? 'lightstone' : null)
        : (document.getElementById('debtReviewIndicator-yes') ? 'wizard' : null),
      { timeout: 15000 });
      if (!mode) flag('Link is configured as "' + declared + '" but that form never appeared — auto-detected instead.');
    }
    // Auto-detect: LIGHTSTONE exposes named fields; the wizard has id'd Payment History
    // radios on step 1. Poll ONLY those stable markers — the LIGHTSTONE page also
    // contains a "Payment History" heading, so a text check inside the poll could
    // misroute a still-loading LIGHTSTONE page down the wizard path. Text/step
    // heuristics run only AFTER the poll times out (e.g. the bookmark is clicked
    // mid-wizard on a later step, where the step-1 radios no longer exist).
    if (!mode) mode = await waitFor(() => {
      if (byName('customerIdNumber')) return 'lightstone';
      if (document.getElementById('debtReviewIndicator-yes')) return 'wizard';
      return null;
    }, { timeout: 15000 }) || (wizStep() !== 'unknown' ? 'wizard' : null);
    if (!mode) { alert('This does not look like a Signio application form (nothing fillable found) — open the form first, then click the bookmark.'); return; }
    if (mode === 'wizard') { await runWizard(d); return; }
    try { await fillLightstone(d); } catch (e) { console.error('[Lumina]', e); flag('Engine error: ' + (e && e.message)); }
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
