import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const { action, transcript, clientEmail, clientPhone, clientName } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an elite, premium automotive F&I Sales Co-Pilot for Lumina Auto in South Africa. You deal with high-end clients and structured finance. The client's name is ${clientName || 'Unknown'}. Keep language sharp, professional, and direct.`;

    let prompt = "";
    if (action === "hint") {
      prompt = `Here is the live transcript of an ongoing sales call:\n"${transcript}"\n\nProvide ONE short, punchy sentence suggesting what the salesperson should ask or say next to drive the sale, handle an objection, or qualify the buyer. Maximum 15 words.`;
    } else if (action === "summarize") {
      prompt = `Here is the full transcript of a completed sales call:\n"${transcript}"\n\nWrite a concise, professional CRM note summarizing the call. Focus on: Budget, Vehicle Interest, Timeline, and Next Steps. Do not use pleasantries. Format with bullet points.`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Top up in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      throw new Error("AI gateway returned an error");
    }

    const aiData = await aiResponse.json();
    const resultText = aiData.choices?.[0]?.message?.content?.trim() || "No response generated.";

    // If it's a summary, automatically save it to the CRM Audit Logs
    if (action === "summarize") {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // SECURITY: Verify caller-supplied email/phone corresponds to a real
      // lead or finance application before writing to the CRM timeline.
      let leadExists = false;
      if (clientEmail) {
        const { data: l1 } = await supabaseClient.from("leads").select("id").eq("client_email", clientEmail).limit(1).maybeSingle();
        const { data: a1 } = await supabaseClient.from("finance_applications").select("id").eq("email", clientEmail).limit(1).maybeSingle();
        if (l1 || a1) leadExists = true;
      }
      if (!leadExists && clientPhone) {
        const { data: l2 } = await supabaseClient.from("leads").select("id").eq("client_phone", clientPhone).limit(1).maybeSingle();
        const { data: a2 } = await supabaseClient.from("finance_applications").select("id").eq("phone", clientPhone).limit(1).maybeSingle();
        if (l2 || a2) leadExists = true;
      }

      if (!leadExists) {
        return new Response(
          JSON.stringify({ error: "No matching lead or application found for the provided contact." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabaseClient.from("client_audit_logs").insert([{
        client_email: clientEmail || null,
        client_phone: clientPhone || null,
        note: `[AI Call Summary]\n${resultText}`,
        author_name: "AI Co-Pilot",
        action_type: "Call Summary",
      }]);
    }

    return new Response(JSON.stringify({ success: true, result: resultText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("sales-copilot error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
