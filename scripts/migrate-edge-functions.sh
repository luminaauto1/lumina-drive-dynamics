#!/usr/bin/env bash
# ============================================================================
# One-shot migration of edge functions + secrets to the new Supabase project.
#
# Run this ONCE on your computer after:
#   1. Installing the Supabase CLI:  https://supabase.com/docs/guides/cli
#   2. Logging in:                   supabase login
#   3. Redeploying migrate-export in Lovable (so it has the dump-secrets action)
#
# Usage (from the repo root):
#   bash scripts/migrate-edge-functions.sh
#
# What it does:
#   - Deploys every application edge function to the NEW project.
#   - Pulls the function secrets directly from the OLD (Lovable Cloud) project
#     and sets them on the NEW project. Secrets flow old -> your machine -> new;
#     they are never printed and the temp file is shredded at the end.
#
# After it succeeds, delete the temporary bridge function (see end of script).
# ============================================================================
set -euo pipefail

# --- configuration (already filled in for your projects) --------------------
NEW_REF="gkghazemorbxmzzcbaty"
OLD_FUNC_URL="https://geovwgfbbfhhmommyasj.supabase.co/functions/v1/migrate-export"
OLD_ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlb3Z3Z2ZiYmZoaG1vbW15YXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMjc5NDIsImV4cCI6MjA4MjYwMzk0Mn0.Z7tsDUOEndwt8du4zdTK810oBWt1Y3JiYNkwcyRggak"
MIG_KEY="lumina-pub-2026-v2-rotate"
DUMP_TOKEN="eb00143ad408f640f9505c8ce22d9676f702d10d743cecc2f674ec537f2abf23"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

command -v supabase >/dev/null || { echo "❌ Supabase CLI not found. Install: https://supabase.com/docs/guides/cli"; exit 1; }
command -v node >/dev/null     || { echo "❌ Node.js not found (needed to parse secrets)."; exit 1; }
command -v curl >/dev/null     || { echo "❌ curl not found."; exit 1; }

echo "==> Linking the new project ($NEW_REF)…"
supabase link --project-ref "$NEW_REF"

# --- 1. deploy every application edge function (skip shared + bridge dirs) ---
echo "==> Deploying edge functions to the new project…"
for dir in supabase/functions/*/; do
  name="$(basename "$dir")"
  case "$name" in
    _shared|migrate-export|migrate-import-storage) continue ;;
  esac
  echo "    - $name"
  # verify_jwt is read from supabase/config.toml automatically.
  supabase functions deploy "$name" --project-ref "$NEW_REF"
done

# --- 2. pull secrets from the old project and set them on the new ------------
echo "==> Fetching function secrets from the old project…"
SECRETS_JSON="$(mktemp)"
SECRETS_ENV="$(mktemp)"
trap 'rm -f "$SECRETS_JSON" "$SECRETS_ENV"' EXIT

curl -fsS -X POST "$OLD_FUNC_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OLD_ANON" \
  -H "apikey: $OLD_ANON" \
  -H "x-migration-key: $MIG_KEY" \
  -H "x-dump-token: $DUMP_TOKEN" \
  -d '{"action":"dump-secrets"}' > "$SECRETS_JSON"

# Convert {"secrets":{KEY:VALUE,...}} -> KEY=VALUE lines (no values printed).
node -e '
  const o = require(process.argv[1]);
  if (!o || !o.secrets) { console.error("No secrets returned — is dump-secrets deployed?"); process.exit(1); }
  const fs = require("fs");
  const lines = Object.entries(o.secrets).map(([k,v]) => k + "=" + v).join("\n");
  fs.writeFileSync(process.argv[2], lines + "\n");
  console.error("    got " + Object.keys(o.secrets).length + " secrets");
' "$SECRETS_JSON" "$SECRETS_ENV"

echo "==> Setting secrets on the new project…"
supabase secrets set --project-ref "$NEW_REF" --env-file "$SECRETS_ENV"

echo
echo "✅ Done. All edge functions deployed and secrets set on $NEW_REF."
echo
echo "Next: once you've confirmed the new site works, delete the temporary"
echo "bridge function from the OLD project (ask Lovable to remove"
echo "supabase/functions/migrate-export), and rotate LUMINA_INTERNAL_API_KEY"
echo "if you'd like (update src/lib/publicApi.ts to match)."
