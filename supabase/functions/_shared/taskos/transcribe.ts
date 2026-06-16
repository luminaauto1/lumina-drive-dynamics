// LuminaTaskOS — optional voice-note transcription.
// NOTE: this is the ONE TaskOS capability with an EXTERNAL dependency. The edge
// runtime has no bundled speech-to-text model, so voice notes are transcribed via
// OpenAI Whisper IF an OPENAI_API_KEY secret is configured. Without it, voice
// notes are saved for manual review (the system stays fully functional otherwise).
export function transcriptionAvailable(): boolean {
  return !!Deno.env.get("OPENAI_API_KEY");
}

export async function transcribeAudio(bytes: Uint8Array, filename = "voice.ogg"): Promise<string | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  try {
    const form = new FormData();
    form.append("file", new Blob([bytes]), filename);
    form.append("model", Deno.env.get("OPENAI_STT_MODEL") || "whisper-1");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) { console.error("[taskos] transcribe", res.status, await res.text()); return null; }
    const j = await res.json();
    return typeof j?.text === "string" ? j.text.trim() : null;
  } catch (e) {
    console.error("[taskos] transcribeAudio failed", e instanceof Error ? e.message : e);
    return null;
  }
}
