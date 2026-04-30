import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { rawText } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured.");
    if (!rawText || typeof rawText !== "string") throw new Error("No text provided.");

    const currentDate = new Date().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });

    const systemPrompt = `You are a data extraction AI for a premium auto dealership. Extract the client's finance application details from the provided WhatsApp text. The client may have misspelled things or left things blank.
Return ONLY a valid JSON object with the exact following keys. If a value is missing, return an empty string "". Do not include markdown formatting like \`\`\`json.

CRITICAL RULE FOR EXPENSES: For the 'living_expenses' field, DO NOT strip out the descriptive words. You MUST extract both the descriptive text and the amount exactly as the client wrote it (e.g., "Rent 5000, Food 2000, Water 500").

CRITICAL RULE FOR EMPLOYMENT: The current date is ${currentDate}. For the 'employment_start' field, you must calculate the exact duration in years and months from their start date to the current date. Format the output exactly like this: "[Original Date] (X Years, Y Months)". Example: "June 2022 (3 Years, 10 Months)". If they already provided the duration instead of a date, just use what they provided.

Keys: first_name, last_name, id_number, email, phone, marital_status, physical_address, employer_name, job_title, employment_start, employment_status, gross_income, net_income, living_expenses, bank_name, account_number, kin_name, kin_phone.`;

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

    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (rawAddress && GOOGLE_MAPS_API_KEY) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(rawAddress)}&components=country:ZA&key=${GOOGLE_MAPS_API_KEY}`;
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

          // Heuristic: if Google could not pin a real route OR returned only a partial match,
          // flag for manual review.
          const isPartial = result.partial_match === true;
          const hasStreet = !!route;

          addressMeta = {
            formatted_address: result.formatted_address || rawAddress,
            street,
            suburb,
            city,
            province,
            postal_code: postalCode,
            requiresManualVerification: isPartial || !hasStreet,
            raw: rawAddress,
          };
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
    } else if (rawAddress && !GOOGLE_MAPS_API_KEY) {
      console.warn("GOOGLE_MAPS_API_KEY not set; skipping geocoding.");
      addressMeta.requiresManualVerification = true;
    }

    // Overwrite physical_address with the formatted version for the admin UI
    parsedData.physical_address = addressMeta.formatted_address;

    return new Response(JSON.stringify({ success: true, data: parsedData, address: addressMeta }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("parse-whatsapp error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
