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

    // Pre-fetch existing AI memory for this client (if summarizing)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let existingApp: any = null;
    if (action === "summarize") {
      let q = supabaseClient.from("finance_applications").select("id, ai_vehicle_interest, ai_budget, ai_timeline").limit(1);
      if (clientEmail) {
        const { data } = await q.eq("email", clientEmail).maybeSingle();
        existingApp = data;
      }
      if (!existingApp && clientPhone) {
        const { data } = await supabaseClient.from("finance_applications").select("id, ai_vehicle_interest, ai_budget, ai_timeline").eq("phone", clientPhone).limit(1).maybeSingle();
        existingApp = data;
      }
    }

    const memoryContext = existingApp
      ? `\n\nKNOWN CLIENT FACTS (carry these forward unless the new transcript contradicts them):\n- Vehicle Interest: ${existingApp.ai_vehicle_interest || 'unknown'}\n- Budget: ${existingApp.ai_budget || 'unknown'}\n- Timeline: ${existingApp.ai_timeline || 'unknown'}`
      : "";

    const systemPrompt = `You are an elite, premium automotive F&I Sales Co-Pilot for Lumina Auto in South Africa. You deal with high-end clients and structured finance. The client's name is ${clientName || 'Unknown'}. Keep language sharp, professional, and direct.${memoryContext}`;

    let prompt = "";
    let useJson = false;
    if (action === "hint") {
      prompt = `Here is the live transcript of an ongoing sales call:\n"${transcript}"\n\nProvide ONE short, punchy sentence suggesting what the salesperson should ask or say next to drive the sale, handle an objection, or qualify the buyer. Maximum 15 words.`;
    } else if (action === "summarize") {
      useJson = true;
      prompt = `Transcript of completed sales call:\n"${transcript}"\n\nReturn ONLY a JSON object with this exact shape:\n{\n  "new_note_summary": "Concise CRM bullet-point note for THIS call. Focus on what was discussed: budget, vehicle interest, timeline, next steps. No pleasantries.",\n  "updated_vehicle": "Vehicle of interest. Retain the KNOWN value if not contradicted; otherwise update.",\n  "updated_budget": "Client budget. Retain KNOWN value if not contradicted; otherwise update.",\n  "updated_timeline": "Purchase timeline. Retain KNOWN value if not contradicted; otherwise update."\n}\nIf a field is genuinely unknown after considering both KNOWN facts and the transcript, use an empty string.`;
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
        ...(useJson ? { response_format: { type: "json_object" } } : {}),
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

    if (action === "summarize") {
      let parsed: any = {};
      try { parsed = JSON.parse(resultText); } catch { parsed = { new_note_summary: resultText }; }
      const noteText = parsed.new_note_summary || resultText;

      let leadExists = !!existingApp;
      if (!leadExists && clientEmail) {
        const { data: l1 } = await supabaseClient.from("leads").select("id").eq("client_email", clientEmail).limit(1).maybeSingle();
        if (l1) leadExists = true;
      }
      if (!leadExists && clientPhone) {
        const { data: l2 } = await supabaseClient.from("leads").select("id").eq("client_phone", clientPhone).limit(1).maybeSingle();
        if (l2) leadExists = true;
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
        note: `[AI Call Summary]\n${noteText}`,
        author_name: "AI Co-Pilot",
        action_type: "Call Summary",
      }]);

      if (existingApp?.id) {
        const memUpdate: any = {};
        if (parsed.updated_vehicle) memUpdate.ai_vehicle_interest = parsed.updated_vehicle;
        if (parsed.updated_budget) memUpdate.ai_budget = parsed.updated_budget;
        if (parsed.updated_timeline) memUpdate.ai_timeline = parsed.updated_timeline;
        if (Object.keys(memUpdate).length > 0) {
          await supabaseClient.from("finance_applications").update(memUpdate).eq("id", existingApp.id);
        }
      }

      return new Response(JSON.stringify({ success: true, result: noteText, memory: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
