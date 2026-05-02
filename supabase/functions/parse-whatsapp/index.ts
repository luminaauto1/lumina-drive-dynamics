import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const { rawText } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured.");
    if (!rawText || typeof rawText !== "string") throw new Error("No text provided.");

    const currentDate = new Date().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });

    const systemPrompt = `You are a data extraction AI for a premium auto dealership. Extract the client's finance application details from the provided WhatsApp text. The client may have misspelled things or left things blank.
Return ONLY a valid JSON object with the exact following keys. If a value is missing, return an empty string "". Do not include markdown formatting like \`\`\`json.

CRITICAL — DUAL FORMAT SUPPORT: Clients send data in TWO possible formats. You MUST detect and handle BOTH dynamically:

FORMAT A — Free-form / inline (e.g. "Name: John Smith", "Bank - FNB", "Rent 5000, Food 2000").

FORMAT B — Alternating lines (label on one line, value on the very next line). Example:
  Bank
  Tyme
  City
  Soweto
  Net Income
  18500
  Id Number
  9001015800087
  Next Of Kin Number
  0821234567
  Area Code
  1804
In FORMAT B, the line immediately following a recognised label IS the value for that label, even if the value looks like a number, a name, or a single word. Do NOT confuse labels with values. Common labels (case-insensitive, may include spaces, slashes or punctuation): First Name, Last Name / Surname, Full Name, ID Number, Email, Cell / Phone / Mobile / Contact Number, Gender / Sex, Marital Status, Physical Address / Street Address / Residential Address, Suburb, City, Province, Area Code / Postal Code, Employer / Company, Job Title / Occupation / Position, Employment Start / Start Date / Employed Since, Employment Status, Gross Income / Gross Salary, Net Income / Net Salary / Take Home, Living Expenses / Monthly Expenses, Bank / Bank Name, Account Number, Next Of Kin / Kin Name, Next Of Kin Number / Kin Phone.

ADDRESS ASSEMBLY: If FORMAT B provides Street Address, Suburb, City, Province and/or Area Code as separate fields, COMBINE them into a single 'physical_address' string in the order: "<street>, <suburb>, <city>, <province> <area_code>" (omit any missing parts, no trailing commas). The downstream geocoder will normalize it.

GENDER NORMALIZATION: Always hunt for a gender indicator. Accept variations: "Male", "M", "male", "Man" → "Male"; "Female", "F", "female", "Woman" → "Female"; "Other", "Non-binary", "NB" → "Other". If the client gives an ID number but no explicit gender, you MAY infer from the 7th-10th digits of a South African ID (0000–4999 = Female, 5000–9999 = Male) and return that value. If still unknown, return "".

CRITICAL RULE FOR EXPENSES: For the 'living_expenses' field, DO NOT strip out the descriptive words. You MUST extract both the descriptive text and the amount exactly as the client wrote it (e.g., "Rent 5000, Food 2000, Water 500").

CRITICAL RULE FOR EMPLOYMENT: The current date is ${currentDate}. For the 'employment_start' field, you must calculate the exact duration in years and months from their start date to the current date. Format the output exactly like this: "[Original Date] (X Years, Y Months)". Example: "June 2022 (3 Years, 10 Months)". If they already provided the duration instead of a date, just use what they provided.

Keys: first_name, last_name, id_number, email, phone, gender, marital_status, physical_address, employer_name, workplace_address, job_title, employment_start, employment_status, gross_income, net_income, living_expenses, bank_name, account_number, kin_name, kin_phone.

For 'workplace_address': only fill if the client EXPLICITLY provides the company's street/business address. Do NOT guess or duplicate the residential address. If absent, return "" — the backend will auto-resolve it via Google Places.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: rawText },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway request failed.");
    }

    const aiData = await aiResponse.json();
    let jsonString: string = aiData.choices?.[0]?.message?.content?.trim() || "{}";

    if (jsonString.startsWith("```")) {
      jsonString = jsonString.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsedData = JSON.parse(jsonString);

    // ---- Address normalization (South Africa-bound geocoding) ----
    const rawAddress: string = (parsedData.physical_address || "").trim();
    let addressMeta: {
      formatted_address: string;
      street: string;
      suburb: string;
      city: string;
      province: string;
      postal_code: string;
      requiresManualVerification: boolean;
      raw: string;
    } = {
      formatted_address: rawAddress,
      street: "",
      suburb: "",
      city: "",
      province: "",
      postal_code: "",
      requiresManualVerification: !rawAddress, // empty = needs review
      raw: rawAddress,
    };

    // Prefer the dedicated Geocoding key; fall back to the shared Maps key for backwards compat.
    const GOOGLE_GEOCODING_API_KEY =
      Deno.env.get("GOOGLE_GEOCODING_API_KEY") || Deno.env.get("GOOGLE_MAPS_API_KEY");

    // Try to extract a "Unit / Apt / Flat / No. X" prefix from the raw address before geocoding.
    const extractUnit = (text: string): string => {
      if (!text) return "";
      const patterns = [
        /\b(?:unit|apt|apartment|flat|suite|ste|no\.?|number|#)\s*([A-Za-z0-9\-\/]+)/i,
        /^([A-Za-z0-9]+)\s*[-,]\s*\d+\s+\w+/i, // e.g. "12A - 45 Main St"
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1]) return m[1].trim();
      }
      return "";
    };

    // Build a fully structured address string from components.
    const assembleAddress = (parts: {
      unit?: string; street_number?: string; street_name?: string;
      suburb?: string; city?: string; province?: string; postal_code?: string;
    }): string => {
      const street = [parts.street_number, parts.street_name].filter(Boolean).join(" ").trim();
      const line1 = parts.unit ? `Unit ${parts.unit}${street ? ", " + street : ""}` : street;
      const segments = [line1, parts.suburb, parts.city, parts.province, parts.postal_code]
        .map((s) => (s || "").trim())
        .filter(Boolean);
      return segments.join(", ");
    };

    if (rawAddress && GOOGLE_GEOCODING_API_KEY) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(rawAddress)}&components=country:ZA&key=${GOOGLE_GEOCODING_API_KEY}`;
        const geoRes = await fetch(url);
        const geoData = await geoRes.json();

        if (geoData.status === "OK" && Array.isArray(geoData.results) && geoData.results.length > 0) {
          const result = geoData.results[0];
          const components: Array<{ long_name: string; short_name: string; types: string[] }> = result.address_components || [];

          const get = (type: string, short = false) => {
            const c = components.find((x) => x.types.includes(type));
            return c ? (short ? c.short_name : c.long_name) : "";
          };

          const streetNumber = get("street_number");
          const route = get("route");
          const street = [streetNumber, route].filter(Boolean).join(" ").trim();
          const suburb = get("sublocality") || get("sublocality_level_1") || get("neighborhood");
          const city = get("locality") || get("administrative_area_level_2");
          const province = get("administrative_area_level_1");
          const postalCode = get("postal_code");
          const unit = get("subpremise") || extractUnit(rawAddress);

          // Heuristic: if Google could not pin a real route OR returned only a partial match,
          // flag for manual review.
          const isPartial = result.partial_match === true;
          const hasStreet = !!route;

          const fullAssembled = assembleAddress({
            unit, street_number: streetNumber, street_name: route,
            suburb, city, province, postal_code: postalCode,
          });

          addressMeta = {
            formatted_address: fullAssembled || result.formatted_address || rawAddress,
            street,
            suburb,
            city,
            province,
            postal_code: postalCode,
            requiresManualVerification: isPartial || !hasStreet,
            raw: rawAddress,
          };
          (addressMeta as any).unit = unit;
          (addressMeta as any).street_number = streetNumber;
          (addressMeta as any).street_name = route;
        } else if (geoData.status === "ZERO_RESULTS") {
          addressMeta.requiresManualVerification = true;
        } else {
          console.warn("Geocoding non-OK status:", geoData.status, geoData.error_message);
          addressMeta.requiresManualVerification = true;
        }
      } catch (geoErr) {
        console.error("Geocoding failed:", geoErr);
        addressMeta.requiresManualVerification = true;
      }
    } else if (rawAddress && !GOOGLE_GEOCODING_API_KEY) {
      console.warn("GOOGLE_GEOCODING_API_KEY (and fallback GOOGLE_MAPS_API_KEY) not set; skipping geocoding.");
      addressMeta.requiresManualVerification = true;
    }

    // Overwrite physical_address with the formatted version for the admin UI
    parsedData.physical_address = addressMeta.formatted_address;

    // ---- Workplace address auto-resolution (Google Places Text Search, ZA-bound) ----
    const companyName: string = (parsedData.employer_name || "").trim();
    const existingWorkplace: string = (parsedData.workplace_address || "").trim();
    let workplaceMeta: {
      formatted_address: string;
      source: "google_places" | "client_provided" | "none";
      requiresManualInput: boolean;
      query: string;
      match_name: string;
      api_status?: string;
      api_error?: string;
    } = {
      formatted_address: existingWorkplace,
      source: existingWorkplace ? "client_provided" : "none",
      requiresManualInput: !existingWorkplace,
      query: "",
      match_name: "",
    };

    console.log("[Workplace] companyName:", companyName, "| existing:", existingWorkplace, "| keyPresent:", !!GOOGLE_GEOCODING_API_KEY);

    // Only auto-resolve if the client did NOT supply a workplace address themselves.
    if (!existingWorkplace && companyName && GOOGLE_GEOCODING_API_KEY) {
      const cityHint = (addressMeta.city || "").trim();
      const provinceHint = (addressMeta.province || "").trim();
      const queryParts = [companyName, cityHint || provinceHint, "South Africa"].filter(Boolean);
      const placesQuery = queryParts.join(" ");
      workplaceMeta.query = placesQuery;
      console.log("[Workplace] Places query:", placesQuery);

      try {
        const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(placesQuery)}&region=za&key=${GOOGLE_GEOCODING_API_KEY}`;
        const placesRes = await fetch(placesUrl);
        const placesData = await placesRes.json();
        console.log("[Workplace] Places status:", placesData.status, "| results:", placesData.results?.length || 0);
        console.log("[Workplace] Top result sample:", JSON.stringify(placesData.results?.[0] || {}).slice(0, 500));
        workplaceMeta.api_status = placesData.status;
        if (placesData.error_message) workplaceMeta.api_error = placesData.error_message;

        if (placesData.status === "OK" && Array.isArray(placesData.results) && placesData.results.length > 0) {
          const zaResult =
            placesData.results.find((r: any) => typeof r.formatted_address === "string" && /south africa/i.test(r.formatted_address)) ||
            placesData.results[0];

          // Fetch Place Details to get address_components for structured assembly.
          let resolvedAddress = "";
          let wpStreetNumber = "", wpRoute = "", wpSuburb = "", wpCity = "", wpProvince = "", wpPostal = "", wpUnit = "";

          if (zaResult?.place_id) {
            try {
              const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(zaResult.place_id)}&fields=address_components,formatted_address,name&key=${GOOGLE_GEOCODING_API_KEY}`;
              const detailsRes = await fetch(detailsUrl);
              const detailsData = await detailsRes.json();
              if (detailsData.status === "OK" && detailsData.result) {
                const comps: Array<{ long_name: string; short_name: string; types: string[] }> = detailsData.result.address_components || [];
                const getC = (type: string) => comps.find((x) => x.types.includes(type))?.long_name || "";
                wpStreetNumber = getC("street_number");
                wpRoute = getC("route");
                wpSuburb = getC("sublocality") || getC("sublocality_level_1") || getC("neighborhood");
                wpCity = getC("locality") || getC("administrative_area_level_2");
                wpProvince = getC("administrative_area_level_1");
                wpPostal = getC("postal_code");
                wpUnit = getC("subpremise");
                resolvedAddress = assembleAddress({
                  unit: wpUnit, street_number: wpStreetNumber, street_name: wpRoute,
                  suburb: wpSuburb, city: wpCity, province: wpProvince, postal_code: wpPostal,
                });
              }
            } catch (detailsErr) {
              console.warn("[Workplace] Place Details fetch failed:", detailsErr);
            }
          }

          // Fallback to formatted_address if details failed.
          if (!resolvedAddress) {
            resolvedAddress = zaResult?.formatted_address || "";
          }
          if (resolvedAddress && !/south africa/i.test(resolvedAddress)) {
            resolvedAddress = `${resolvedAddress}, South Africa`;
          }

          if (resolvedAddress) {
            workplaceMeta = {
              ...workplaceMeta,
              formatted_address: resolvedAddress,
              source: "google_places",
              requiresManualInput: false,
              query: placesQuery,
              match_name: zaResult.name || "",
            };
            (workplaceMeta as any).unit = wpUnit;
            (workplaceMeta as any).street_number = wpStreetNumber;
            (workplaceMeta as any).street_name = wpRoute;
            (workplaceMeta as any).suburb = wpSuburb;
            (workplaceMeta as any).city = wpCity;
            (workplaceMeta as any).province = wpProvince;
            (workplaceMeta as any).postal_code = wpPostal;
            parsedData.workplace_address = resolvedAddress;
            console.log("[Workplace] Resolved:", zaResult.name, "→", resolvedAddress);
          } else {
            console.warn("[Workplace] Top result had no formatted_address, flagging manual.");
            workplaceMeta.requiresManualInput = true;
          }
        } else if (placesData.status === "ZERO_RESULTS") {
          console.warn("[Workplace] ZERO_RESULTS for:", placesQuery);
          workplaceMeta.requiresManualInput = true;
        } else {
          console.error("[Workplace] Places non-OK:", placesData.status, placesData.error_message);
          workplaceMeta.requiresManualInput = true;
        }
      } catch (placesErr) {
        console.error("[Workplace] Places fetch failed:", placesErr);
        workplaceMeta.requiresManualInput = true;
        workplaceMeta.api_error = String(placesErr?.message || placesErr);
      }
    } else if (companyName && !GOOGLE_GEOCODING_API_KEY) {
      console.warn("[Workplace] No API key configured, skipping Places lookup.");
      workplaceMeta.api_error = "No GOOGLE_GEOCODING_API_KEY / GOOGLE_MAPS_API_KEY configured.";
    }

    // Ensure the workplace_address key always exists on the payload for the UI.
    if (parsedData.workplace_address === undefined) parsedData.workplace_address = workplaceMeta.formatted_address;

    return new Response(JSON.stringify({ success: true, data: parsedData, address: addressMeta, workplace: workplaceMeta }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("parse-whatsapp error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
