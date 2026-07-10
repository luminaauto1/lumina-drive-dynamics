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
    thyme: '678910', 'time bank': '678910', // clients spell TymeBank as "Thymebank"/"Time Bank"
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
    if (/discover/.test(k)) return 'DISCOVERY BANK';
    if (/tyme|thyme|timebank/.test(k)) return 'TYME BANK';
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

  // Employment tenure: applicants enter EITHER a duration ("4 years 2 months") OR
  // the YEAR they started ("2019", "since 2019", "03/2019"). A start year is
  // translated into elapsed time so the forms always receive a real tenure.
  function parseEmploymentPeriod(raw) {
    const s = norm(String(raw == null ? '' : raw));
    if (!s) return null;
    const now = new Date();
    const hasDurationWord = /year|yr\b|month|jaar|maand/.test(s);
    const ym = s.match(/\b(19[6-9]\d|20[0-4]\d)\b/);
    if (ym && !hasDurationWord) {
      const y = parseInt(ym[1], 10);
      if (y <= now.getFullYear()) {
        // optional month in "03/2019" or "2019/03" style
        const mA = s.match(/\b(0?[1-9]|1[0-2])\s*[\/\-]\s*(19[6-9]\d|20[0-4]\d)\b/);
        const mB = s.match(/\b(19[6-9]\d|20[0-4]\d)\s*[\/\-]\s*(0?[1-9]|1[0-2])\b/);
        const startMonth = mA ? parseInt(mA[1], 10) - 1 : mB ? parseInt(mB[2], 10) - 1 : 0;
        let months = (now.getFullYear() - y) * 12 + (now.getMonth() - startMonth);
        months = Math.max(0, Math.min(months, 50 * 12));
        return { years: Math.floor(months / 12), months: months % 12, fromYear: y };
      }
    }
    const py = s.match(/(\d+)\s*(?:year|yr|jaar)/);
    const pm = s.match(/(\d+)\s*(?:month|maand)/);
    if (py || pm) return { years: py ? +py[1] : 0, months: pm ? +pm[1] : 0, fromYear: null };
    const bare = s.match(/^\s*(\d{1,2})\s*$/);
    if (bare && +bare[1] <= 50) return { years: +bare[1], months: 0, fromYear: null };
    return null;
  }

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

  // (Expense computation for LIGHTSTONE + Direct Submit lives in computeExpensesSmart
  //  in the BOARDROOM section below — one realistic category split shared by both.)

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
    // Employer/work number (Google-resolved when Lumina had none) — fields are a no-op
    // if this form variant doesn't render them.
    const wpLS = phoneKind(d.employer_phone || d.workplace_cell_no || '');
    if (wpLS.num) { setN('customerWorkPhoneNumber', wpLS.num); if (wpLS.kind) setSelN('customerWorkPhoneNumberType', wpLS.kind); }
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
    const tenure = parseEmploymentPeriod(d.employment_period);
    if (tenure && tenure.fromYear) flag('Employment "' + d.employment_period + '" read as started ' + tenure.fromYear + ' → filled as ' + tenure.years + 'y ' + tenure.months + 'm.');
    setN('customerPeriodAtCurrentEmployerYears', tenure ? tenure.years : 1);
    setN('customerPeriodAtCurrentEmployerMonths', tenure ? tenure.months : 0);

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

    // Expenses — the realistic category split (shared with Direct Submit): declared
    // fixed items stay as declared; everyday living is split across Food/Transport/
    // Telephone/Household on the low side instead of lumping into one line.
    const ex = computeExpensesSmart(d);
    for (const [name, amt] of ex.byField) {
      if (amt <= 0) continue;
      // Rent renders as `rentPayment` for Tenants on this form; fall back to the total field.
      if (name === 'sumExpensesCustomerRent') { setN('rentPayment', Math.round(amt)) || setN(name, Math.round(amt)); continue; }
      setN(name, Math.round(amt));
    }
    if (ex.adjusted) flag('Expenses split across realistic categories (≈ R' + ex.total + ' total, low side) — adjust any line if needed.');

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
    [/retail|supermarket|shop|store|spaza|tuck\s*shop|tavern/i, 'RETAIL'],
    [/manufactur|factory/i, 'MANUFACTURING'],
    [/repair|workshop|panel beat|mechanic/i, 'REPAIR SERVICES'],
    [/hair|salon|beauty|barber|spa\b|nails?\b|makeup|tattoo/i, 'PERSONAL SERVICES'],
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
    const tenure = parseEmploymentPeriod(d.employment_period);
    if (tenure && tenure.fromYear) flag('Employment "' + d.employment_period + '" read as started ' + tenure.fromYear + ' → filled as ' + tenure.years + 'y ' + tenure.months + 'm.');
    setText(/^years$/i, String(tenure ? tenure.years : 1));
    setText(/^months$/i, String(tenure ? tenure.months : 0));
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

  /* ══════════════════════════ BOARDROOM (Signio Direct Submit) mode ══════════════════════════
     lightstone.signio.co.za/Signing-Boardroom — the dealer's own e-application ("Lumina Auto
     Application Form"). Classic jQuery page (not React) with ~650 NAMED fields (same
     customer- and sumExpenses-prefixed vocabulary as LIGHTSTONE), suburb/postal resolved via an
     "Address Lookup" jQuery dialog (#searchSuburb → #selectSuburb → #selectCode → OK) that
     also sets the hidden region codes, vehicles via the same M&M modal, and a Dealer Extras
     table (#addExtraButton → extraDescription_N/extraAmtInclVat_N).
     NEVER touches Print/Forward/Save/Save & Release — the human submits. */

  const squash = (s) => norm(s).replace(/[^a-z0-9]/g, '');
  function setSelSquash(name, target) {
    const el = byName(name); if (!el || el.tagName !== 'SELECT' || !target) return false;
    const o = [...el.options].find((x) => squash(x.text) === squash(target));
    if (o) { setVal(el, o.value); return true; }
    return false;
  }
  const vis = (el) => !!(el && el.offsetParent);
  // Deterministic per-client "random" (stable across re-runs of the same client).
  function seededRand(seed) {
    let h = 2166136261; const s = String(seed || 'x');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  }
  // SA number → local 0XXXXXXXXX + Land line vs Cell (06x/07x/081-084 are mobile).
  function phoneKind(raw) {
    let p = String(raw || '').replace(/\D/g, '');
    if (p.startsWith('27')) p = '0' + p.slice(2);
    if (!/^0\d{9}/.test(p)) return { num: p, kind: null };
    return { num: p.slice(0, 10), kind: /^0(6\d|7\d|8[1-4])/.test(p) ? 'Cell' : 'Land line' };
  }
  // Time at current address: 5–12 years, scaled by the client's age (older → longer),
  // with a seeded ±1 wobble so it varies per client but is stable on re-fill.
  function yearsAtAddressFor(d) {
    const r = seededRand(d.id_number || d.phone || 'lumina');
    const dob = dobFromId(d.id_number);
    let age = 32;
    if (dob) age = new Date().getFullYear() - parseInt(dob.slice(0, 4), 10);
    const t = Math.min(Math.max((age - 22) / 40, 0), 1); // 22 → young end, 62+ → top end
    let years = 5 + Math.round(t * 7 + (r() * 2 - 1));
    years = Math.min(12, Math.max(5, years));
    return { years, months: Math.floor(r() * 12) };
  }
  // Residential Address 1 = street number + name ONLY; Address 2 = the unit/complex/
  // estate part when the client has one (never the suburb — that comes via the lookup).
  function splitResLines(full) {
    const segs = String(full || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
    if (!segs.length) return { line1: '', line2: '' };
    const unitRe = /\b(unit|flat|apartment|apt|estate|complex|block|door|room|suite|villa|no\.?\s*\d+[a-z]?$)\b/i;
    if (segs.length >= 2 && unitRe.test(segs[0]) && !unitRe.test(segs[1])) {
      return { line1: segs[1].slice(0, 50), line2: segs[0].slice(0, 50) };
    }
    const line1 = segs[0].slice(0, 50);
    const line2 = segs.length >= 2 && unitRe.test(segs[1]) ? segs[1].slice(0, 50) : '';
    return { line1, line2 };
  }

  /* ---- smart employment classification (the bank-accuracy fix) ----
     Derives Status / Client Type / Level / Occupation / Industry / employer name as a
     CONSISTENT story: self-employed people get "Self-Employed" as employer, Senior
     Management level and the right professional/non-professional client type;
     pensioners get Pensioner everywhere; employed people get a level inferred from
     their actual job title instead of a blanket default. */
  const PROFESSIONAL_RE = /doctor|dentist|surgeon|lawyer|attorney|advocate|accountant|auditor|engineer|architect|pharmacist|psycholog|optometr|veterinar|actuar|radiolog|physio/;
  function classifyEmployment(d) {
    const t = norm(d.employment_type), title = norm(d.job_title || ''), emp = norm(d.employer_name || '');
    const kind =
      /self/.test(t) || /self.?employ|own\s+business|business\s+owner|sole\s+(prop|owner|trader)/.test(title + ' ' + emp) ? 'self'
      : /pension|retir/.test(t + ' ' + title + ' ' + emp) ? 'pensioner'
      : /student/.test(t + ' ' + title) ? 'student'
      : /unemploy/.test(t + ' ' + emp) ? 'unemployed'
      : /contract/.test(t) ? 'contract'
      : /part[\s_-]?time|^part/.test(t) ? 'part'
      : 'permanent';
    const levelFromTitle = () =>
      /director|owner|\bceo\b|\bcfo\b|\bcoo\b|managing|executive|principal|proprietor/.test(title) ? 'Senior Management'
      : /manager|manageress|head\s+of|\bhod\b/.test(title) ? 'Management'
      : /supervisor|foreman|team\s*lead/.test(title) ? 'Supervisor'
      : /labou?rer|general\s*worker|cleaner|packer|picker|gardener|farm\s*worker|helper/.test(title) ? 'Unskilled Worker'
      : /operator|driver|machinist|assembler|apprentice|guard|porter|waiter|waitress|barman/.test(title) ? 'Semi-Skilled Worker'
      : /admin|clerk|cashier|recept|assistant|intern|junior|call\s*cent|teller/.test(title) ? 'Junior Position'
      : 'Skilled Worker';
    if (kind === 'self') {
      const prof = PROFESSIONAL_RE.test(title);
      return {
        kind, status: 'Self employed', employerName: 'Self-Employed',
        clientType: prof ? 'Self Employed(Professional)' : 'Self Employed(Non-professional)',
        level: 'Senior Management',
        occupationPrefs: [d.job_title, prof ? 'Self Employed(Professional)' : 'Self Employed(non-professional)', 'Self Employed', 'Sole Owner'],
        industrySource: [d.industry, d.job_title, d.employer_name].filter(Boolean).join(' '),
        useResidentialAddress: !(d.business_address_auto || d.employer_address),
        notes: ['Self-employed: employer "Self-Employed", level Senior Management, client type ' + (prof ? 'Professional' : 'Non-professional') + '.'],
      };
    }
    if (kind === 'pensioner') {
      return {
        kind, status: 'Pensioner', employerName: 'Pensioner', clientType: 'Private Individual',
        level: 'Skilled Worker', occupationPrefs: ['Pensioner', 'Retired'],
        industrySource: '', useResidentialAddress: true,
        notes: ['Pensioner: employer/occupation "Pensioner", industry UNKNOWN, employer address = residential. Confirm income is pension.'],
      };
    }
    if (kind === 'student') {
      return {
        kind, status: 'Student', employerName: 'Student', clientType: 'Private Individual',
        level: 'Junior Position', occupationPrefs: ['Student'], industrySource: '',
        useResidentialAddress: true, notes: ['Student applicant — banks usually need a co-signed/joint application; verify.'],
      };
    }
    if (kind === 'unemployed') {
      return {
        kind, status: 'Unemployed', employerName: 'Unemployed', clientType: 'Private Individual',
        level: 'Unskilled Worker', occupationPrefs: ['Unemployed', 'Housewife'], industrySource: '',
        useResidentialAddress: true, notes: ['UNEMPLOYED applicant — finance is unlikely to be approved; double-check before submitting.'],
      };
    }
    return {
      kind, status: kind === 'contract' ? 'Contractual' : kind === 'part' ? 'Part time' : 'Permanent',
      employerName: d.employer_name, clientType: 'Private Individual', level: levelFromTitle(),
      occupationPrefs: [d.job_title], industrySource: [d.industry, d.employer_name, d.job_title].filter(Boolean).join(' '),
      useResidentialAddress: false, notes: [],
    };
  }

  /* ---- smart expense split (realistic categories, low side) ----
     Declared FIXED obligations (rent/bond/vehicle/loans/cards/policies/school…) go to
     their own lines exactly as declared. Everyday variable living is SPLIT across
     Food & Entertainment / Transport / Telephone / Household — everyone has these —
     sized against NET income (low side), never below a small realistic floor, and a
     modest policy/funeral line is added when no insurance was declared. A client's own
     number for a category always wins when it's higher than the baseline. */
  const EXP_FIXED_CATS = [
    [/bond|home\s*loan|mortgage/i, 'sumExpensesCustomerBondPayment'],
    [/\brent\b|lease|accommodation/i, 'sumExpensesCustomerRent'],
    [/rates|water|electric|lights|municipal|utilit/i, 'sumExpensesCustomerRates'],
    [/vehicle|car\s*(finance|instal|payment)|instal?ment/i, 'sumExpensesCustomerVehicleInstallments'],
    [/personal\s*loan|micro\s*loan|\bloan\b/i, 'sumExpensesCustomerLoanRepayments'],
    [/credit\s*card/i, 'sumExpensesCustomerCreditCardRepayments'],
    [/furniture|appliance/i, 'sumExpensesCustomerFurnitureAccounts'],
    [/clothing|clothes|\baccounts?\b|retail|store\s*card/i, 'sumExpensesCustomerClothingAccounts'],
    [/overdraft/i, 'sumExpensesCustomerOverdraftRepayments'],
    [/policy|insurance|funeral|medical\s*aid/i, 'sumExpensesCustomerInsurancePayments'],
    [/school|education|tuition|creche|day\s*care|varsity/i, 'sumExpensesCustomerEducationCosts'],
    [/maintenance|alimony/i, 'sumExpensesCustomerMaintenance'],
    [/security|armed\s*response/i, 'sumExpensesCustomerSecurity'],
  ];
  const EXP_VAR_CATS = [
    [/telephone|airtime|\bdata\b|cell|wifi|internet/i, 'sumExpensesCustomerTelephonePayments'],
    [/transport|fuel|petrol|diesel|taxi|uber|travel/i, 'sumExpensesCustomerTransport'],
    [/food|grocer|entertain|eating|takeaway/i, 'sumExpensesCustomerFoodAndEntertainment'],
    [/household|cleaning|domestic|dstv|subscript|toiletr/i, 'sumExpensesCustomerHouseholdExpenses'],
  ];
  function computeExpensesSmart(d) {
    const net = +d.net_salary || +d.gross_salary || 0;
    const round50 = (v) => Math.round(v / 50) * 50;
    const F = {};
    const add = (n, a) => { const v = Math.round(a); if (v > 0) F[n] = (F[n] || 0) + v; };
    // 1) parse the declared summary into fixed lines / per-category variable / loose.
    const cleaned = String(d.total_expenses || '').replace(/(?<=\d)[ ,](?=\d{3}(\D|$))/g, '');
    const chunks = cleaned.split(/[,\n;]+|(?<=\d)\s+(?=[A-Za-z])/).map((s) => s.trim()).filter(Boolean);
    const decVar = {}; let loose = 0, fixedTotal = 0;
    for (const ch of chunks) {
      const amt = parseAmt(ch); if (!amt) continue;
      const fc = EXP_FIXED_CATS.find((c) => c[0].test(ch));
      if (fc) { add(fc[1], amt); fixedTotal += amt; continue; }
      const vc = EXP_VAR_CATS.find((c) => c[0].test(ch));
      if (vc) decVar[vc[1]] = (decVar[vc[1]] || 0) + amt; else loose += amt;
    }
    // 2) low-side realistic baselines for the four everyday categories.
    const pct = (p, lo, hi) => Math.min(Math.max(round50(net * p), lo), hi);
    const base = net > 0 ? {
      sumExpensesCustomerFoodAndEntertainment: pct(0.15, 1200, 4500),
      sumExpensesCustomerTransport: pct(0.085, 600, 2500),
      sumExpensesCustomerTelephonePayments: pct(0.025, 200, 800),
      sumExpensesCustomerHouseholdExpenses: pct(0.05, 300, 1500),
    } : {};
    const LOW_MIN = { sumExpensesCustomerFoodAndEntertainment: 800, sumExpensesCustomerTransport: 400,
      sumExpensesCustomerTelephonePayments: 150, sumExpensesCustomerHouseholdExpenses: 200 };
    // 3) merge: client's own category number wins when higher; a lone unlabelled total
    //    is distributed across the four categories by baseline weights.
    const baseSum = Object.values(base).reduce((a, b) => a + b, 0) || 1;
    let adjusted = false;
    const varF = {};
    for (const k of Object.keys(base)) {
      const dec = decVar[k] || 0;
      const distributed = loose > 0 ? round50(loose * (base[k] / baseSum)) : 0;
      varF[k] = Math.max(dec, loose > 0 ? Math.max(distributed, LOW_MIN[k]) : base[k]);
      if (!dec) adjusted = true;
    }
    for (const k of Object.keys(decVar)) if (!(k in varF)) varF[k] = decVar[k];
    // 4) a modest policy/funeral line when none declared (near-universal in SA).
    if (net > 0 && !F['sumExpensesCustomerInsurancePayments']) {
      add('sumExpensesCustomerInsurancePayments', Math.min(Math.max(round50(net * 0.015), 150), 450));
      adjusted = true;
    }
    // 5) affordability guard: fixed + variable stays ≤ ~62% of net (scale variable, keep floors).
    let varTotal = Object.values(varF).reduce((a, b) => a + b, 0);
    if (net > 0) {
      const cap = Math.max(0, Math.round(net * 0.62) - fixedTotal - (F['sumExpensesCustomerInsurancePayments'] || 0));
      if (cap > 0 && varTotal > cap) {
        const s = cap / varTotal;
        for (const k in varF) varF[k] = Math.max(round50(varF[k] * s), 100);
        adjusted = true;
      }
    }
    for (const k in varF) add(k, varF[k]);
    const total = Object.values(F).reduce((a, b) => a + b, 0);
    return { byField: new Map(Object.entries(F)), total, adjusted };
  }

  // ---- Boardroom Address Lookup dialog (suburb search → suburb pick → POSTAL pick → OK).
  // The postal-code dropdown (#selectCode) is where the client's actual postal code is
  // enforced — a suburb name can map to several codes and the wrong one upsets the banks.
  async function boardAddressLookup(btnId, suburb, postal) {
    const btn = document.getElementById(btnId); if (!btn) return false;
    btn.click();
    const dlg = await waitFor(() => [...document.querySelectorAll('.ui-dialog')].find((x) => vis(x) && /address lookup/i.test(x.innerText)) || null, { timeout: 6000 });
    if (!dlg) return false;
    const q = (sel) => dlg.querySelector(sel);
    const close = () => { const c = dlg.querySelector('.ui-dialog-titlebar-close'); if (c) c.click(); };
    const resultsIn = (s) => s && s.options.length > 0 && ![...s.options].every((o) => /0 results|no result|^\s*$/i.test(o.text));
    const doSearch = async (inputSel, btnSel, value) => {
      if (!value) return false;
      setVal(q(inputSel), value);
      q(btnSel).click();
      return !!(await waitFor(() => (resultsIn(q('#selectSuburb')) ? q('#selectSuburb') : null), { timeout: 7000 }));
    };
    let ok = await doSearch('#searchSuburb', '#cmdSearchSuburb', String(suburb || '').trim());
    if (!ok) ok = await doSearch('#searchPostal', '#cmdSearchPostal', String(postal || '').replace(/\D/g, ''));
    if (!ok) { close(); return false; }
    const want = String(postal || '').replace(/\D/g, '');
    // A suburb name can return SEVERAL rows (e.g. "Sandton, Sandton" 2146 vs
    // "Sandton" 2196) — iterate the matching rows until one offers the client's
    // ACTUAL postal code; if none does, re-search BY the postal code itself.
    const codesFor = async (opt) => { const s = q('#selectSuburb'); setVal(s, opt.value); await sleep(600); const c = q('#selectCode'); return c ? [...c.options] : []; };
    const pickFrom = async () => {
      const opts = [...q('#selectSuburb').options];
      const matching = suburb ? opts.filter((o) => norm(o.text).includes(norm(suburb))) : [];
      const candidates = (matching.length ? [...matching, ...opts.filter((o) => !matching.includes(o))] : opts).slice(0, 8);
      let fallback = null;
      for (const o of candidates) {
        const codes = await codesFor(o);
        if (!fallback && codes.length) fallback = { opt: o, code: codes[0] };
        if (!want) return fallback; // nothing to enforce — first match is fine
        const hit = codes.find((c) => c.text.replace(/\D/g, '') === want);
        if (hit) return { opt: o, code: hit };
      }
      return fallback;
    };
    let pick = await pickFrom();
    if (want && (!pick || pick.code.text.replace(/\D/g, '') !== want)) {
      // Suburb-name rows never offered the client's postal — search BY the postal.
      const ok2 = await doSearch('#searchPostal', '#cmdSearchPostal', want);
      if (ok2) pick = (await pickFrom()) || pick;
    }
    if (!pick) { close(); return false; }
    const sSel = q('#selectSuburb');
    setVal(sSel, pick.opt.value);
    await sleep(600); // re-sync the code list to the chosen suburb
    const cSel = q('#selectCode');
    if (cSel && cSel.options.length) {
      const live = [...cSel.options].find((o) => o.text === pick.code.text) || cSel.options[0];
      if (want && live.text.replace(/\D/g, '') !== want) flag('Postal code ' + want + ' not offered for "' + (pick.opt.text || '').trim() + '" — took ' + live.text + '; verify.');
      setVal(cSel, live.value);
    }
    await sleep(300);
    const okBtn = q('#cmdAddressOk'); if (okBtn) okBtn.click();
    await sleep(500);
    return true;
  }

  // ---- Dealer Extras table: ensure a row per {desc, amt} (idempotent on re-runs).
  async function boardAddExtras(extras) {
    for (const ex of extras) {
      const rows = () => [...document.querySelectorAll('select[name^=extraDescription_]')];
      if (rows().some((s) => squash((s.options[s.selectedIndex] || {}).text) === squash(ex.desc))) continue;
      let sel = rows().find((s) => !s.value || isPlaceholder((s.options[s.selectedIndex] || {}).text));
      if (!sel) {
        const before = rows();
        const b = document.getElementById('addExtraButton'); if (!b) { flag('Extras: "Add New Extra" button not found — add ' + ex.desc + ' R' + ex.amt + ' manually.'); return; }
        b.click();
        await sleep(400);
        sel = rows().find((s) => !before.includes(s)) || rows()[rows().length - 1];
      }
      if (!sel) { flag('Extras: could not create a row for ' + ex.desc + '.'); continue; }
      const o = [...sel.options].find((x) => squash(x.text) === squash(ex.desc));
      if (!o) { flag('Extras: option "' + ex.desc + '" not found in the catalogue — pick it manually.'); continue; }
      setVal(sel, o.value);
      await sleep(200);
      const idx = (sel.name.split('_')[1] || '').trim();
      setN('extraAmtInclVat_' + idx, ex.amt.toFixed(2));
    }
  }

  // ---- Vehicle via the M&M modal (same ids as LIGHTSTONE, different opener button).
  async function boardSelectVehicle(mm) {
    try {
      const openBtn = document.getElementById('vehicleLookup_');
      if (!openBtn) return false;
      openBtn.click();
      const search = await waitFor(() => { const s = document.querySelector('#searchMMCode'); return vis(s) ? s : null; }, { timeout: 6000 });
      if (!search) return false;
      setVal(search, mm);
      const sBtn = document.querySelector('#cmdMMCode'); if (sBtn) sBtn.click();
      await waitFor(() => { const m = document.querySelector('#selectModel'); return m && /\d{6,}/.test(m.value || ''); }, { timeout: 10000 });
      const okBtn = document.querySelector('#cmdVehicleOk'); if (okBtn) okBtn.click();
      return !!(await waitFor(() => { const c = byName('mmCode'); return c && (c.value || '').replace(/\D/g, '') === mm; }, { timeout: 6000 }));
    } catch (e) { console.warn('[Lumina] boardroom vehicle select failed', e); return false; }
  }

  // Visible still-empty required fields — reported to the human at the end.
  function boardRequiredGaps() {
    return [...document.querySelectorAll('input.required,select.required,textarea.required')]
      .filter((e) => vis(e))
      .filter((e) => e.tagName === 'SELECT'
        ? (!e.value || isPlaceholder((e.options[e.selectedIndex] || {}).text))
        : !String(e.value || '').trim())
      .map((e) => e.name || e.id).filter(Boolean);
  }

  async function fillBoardroom(d) {
    if (!luhnValid(d.id_number)) flag('ID number "' + (d.id_number || '(missing)') + '" is not a valid 13-digit SA ID — fix before submit.');
    const gender = genderFromId(d.id_number) || (norm(d.gender) === 'male' ? 'Male' : norm(d.gender) === 'female' ? 'Female' : null);

    // Expand the collapsed application form + set the sale type (owner rule: In-House).
    const expand = [...document.querySelectorAll('input[type=checkbox]')]
      .find((b) => /expand application/i.test(((b.closest('div,label,span') || {}).innerText) || ''));
    if (expand && !expand.checked) { expand.click(); await sleep(800); }
    setSelSquash('typeOfSaleDOC', 'In - house') || setSelN('typeOfSaleDOC', 'In - house') || flag('Type of Sale "In-House" not set — pick it manually.');

    // Identity
    setN('customerFirstName', d.first_name);
    if (d.middle_name) setN('customerMiddleName', d.middle_name);
    setN('customerSurname', d.last_name);
    setSelN('customerIdType', 'South African Valid ID');
    setN('customerIdNumber', d.id_number);
    await sleep(600); // the form derives DOB/gender from the ID on change
    const dobEl = byName('customerDateOfBirth');
    if (dobEl && !String(dobEl.value || '').trim()) {
      const dob = d.date_of_birth || dobFromId(d.id_number);
      if (dob) setVal(dobEl, String(dob).replace(/\D/g, '').slice(0, 8));
    }
    setSelN('customerGender', gender);
    setSelN('customerTitle', TITLE(gender, d.marital_status));
    setSelN('customerCountryOfBirth', 'SOUTH AFRICA', { fuzzy: true });
    setSelN('customerNationality', d.nationality || 'SOUTH AFRICA', { fuzzy: true });
    setSelN('customerPreferredLanguage', /afr/i.test(d.language || '') ? 'Afrikaans' : 'English');
    setSelN('customerMaritalStatus', MARITAL[norm(d.marital_status)] || d.marital_status);
    if (norm(d.marital_status) === 'married') {
      setSelN('customerMaritalContract', MARRIAGE_TYPE[norm(d.marriage_type)] || d.marriage_type, { fuzzy: true });
      setN('spouseFirstNames', d.spouse_first_name);
      setN('spouseSurname', d.spouse_surname);
    }
    setSelN('customerGraduate', 'Yes'); // owner rule: always Yes
    setN('customerEmail', d.email);
    setN('customerMobilePhoneNumber', (d.phone || '').replace(/\D/g, ''));

    // Work number — the employer number (Google-resolved when Lumina had none),
    // with the landline/cell type picked from the SA prefix.
    const wp = phoneKind(d.employer_phone || d.workplace_cell_no || '');
    if (wp.num && wp.kind) {
      setSelN('customerWorkPhoneNumberType', wp.kind);
      setN('customerWorkPhoneNumber', wp.num);
    } else if (wp.num) {
      setN('customerWorkPhoneNumber', wp.num);
      flag('Work number "' + wp.num + '" has an unusual format — pick Land line/Cell yourself.');
    } else {
      flag('No employer phone number found — fill Phone Number (W) manually.');
    }

    // Residential address — street line(s) only; suburb/city/postal via the lookup
    // dialog (which also sets the hidden region code + enforces the client's postal).
    const res = splitResLines(d.street_address);
    setN('customerResidentialAddressLine1', res.line1);
    if (res.line2) setN('customerResidentialAddressLine2', res.line2);
    const resOk = await boardAddressLookup('customerResidentialAddressLookup', d.suburb, d.area_code);
    if (!resOk) flag('Residential suburb lookup failed — click the suburb button and pick ' + (d.suburb || '(suburb)') + ' ' + (d.area_code || '') + '.');
    const yrs = yearsAtAddressFor(d);
    setN('customerPeriodAtCurrentAddressYears', yrs.years);
    setN('customerPeriodAtCurrentAddressMonths', yrs.months);
    setSelN('sameAsRes', 'Use Residential Address');
    setSelN('ownerTenantLodger', d.residence_type || 'Tenant', { fuzzy: true }) || ensureSelN('ownerTenantLodger', /tenant|owner/i);
    if (/flat|apartment/i.test(d.residence_type || '')) setSelN('residentialType', 'Flat');
    else if (/town\s*house|estate|complex/i.test(d.residence_type || '')) setSelN('residentialType', 'Townhouse');

    // Next of kin (relative address = random real town in the client's own province;
    // no hidden region code exists for the relative, so a direct write is safe).
    const kinTokens = String(d.kin_name || '').trim().split(/\s+/).filter(Boolean);
    setN('relativeFirstNames', d.kin_first_name || kinTokens[0]);
    setN('relativeSurname', d.kin_surname || kinTokens.slice(1).join(' '));
    setSelN('relativeRelation', d.kin_relation, { fuzzy: true }) || ensureSelN('relativeRelation', /other|friend|brother|sister/i);
    if (!d.kin_relation) flag('Next-of-kin relation defaulted — set it if you know it.');
    setSelN('relativePreferredContactMethod', 'Cellphone');
    setN('relativeCellphone', (d.kin_contact || '').replace(/\D/g, ''));
    const relProv = provinceOf(d);
    const relLoc = rand(PROVINCE_CITIES[relProv] || PROVINCE_CITIES['Gauteng']);
    setN('relativeAddressLine1', (Math.floor(Math.random() * 98) + 1) + ' ' + rand(STREETS));
    setN('relativeAddressSuburb', relLoc.suburb);
    setN('relativeAddressCity', relLoc.city);
    setN('relativeAddressPostalCode', relLoc.postal);

    // Employment — the smart, bank-consistent selections.
    const emp = classifyEmployment(d);
    emp.notes.forEach(flag);
    setN('employerName', emp.employerName);
    setSelN('customerEmploymentStatus', emp.status);
    setSelSquash('customerType', emp.clientType) || setSelN('customerType', emp.clientType, { fuzzy: true });
    setSelN('employmentLevel', emp.level);
    let occSet = false;
    for (const pref of emp.occupationPrefs.filter(Boolean)) {
      if (setSelN('customerOccupation', pref) || setSelN('customerOccupation', pref, { fuzzy: true })) { occSet = true; break; }
    }
    if (!occSet) { ensureSelN('customerOccupation', /general|other|worker|admin/i); flag('Occupation "' + (d.job_title || '(blank)') + '" had no match — generic chosen; verify.'); }
    let indSet = false;
    if (emp.industrySource) {
      for (const [re, opt] of INDUSTRY_MAP) { if (re.test(emp.industrySource)) { indSet = setSelN('employerIndustryType', opt, { fuzzy: false }) || setSelN('employerIndustryType', opt, { fuzzy: true }); if (indSet) break; } }
      if (!indSet) indSet = !!setSelN('employerIndustryType', d.industry || d.employer_name, { fuzzy: true });
    }
    if (!indSet) { setSelN('employerIndustryType', 'UNKNOWN') || ensureSelN('employerIndustryType', /business services/i); if (emp.kind === 'permanent') flag('Employer industry not matched — set to UNKNOWN; pick the right one.'); }
    setSelN('customerSalaryDay', String(d.salary_day || 25)) || ensureSelN('customerSalaryDay', /^25$/);
    if (vis(byName('salaryFrequency'))) setSelN('salaryFrequency', 'Monthly');
    if (vis(byName('RetrenchmentNotifyInd'))) setSelN('RetrenchmentNotifyInd', 'No');
    if (vis(byName('governmentEmployeeIndicator'))) setSelN('governmentEmployeeIndicator', /government|municipal|sars|saps|dept|state|provincial/i.test(norm(d.employer_name || '')) ? 'Yes' : 'No');
    if (vis(byName('isBankEmployee'))) setSelN('isBankEmployee', 'No');

    // Employer address — self-employed (no business address) / pensioner / student /
    // unemployed use the RESIDENTIAL address; everyone else the Google-resolved one.
    if (emp.useResidentialAddress) {
      setN('employerAddressLine1', res.line1);
      const eOk = await boardAddressLookup('employerAddressLookup', d.suburb, d.area_code);
      if (!eOk) flag('Employer (residential) suburb lookup failed — resolve it via the employer suburb button.');
      if (emp.kind === 'self') flag('Self-employed with no business address on file — used the residential address as the business address.');
    } else {
      const empFull = d.business_address_auto || d.employer_address || '';
      setN('employerAddressLine1', firstSegment(empFull).slice(0, 50));
      const empPostal = d.employer_postal_code || (String(empFull).match(/\b\d{4}\b/g) || []).pop() || '';
      const eOk = await boardAddressLookup('employerAddressLookup', d.employer_suburb, empPostal);
      if (!eOk) flag('Employer suburb lookup failed — resolve it via the employer suburb button (' + (d.employer_suburb || empPostal || 'no suburb on file') + ').');
    }
    const tenure = parseEmploymentPeriod(d.employment_period);
    if (tenure && tenure.fromYear) flag('Employment "' + d.employment_period + '" read as started ' + tenure.fromYear + ' → filled as ' + tenure.years + 'y ' + tenure.months + 'm.');
    setN('customerPeriodAtCurrentEmployerYears', tenure ? tenure.years : (emp.kind === 'pensioner' ? 5 : 1));
    setN('customerPeriodAtCurrentEmployerMonths', tenure ? tenure.months : 0);

    // Income + the realistic expense split.
    if (+d.gross_salary && +d.net_salary && +d.net_salary > +d.gross_salary) flag('Net (' + d.net_salary + ') > Gross (' + d.gross_salary + ') — likely swapped; verify.');
    setN('sumIncomeCustomerGrossRemuneration', d.gross_salary);
    setN('addIncomeCustomerNetTakeHomePay', d.net_salary);
    if (+d.additional_income) setN('addIncomeCustomerOtherIncome', d.additional_income);
    const ex = computeExpensesSmart(d);
    for (const [name, amt] of ex.byField) setN(name, Math.round(amt));
    if (ex.adjusted) flag('Expenses split across realistic categories (≈ R' + ex.total + ' total, low side) — adjust any line if needed.');

    // Payment history — the adverse-credit questions all "No" (fields exist even when
    // their panel is collapsed). Consents — owner rule: marketing No, insurance-panel
    // No, every other visible consent question Yes.
    ['debtReviewIndicator', 'debtCounselling', 'administrationOrderIndicator', 'DebtAdminHist',
      'previousJudgementIndicator', 'DebtDisp', 'debtSeqOrder'].forEach((n) => setSelN(n, 'No'));
    setSelN('marketingConsentIndicator', 'No');
    setSelN('insuranceConsentIndicator', 'No');
    const consentSkip = new Set(['marketingConsentIndicator', 'insuranceConsentIndicator']);
    for (const e of document.querySelectorAll('select[name]')) {
      if (consentSkip.has(e.name) || !vis(e)) continue;
      if (!/consent|concent|privacydisclosure|disclosure/i.test(e.name)) continue;
      const cur = norm((e.options[e.selectedIndex] || {}).text);
      if (cur === 'yes' || cur === 'no') continue;
      const yes = [...e.options].find((o) => norm(o.text) === 'yes');
      if (yes) setVal(e, yes.value);
    }

    // Vehicle — standard quote car via the M&M modal; owner rules: Used, VIN = A's.
    setSelSquash('articleCondition', 'Used') || setSelN('articleCondition', 'Used', { fuzzy: true });
    setN('chassisNo', 'AAAAAAAAAAAAAAAAA'); // VIN placeholder per owner rule (17 A's)
    const vehOk = await boardSelectVehicle('59007082');
    if (vehOk) setN('purchasePrice', '220000.00');
    else flag('Vehicle not auto-selected — click "select vehicle", search M&M 59007082, OK, then set Purchase Price 220000.');
    if (vis(byName('usedArticleCondtion'))) setSelN('usedArticleCondtion', 'Good');
    // Condition=Used makes the mileage REQUIRED — realistic, seeded per client.
    if (!String((byName('kilometerReading') || {}).value || '').trim()) {
      const rkm = seededRand((d.id_number || '') + 'km');
      setN('kilometerReading', String(20000 + Math.round(rkm() * 50) * 500)); // 20 000 – 45 000 km
    }
    setSelN('repaymentPeriod', '72 Months');
    setSelN('rateIndicator', 'Linked');
    setN('interestRate', '12');
    setN('residualPercent', '35');
    setSelN('financeInitiationFees', 'Yes');

    // Dealer Extras — the two standard VAPs.
    await boardAddExtras([{ desc: 'DELIVERY FEE', amt: 5000 }, { desc: 'LICENCE FEE', amt: 2500 }]);

    // Bank details. The bank select's own change handler resets/refills the branch
    // fields ASYNCHRONOUSLY (it wrote "Universal" as branch name in testing) — so give
    // it a beat, then assert the universal branch code and only backfill the branch
    // name if the handler left it empty.
    setN('customerBankAccountHolder', d.full_name);
    setN('customerBankAccountIDHolder', d.id_number);
    setSelN('customerBankAccountBank', bankOptionName(d.bank_name) || d.bank_name, { fuzzy: true }) || flag('Bank "' + (d.bank_name || '') + '" not matched — pick it manually.');
    setN('customerBankAccountNumber', (d.account_number || '').replace(/\s/g, ''));
    setSelN('customerBankAccountType', ACCOUNT_TYPE[norm(d.account_type)] || d.account_type || 'Savings', { fuzzy: true }) || ensureSelN('customerBankAccountType', /savings|cheque/i);
    await sleep(800); // let the bank change handler finish resetting branch fields
    const bc = branchCodeFor(d.bank_name);
    if (bc) {
      setN('customerBankAccountBranchCode', bc);
      await sleep(800);
      if (!String((byName('customerBankAccountBranchCode') || {}).value || '').trim()) setN('customerBankAccountBranchCode', bc);
    } else flag('No branch code for "' + (d.bank_name || '') + '".');
    const bn = byName('customerBankAccountBranchName');
    if (bn && !String(bn.value || '').trim()) setVal(bn, bankOptionName(d.bank_name) || d.bank_name || '');

    // Sales people — owner rules. F&I info block stays untouched (left open).
    const pickPerson = (name, re) => {
      const el = byName(name); if (!el) return false;
      const o = [...el.options].find((x) => re.test(x.text));
      if (o) { setVal(el, o.value); return true; }
      return false;
    };
    pickPerson('salespersonSelect', /dezi/i) || flag('Salesperson "Dezi" not found — pick manually.');
    pickPerson('rPFAndI', /siobhan/i) || flag('Advising F&I "Siobhan" not found — pick manually.');
  }

  /* ══════════════════ KREDO / CarTrust — Credit Report Scan ══════════════════ */
  // clientzone.kredo.co.za (Angular). The "Credit Report Scan" sidebar item opens a
  // small modal with stable ids: #id_number #first_name #last_name #cell_number
  // #email_address #gross_income #household_expenses + #credit_report_consent,
  // submit = the "Generate Report" button. Unlike the Signio flows (human submits),
  // the owner asked for ONE-CLICK submission here — once every required field is
  // filled the engine clicks Generate Report itself and waits for CarTrust's
  // "Credit Report created Successfully." confirmation.

  const visEl = (el) => !!(el && (el.offsetWidth || el.offsetHeight));

  // CarTrust logins live in sessionStorage (PER-TAB), so Lumina REUSES one named
  // tab ('luminaKredoScan') — log in once, scan all day. A reused cross-origin
  // tab's window.name can't be refreshed from Lumina, so the FRESH payload comes
  // from the opener over postMessage; window.name (set on first open, survives
  // the login redirect) is the fallback. After reading, the tab's name is
  // restored to 'luminaKredoScan' so Lumina keeps finding this tab after reloads.
  const KREDO_TAB_NAME = 'luminaKredoScan';
  function kredoRestoreName() {
    try { if ((window.name || '').indexOf('LUMINA_KREDO:') === 0 || !window.name) window.name = KREDO_TAB_NAME; } catch (_e) { /* noop */ }
  }
  function kredoPayload() {
    return new Promise((resolve) => {
      let opener = null;
      try { opener = window.opener; } catch (_e) { /* noop */ }
      const fallback = () => {
        const d = fetchData();
        // A window.name payload can be from a much earlier open (tab sat unused,
        // Lumina since closed). Still fill it, but never auto-submit stale data.
        if (d && d.kredo && d.ts && Date.now() - d.ts > 10 * 60 * 1000) {
          d.kredo_no_submit = true;
          flag('This applicant was pushed over 10 minutes ago — auto-submit disabled; verify it is the right person, then click Generate Report yourself.');
        }
        resolve(d);
      };
      if (!opener) return fallback();
      const timer = setTimeout(() => { window.removeEventListener('message', onMsg); fallback(); }, 2500);
      function onMsg(e) {
        const m = e && e.data;
        if (m && m.type === 'LUMINA_KREDO_PAYLOAD' && m.payload) {
          clearTimeout(timer);
          window.removeEventListener('message', onMsg);
          resolve(m.payload);
        }
      }
      window.addEventListener('message', onMsg);
      try { opener.postMessage({ type: 'LUMINA_KREDO_REQ' }, '*'); } catch (_e) { clearTimeout(timer); window.removeEventListener('message', onMsg); fallback(); }
    });
  }

  async function runKredo() {
    flags = [];
    const d = await kredoPayload();
    kredoRestoreName();
    if (!d) { alert('No Lumina applicant data found.\n\nIn Lumina, click the credit-scan button on the Finance summary row — it preps this tab — then click this bookmark here.'); return; }

    // Open the Credit Scan modal if it isn't showing yet (works from any page).
    let idEl = document.getElementById('id_number');
    if (!visEl(idEl)) {
      // Clear leftovers from a previous scan (success/info dialogs cover the sidebar).
      [...document.querySelectorAll('button')]
        .filter((b) => /^\s*(okay|close)\s*$/i.test(b.textContent || '') && visEl(b))
        .slice(0, 3)
        .forEach((b) => b.click());
      const nav = [...document.querySelectorAll('a, li, span, p, [role="button"]')]
        .find((el) => /credit report scan/i.test(el.textContent || '') && visEl(el) && el.children.length <= 2);
      if (nav) nav.click();
      idEl = await waitFor(() => { const e = document.getElementById('id_number'); return visEl(e) ? e : null; }, { timeout: 10000 });
    }
    if (!visEl(idEl)) { alert('Could not open the Credit Report Scan form — open it from the CarTrust sidebar, then click the bookmark again.'); return; }

    const setById = (id, v) => { const e = document.getElementById(id); return e && v != null && String(v).trim() !== '' ? setVal(e, String(v).trim()) : false; };
    const nameTokens = String(d.full_name || '').trim().split(/\s+/).filter(Boolean);
    let cell = String(d.phone || '').replace(/\D/g, '');
    if (cell.length === 11 && cell.startsWith('27')) cell = '0' + cell.slice(2); // 2783… → 083…

    setById('id_number', d.id_number) || flag('No ID number on file.');
    setById('first_name', d.first_name || nameTokens[0]) || flag('No first name on file.');
    setById('last_name', d.last_name || nameTokens.slice(1).join(' ')) || flag('No last name on file.');
    setById('cell_number', cell) || flag('No cell number on file.');
    setById('email_address', d.email) || flag('No email on file.');
    const gross = Math.round(parseAmt(d.gross_salary));
    if (gross > 0) setById('gross_income', gross); else flag('No gross income on file.');
    // Household Expenses = ONE total, derived with the SAME normalisation the Signio
    // wizard uses (itemised parse + realistic floor + disposable-income cap) so the
    // figure is believable — never the raw, sometimes-inflated summary text.
    const ex = computeExpensesWiz(d);
    if (ex.total > 0) setById('household_expenses', ex.total); else flag('No expenses derivable — fill Household Expenses by hand.');

    const consent = document.getElementById('credit_report_consent');
    if (consent && !consent.checked) consent.click();

    const missing = ['id_number', 'first_name', 'last_name', 'cell_number', 'email_address', 'gross_income', 'household_expenses']
      .filter((id) => !String((document.getElementById(id) || {}).value || '').trim());
    const submitBtn = [...document.querySelectorAll('button')].find((b) => /generate report/i.test(b.textContent || '') && visEl(b));
    const body = flags.length ? '\n\n• ' + flags.join('\n• ') : '';
    if (missing.length || !submitBtn || d.kredo_no_submit) {
      const gaps = missing.length ? '\n\nStill needed:\n• ' + missing.join('\n• ') : '';
      alert('Lumina filled the credit scan for ' + (d.full_name || 'the applicant') + '.' + body + gaps +
        (missing.length ? '\n\nComplete those, then click Generate Report.' : '\n\nReview and click Generate Report.'));
      return;
    }
    submitBtn.click();
    // innerText is visibility-aware, so the pre-mounted hidden success dialog in the
    // DOM can't false-positive this — only the dialog actually shown counts.
    const done = await waitFor(() => /credit report created successfully/i.test(document.body.innerText || ''), { timeout: 45000, interval: 400 });
    if (done) {
      const okay = [...document.querySelectorAll('button')].find((b) => /^\s*okay\s*$/i.test(b.textContent || '') && visEl(b));
      if (okay) okay.click();
      alert('✅ Credit report submitted for ' + (d.full_name || 'the applicant') + '.' + body + '\n\nIt will appear in the CarTrust applicant list (allow a moment, then Force Refresh).');
    } else {
      alert('Report was submitted but no confirmation appeared within 45s.' + body + '\n\nCheck the applicant list BEFORE re-running — every scan is billed.');
    }
  }

  /* ══════════════════════════ mode detection + run ══════════════════════════ */

  async function run() {
    // CarTrust / Kredo tab? → the credit-scan flow, never a Signio form.
    if (/(^|\.)kredo\.co\.za$/i.test(location.hostname)) { await runKredo(); return; }
    flags = [];
    const d = fetchData();
    if (!d) { alert('No Lumina application data found.\n\nIn Lumina click "Push to Signio" → "Open Signio form", then click this bookmark on that tab.'); return; }
    // The Lumina settings can DECLARE which system a link uses (payload.signio_system,
    // set per-link in Admin → Settings → Signio links). Trust the declaration as soon
    // as that form's markers actually mount; if they never do (misconfigured link),
    // fall back to auto-detection below.
    // STABLE MARKERS — boardroom (Signio Direct Submit): the Dealer Extras
    // #addExtraButton / [name=typeOfSaleDOC] (it ALSO has customerIdNumber, so it must
    // be checked BEFORE lightstone); lightstone: [name=customerIdNumber]; wizard: the
    // id'd step-1 radios.
    const isBoardroom = () => !!(document.getElementById('addExtraButton') || byName('typeOfSaleDOC'));
    const declared = norm(d.signio_system || '');
    const declaredMode = /board|direct|submit/.test(declared) ? 'boardroom'
      : /light|single|one/.test(declared) ? 'lightstone'
      : /wizard|step|goa/.test(declared) ? 'wizard' : null;
    let mode = null;
    if (declaredMode) {
      // Confirm the declaration against STABLE markers only. Do NOT consult wizStep()
      // here — the LIGHTSTONE page also shows "Payment History" text, so a text-based
      // check would CONFIRM a wrong "wizard" declaration and misroute the fill. With
      // stable markers, a wrong declaration just times out and auto-detection below
      // routes it correctly (slower, never broken).
      mode = await waitFor(() => declaredMode === 'boardroom'
        ? (isBoardroom() ? 'boardroom' : null)
        : declaredMode === 'lightstone'
          ? (byName('customerIdNumber') && !isBoardroom() ? 'lightstone' : null)
          : (document.getElementById('debtReviewIndicator-yes') ? 'wizard' : null),
      { timeout: 15000 });
      if (!mode) flag('Link is configured as "' + declared + '" but that form never appeared — auto-detected instead.');
    }
    // Auto-detect (boardroom first — it shares LIGHTSTONE's field vocabulary). Text/step
    // heuristics run only AFTER the poll times out (e.g. the bookmark is clicked
    // mid-wizard on a later step, where the step-1 radios no longer exist).
    if (!mode) mode = await waitFor(() => {
      if (isBoardroom()) return 'boardroom';
      if (byName('customerIdNumber')) return 'lightstone';
      if (document.getElementById('debtReviewIndicator-yes')) return 'wizard';
      return null;
    }, { timeout: 15000 }) || (wizStep() !== 'unknown' ? 'wizard' : null);
    if (!mode) { alert('This does not look like a Signio application form (nothing fillable found) — open the form first, then click the bookmark.'); return; }
    if (mode === 'wizard') { await runWizard(d); return; }
    if (mode === 'boardroom') {
      try { await fillBoardroom(d); } catch (e) { console.error('[Lumina]', e); flag('Engine error: ' + (e && e.message)); }
      const gaps = boardRequiredGaps();
      const gapTxt = gaps.length ? '\n\nStill required (fill these):\n• ' + gaps.join('\n• ') : '';
      const body = flags.length ? '\n\nCheck:\n• ' + flags.join('\n• ') : '';
      alert('Lumina auto-fill done (Signio Direct Submit).' + body + gapTxt + '\n\nReview everything, then Save / Save & Release yourself — the filler never submits.');
      return;
    }
    try { await fillLightstone(d); } catch (e) { console.error('[Lumina]', e); flag('Engine error: ' + (e && e.message)); }
    const body = flags.length ? '\n\nCheck:\n• ' + flags.join('\n• ') : '';
    alert('Lumina auto-fill done (LIGHTSTONE).' + body + '\n\nVehicle set to the standard quote car (Suzuki Swift 1.2 GL). Now: review any highlighted/empty required fields, tick the declaration, clear the reCAPTCHA, then Submit.');
  }

  // Two handoff namespaces share the same window.name channel: Push-to-Signio and
  // the Finance-summary credit-scan button (Kredo/CarTrust).
  const HANDOFF_PREFIXES = ['LUMINA_SIGNIO:', 'LUMINA_KREDO:'];
  function fetchData() {
    const wn = window.name || '';
    for (const p of HANDOFF_PREFIXES) {
      if (wn.startsWith(p)) { try { return JSON.parse(wn.slice(p.length)); } catch (e) { flag('Could not read Lumina payload.'); } }
    }
    return window.__LUMINA_APP__ || null;
  }
  run();
})();
