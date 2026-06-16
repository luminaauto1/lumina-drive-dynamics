// LuminaTaskOS — local embeddings via Supabase.ai `gte-small` (384 dims).
// Runs inside the edge runtime; NO external provider or API key needed. Used to
// give the second brain true semantic recall (pgvector cosine search).
// deno-lint-ignore no-explicit-any
declare const Supabase: any;

// deno-lint-ignore no-explicit-any
let _session: any = null;

export async function embedText(text: string): Promise<number[] | null> {
  try {
    const clean = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 4000);
    if (!clean) return null;
    if (typeof Supabase === "undefined" || !Supabase?.ai) {
      console.error("[taskos] Supabase.ai unavailable for embeddings");
      return null;
    }
    if (!_session) _session = new Supabase.ai.Session("gte-small");
    const out = await _session.run(clean, { mean_pool: true, normalize: true });
    return Array.isArray(out) ? (out as number[]) : null;
  } catch (e) {
    console.error("[taskos] embedText failed", e instanceof Error ? e.message : e);
    return null;
  }
}

// pgvector accepts a text literal like "[0.1,0.2,...]".
export function toVectorLiteral(vec: number[]): string {
  return "[" + vec.join(",") + "]";
}
