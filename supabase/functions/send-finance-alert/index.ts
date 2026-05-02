import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, checkInternalKey } from "../_shared/publicGuard.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface FinanceAlertRequest {
  applicationId: string;
}

// HTML escape function to prevent XSS
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const sendEmail = async (to: string, subject: string, html: string) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Lumina Auto <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return response.json();
};

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const guard = checkInternalKey(req);
  if (guard) return guard;

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { applicationId }: FinanceAlertRequest = await req.json();
    if (!applicationId || typeof applicationId !== "string") {
      return new Response(
        JSON.stringify({ error: "applicationId required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Pull all values from DB — never trust caller-supplied recipients
    const { data: application, error: appError } = await supabaseAdmin
      .from("finance_applications")
      .select("full_name, email, net_salary")
      .eq("id", applicationId)
      .maybeSingle();

    if (appError || !application) {
      console.error("Application not found:", appError?.message);
      return new Response(
        JSON.stringify({ error: "Application not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const clientName = application.full_name || "Client";
    const clientEmail = application.email;
    const netSalary = application.net_salary as number | null;

    // Look up admin recipient from site_settings — not from the request body
    const { data: settings } = await supabaseAdmin
      .from("site_settings")
      .select("primary_email")
      .maybeSingle();
    const adminEmailAddress = settings?.primary_email || "lumina.auto1@gmail.com";

    console.log(`Processing finance alert for application: ${applicationId}`);

    const safeClientName = escapeHtml(clientName);
    const safeClientEmail = escapeHtml(clientEmail);

    const baseUrl = "https://luminaauto.co.za";
    const dealRoomLink = `${baseUrl}/admin/finance/${applicationId}`;
    const dashboardLink = `${baseUrl}/dashboard`;

    const adminEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a1a1a; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">New Application Received</h1>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Client:</strong> ${safeClientName}</p>
          <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${safeClientEmail}</p>
          <p style="margin: 0;"><strong>Net Salary:</strong> R${netSalary ? netSalary.toLocaleString() : 'Not provided'}</p>
        </div>
        
        <a href="${dealRoomLink}" style="display: inline-block; background: #d4af37; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">
          Open Deal Room →
        </a>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated notification from Lumina Auto.
        </p>
      </div>
    `;

    const adminEmailResult = await sendEmail(
      adminEmailAddress,
      `🚗 New Finance Application from ${safeClientName}`,
      adminEmailHtml
    );

    console.log("Admin email sent:", adminEmailResult);

    // Email 2: To Client (using their verified email from the application)
    const clientEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #d4af37; margin: 0;">LUMINA AUTO</h1>
          <p style="color: #666; margin: 5px 0 0 0;">Drive Your Aspirations</p>
        </div>
        
        <h2 style="color: #1a1a1a;">Hi ${escapeHtml(clientName.split(' ')[0])},</h2>
        
        <p style="color: #333; line-height: 1.6;">
          Thank you for submitting your finance application with Lumina Auto. We have received your details and our team is currently verifying your profile.
        </p>
        
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 20px; border-radius: 8px; margin: 25px 0;">
          <p style="color: #d4af37; margin: 0 0 10px 0; font-weight: bold;">What happens next?</p>
          <ol style="color: #fff; margin: 0; padding-left: 20px; line-height: 1.8;">
            <li>We analyze your financial profile</li>
            <li>Your budget is confirmed</li>
            <li>We curate vehicle options matched to your budget</li>
            <li>You select your perfect vehicle</li>
          </ol>
        </div>
        
        <p style="color: #333; line-height: 1.6;">
          Track your application status anytime by logging into your dashboard:
        </p>
        
        <a href="${dashboardLink}" style="display: inline-block; background: #d4af37; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          View My Dashboard →
        </a>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
          If you have any questions, reply to this email or WhatsApp us at +27 68 601 7462.
        </p>
        
        <p style="color: #999; font-size: 12px; margin-top: 20px;">
          © ${new Date().getFullYear()} Lumina Auto. All rights reserved.
        </p>
      </div>
    `;

    const clientEmailResult = await sendEmail(
      clientEmail,
      "Application Received - Lumina Auto",
      clientEmailHtml
    );

    console.log("Client email sent:", clientEmailResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        adminEmail: adminEmailResult,
        clientEmail: clientEmailResult 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-finance-alert function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
