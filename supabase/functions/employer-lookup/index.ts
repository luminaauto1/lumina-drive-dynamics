// employer-lookup — resolve an employer's PHONE NUMBER (+ address details) from the
// employer name via Google Places, for the Signio auto-fill + finance PDFs.
// The address half of this already existed in parse-whatsapp; this function adds the
// phone (formatted_phone_number) that the F&I is constantly asked to confirm.
// Text Search (name + hint + South Africa) → Place Details (address + phone fields).
// JWT-verified — called from the admin UI with the staff session.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const key = Deno.env.get("GOOGLE_GEOCODING_API_KEY") || Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) return json({ ok: false, error: "No Google API key configured" });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* fall through to validation */ }
  const name = String(body.employer_name ?? "").trim();
  const hint = String(body.hint ?? "").trim();
  if (!name) return json({ ok: false, error: "employer_name required" }, 400);

  try {
    const query = encodeURIComponent([name, hint, "South Africa"].filter(Boolean).join(" "));
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&region=za&key=${key}`,
    );
    const search = await searchRes.json();
    const top = search?.results?.[0];
    if (!top?.place_id) {
      return json({ ok: false, status: search?.status ?? "ZERO_RESULTS", error: "No match for employer" });
    }

    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${top.place_id}` +
        `&fields=name,formatted_address,formatted_phone_number,international_phone_number,address_components&key=${key}`,
    );
    const details = await detailsRes.json();
    const r = details?.result ?? {};
    const comps: Array<{ long_name: string; types: string[] }> = r.address_components ?? [];
    const comp = (t: string) => comps.find((c) => c.types?.includes(t))?.long_name ?? "";
    // Local 0XX format preferred (the Signio forms want local numbers).
    let phone = String(r.formatted_phone_number ?? r.international_phone_number ?? "").replace(/\D/g, "");
    if (phone.startsWith("27")) phone = "0" + phone.slice(2);

    return json({
      ok: true,
      match_name: r.name ?? top.name ?? name,
      phone: phone || null,
      formatted_address: r.formatted_address ?? top.formatted_address ?? null,
      suburb: comp("sublocality_level_1") || comp("sublocality") || comp("neighborhood") || null,
      city: comp("locality") || comp("administrative_area_level_2") || null,
      postal_code: comp("postal_code") || null,
    });
  } catch (e) {
    console.error("[employer-lookup]", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "Lookup failed" }, 200);
  }
});
