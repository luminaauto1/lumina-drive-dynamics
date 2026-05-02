// Edge function: invite a sales_agent (super_admin only)
// Supports two modes:
//   - inviteByEmail (default): sends Supabase invite email
//   - manualPassword: createUser with a temp password the admin can WhatsApp
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Server-side super_admin check
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRows) {
      return new Response(JSON.stringify({ error: "Forbidden — super admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const mode = String(body.mode || "invite"); // "invite" | "manual"
    const providedPassword = body.password ? String(body.password) : "";
    const fullName = body.full_name ? String(body.full_name) : undefined;

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let userId: string | undefined;
    let tempPassword: string | undefined;
    let emailDelivery: "sent" | "not_sent_existing_user" | "manual" = mode === "manual" ? "manual" : "sent";

    if (mode === "manual") {
      // Generate a strong password if admin didn't supply one
      if (providedPassword && providedPassword.length < 8) {
        return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      tempPassword = providedPassword || generateStrongPassword(14);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : undefined,
      });

      if (createErr) {
        // Likely already exists — look up and (optionally) reset password
        const { data: list } = await admin.auth.admin.listUsers();
        const existing = list?.users?.find((u: any) => (u.email || "").toLowerCase() === email);
        if (!existing) {
          return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        userId = existing.id;
        // Reset to the new temp password so admin can share it
        await admin.auth.admin.updateUserById(existing.id, { password: tempPassword, email_confirm: true });
      } else {
        userId = created.user?.id;
      }
    } else {
      // Default: email invite
      const appOrigin = req.headers.get("Origin") || "https://luminaauto.co.za";
      const redirectTo = `${appOrigin}/update-password`;
      const { data: invite, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
      userId = invite?.user?.id;

      if (inviteErr) {
        const { data: list } = await admin.auth.admin.listUsers();
        const existing = list?.users?.find((u: any) => (u.email || "").toLowerCase() === email);
        if (!existing) {
          return new Response(JSON.stringify({ error: inviteErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        userId = existing.id;
        emailDelivery = "not_sent_existing_user";
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Could not resolve user id" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Assign sales_agent role (idempotent)
    await admin.from("user_roles").upsert({ user_id: userId, role: "sales_agent" }, { onConflict: "user_id,role" });

    return new Response(
      JSON.stringify({ ok: true, user_id: userId, mode, email, temp_password: tempPassword, email_delivery: emailDelivery }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function generateStrongPassword(len = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  // Guarantee diversity
  out += upper[bytes[0] % upper.length];
  out += lower[bytes[1] % lower.length];
  out += digits[bytes[2] % digits.length];
  out += symbols[bytes[3] % symbols.length];
  for (let i = 4; i < len; i++) out += all[bytes[i] % all.length];
  return out.split("").sort(() => 0.5 - Math.random()).join("");
}
