// Supabase connection module (frontend).
//
// MIGRATION NOTE (Lovable -> Vercel): this file was previously auto-generated
// by Lovable. It is now hand-maintained. It reads its configuration from
// environment variables so the same build works locally (.env) and on Vercel
// (Project Settings -> Environment Variables). Vite inlines VITE_* variables
// at BUILD time — changing them on Vercel requires a redeploy.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// Lovable exports name the anon key VITE_SUPABASE_PUBLISHABLE_KEY; accept the
// conventional VITE_SUPABASE_ANON_KEY as a fallback so either works on Vercel.
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

// Fail fast with an actionable message instead of letting supabase-js throw a
// cryptic "supabaseUrl is required" deep inside the app. A misconfigured
// Vercel deploy surfaces here on first load.
function assertConfig(): { url: string; key: string } {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!SUPABASE_ANON_KEY)
    missing.push('VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY)');
  if (missing.length > 0) {
    throw new Error(
      `Supabase client misconfigured — missing env var(s): ${missing.join(', ')}. ` +
        'Locally: copy .env.example to .env. On Vercel: set them under ' +
        'Project Settings -> Environment Variables, then redeploy.',
    );
  }
  try {
    new URL(SUPABASE_URL!);
  } catch {
    throw new Error(
      `VITE_SUPABASE_URL is not a valid URL: "${SUPABASE_URL}". ` +
        'Expected something like https://<project-ref>.supabase.co',
    );
  }
  return { url: SUPABASE_URL!, key: SUPABASE_ANON_KEY! };
}

// Module-level singleton: every import shares one client, so the browser keeps
// a single auth session and a single realtime websocket. Connection pooling to
// Postgres itself is handled server-side by Supabase's Supavisor pooler — the
// browser only ever talks HTTP to the REST/auth/functions gateways, so no
// client-side pool is needed (or possible).
let _client: SupabaseClient<Database> | null = null;

function getClient(): SupabaseClient<Database> {
  if (_client) return _client;
  const { url, key } = assertConfig();
  _client = createClient<Database>(url, key, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: { 'x-application-name': 'lumina-drive-dynamics' },
    },
  });
  return _client;
}

// Existing import style throughout the app is preserved:
//   import { supabase } from "@/integrations/supabase/client";
export const supabase = getClient();
