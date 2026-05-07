import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

// SECURITY: This function is locked to a single internal recipient to prevent
// being abused as an open SMTP relay. The 'to' field in the request payload
// is intentionally ignored.
const HARDCODED_RECIPIENT = "lumina.auto1@gmail.com";
const MAX_SUBJECT_LEN = 300;
const MAX_HTML_LEN = 50_000;

const handler = async (req: Request): Promise<Response> => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const { subject, html } = await req.json();

    if (typeof subject !== "string" || subject.trim().length === 0) {
      throw new Error("Invalid subject");
    }
    if (typeof html !== "string" || html.trim().length === 0) {
      throw new Error("Invalid html body");
    }

    const safeSubject = subject.slice(0, MAX_SUBJECT_LEN);
    const safeHtml = html.slice(0, MAX_HTML_LEN);

    const serviceId = Deno.env.get("EMAILJS_SERVICE_ID");
    const templateId = Deno.env.get("EMAILJS_TEMPLATE_ID");
    const publicKey = Deno.env.get("EMAILJS_PUBLIC_KEY");
    const privateKey = Deno.env.get("EMAILJS_PRIVATE_KEY");

    if (!serviceId || !templateId || !publicKey) {
      throw new Error("EmailJS credentials not configured");
    }

    const emailjsResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          to_email: HARDCODED_RECIPIENT,
          subject: safeSubject,
          html_message: safeHtml,
        }
      }),
    });

    if (!emailjsResponse.ok) {
      const errorText = await emailjsResponse.text();
      throw new Error(`EmailJS API error: ${errorText}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-email error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
