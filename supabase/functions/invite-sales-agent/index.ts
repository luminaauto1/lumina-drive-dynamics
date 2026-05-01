// Edge function: invite a sales_agent (super_admin only)
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

    // Verify caller is super_admin
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

    // Server-side role check
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
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Send invite email (creates the user if they don't exist)
    const redirectTo = `${new URL(req.url).origin.replace("supabase.co", "lovable.app")}/update-password`;
    const { data: invite, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

    let userId: string | undefined = invite?.user?.id;

    if (inviteErr) {
      // If user already exists, look them up via list and just assign role
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users?.find((u: any) => (u.email || "").toLowerCase() === email);
      if (!existing) {
        return new Response(JSON.stringify({ error: inviteErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = existing.id;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Could not resolve user id" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Assign sales_agent role (idempotent)
    await admin.from("user_roles").upsert({ user_id: userId, role: "sales_agent" }, { onConflict: "user_id,role" });

    return new Response(JSON.stringify({ ok: true, user_id: userId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
