import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const clientEmail = formData.get("clientEmail")?.toString();
    const clientPhone = formData.get("clientPhone")?.toString();
    const clientName = formData.get("clientName")?.toString();

    if (!file) throw new Error("No audio file provided.");

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OPENAI_API_KEY is not set in secrets.");

    // 1. Transcribe via OpenAI Whisper
    const whisperFormData = new FormData();
    whisperFormData.append("file", file);
    whisperFormData.append("model", "whisper-1");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}` },
      body: whisperFormData,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error("Whisper error:", whisperRes.status, errText);
      throw new Error("Audio transcription failed.");
    }

    const whisperData = await whisperRes.json();
    const transcript = whisperData.text;

    if (!transcript || transcript.trim().length < 10) {
      throw new Error("Transcription returned insufficient content.");
    }

    // 2. Summarize via Lovable AI Gateway
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured.");

    const systemPrompt = `You are an elite, premium automotive F&I Sales Co-Pilot for Lumina Auto in South Africa. Client: ${clientName || "Unknown"}. Keep language sharp, professional, and direct.`;
    const prompt = `Here is the full transcript of an uploaded sales call:\n"${transcript}"\n\nWrite a concise, professional CRM note summarizing the call. Focus on: Budget, Vehicle Interest, Timeline, and Next Steps. Do not use pleasantries. Format with bullet points.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
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
      throw new Error("AI summarization failed.");
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content?.trim() || "No summary generated.";

    // 3. Save to CRM Timeline
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await supabaseClient.from("client_audit_logs").insert([{
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
      note: `[AI Audio Upload Summary]\n${summary}`,
      author_name: "AI Co-Pilot",
      action_type: "Call Summary",
    }]);

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("transcribe-call error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
