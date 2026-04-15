import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
