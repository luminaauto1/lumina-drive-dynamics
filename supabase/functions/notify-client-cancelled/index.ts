import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Format SA phone number to international format: 27XXXXXXXXX
function sanitizePhoneSA(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = "27" + d.slice(1);
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const { applicationId } = await req.json();
    if (!applicationId) {
      return new Response(JSON.stringify({ error: "applicationId required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: app, error } = await sb
      .from("finance_applications")
      .select("first_name, full_name, phone")
      .eq("id", applicationId)
      .maybeSingle();

    if (error || !app) {
      return new Response(JSON.stringify({ error: "application not found", detail: error?.message }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const phone = sanitizePhoneSA(app.phone);
    if (!phone) {
      return new Response(JSON.stringify({ error: "invalid phone" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let firstName = (app.first_name || "").toString().trim();
    if (!firstName && app.full_name) {
      firstName = String(app.full_name).trim().split(/\s+/)[0] || "";
    }
    if (!firstName) firstName = "there";

    const url = `https://api.easysocial.in/api/v1/wa-templates/send/cmpp930hx0ciqbvxp4exrg7t4/19768/4026/API/${phone}?body1=${encodeURIComponent(firstName)}`;
    console.log("[notify-client-cancelled] GET", url);

    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    const raw = await resp.text();
    let body: any; try { body = JSON.parse(raw); } catch { body = { raw }; }

    return new Response(
      JSON.stringify({ success: resp.ok, status: resp.status, body, phone, firstName }),
      { status: resp.ok ? 200 : 502, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[notify-client-cancelled] error", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
