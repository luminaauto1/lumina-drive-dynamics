import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatusNotificationRequest {
  clientEmail: string;
  clientName: string;
  newStatus: string;
  applicationId: string;
  accessToken?: string;
  vehicleName?: string;
}

interface EmailTemplate {
  status_key: string;
  subject: string;
  heading: string;
  body_content: string;
  cta_text: string;
  cta_url: string | null;
  is_active: boolean;
}

// Replace template placeholders with actual values
const replaceTemplatePlaceholders = (
  text: string,
  clientName: string,
  vehicleName?: string,
  dashboardUrl?: string,
  uploadUrl?: string
): string => {
  let result = text;
  
  // Simple placeholders
  result = result.replace(/\{\{clientName\}\}/g, clientName);
  result = result.replace(/\{\{vehicleName\}\}/g, vehicleName || 'your vehicle');
  result = result.replace(/\{\{dashboardUrl\}\}/g, dashboardUrl || '');
  result = result.replace(/\{\{uploadUrl\}\}/g, uploadUrl || dashboardUrl || '');
  
  // Conditional blocks: {{#if vehicleName}}...{{else}}...{{/if}}
  const conditionalRegex = /\{\{#if vehicleName\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
  result = result.replace(conditionalRegex, (_, ifContent, elseContent) => {
    return vehicleName ? ifContent : elseContent;
  });
  
  // Simple conditional: {{#if vehicleName}}...{{/if}}
  const simpleConditionalRegex = /\{\{#if vehicleName\}\}([\s\S]*?)\{\{\/if\}\}/g;
  result = result.replace(simpleConditionalRegex, (_, content) => {
    return vehicleName ? content : '';
  });
  
  return result;
};

// Convert markdown-style formatting to HTML
const markdownToHtml = (text: string): string => {
  let html = text;
  
  // Bold: **text** -> <strong>text</strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Bullet lists: - item -> <li>item</li>
  const lines = html.split('\n');
  let inList = false;
  const processedLines: string[] = [];
  
  for (const line of lines) {
    if (line.trim().startsWith('- ') || line.trim().startsWith('• ') || line.trim().startsWith('✅')) {
      if (!inList) {
        processedLines.push('<ul style="margin: 10px 0; padding-left: 20px;">');
        inList = true;
      }
      const content = line.replace(/^[\s]*[-•✅]\s*/, '');
      processedLines.push(`<li style="margin: 5px 0;">${content}</li>`);
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      if (line.trim()) {
        processedLines.push(`<p style="margin: 10px 0;">${line}</p>`);
      } else {
        processedLines.push('<br>');
      }
    }
  }
  
  if (inList) {
    processedLines.push('</ul>');
  }
  
  return processedLines.join('\n');
};

// Generate email HTML from template
const generateEmailHtml = (
  template: EmailTemplate,
  clientName: string,
  accessToken?: string,
  vehicleName?: string
): { subject: string; html: string } => {
  const dashboardUrl = 'https://lumina-auto.lovable.app/dashboard';
  const uploadUrl = accessToken 
    ? `https://lumina-auto.lovable.app/upload-documents/${accessToken}`
    : dashboardUrl;

  // Replace placeholders in all fields
  const subject = replaceTemplatePlaceholders(template.subject, clientName, vehicleName, dashboardUrl, uploadUrl);
  const heading = replaceTemplatePlaceholders(template.heading, clientName, vehicleName, dashboardUrl, uploadUrl);
  const bodyContent = replaceTemplatePlaceholders(template.body_content, clientName, vehicleName, dashboardUrl, uploadUrl);
  const ctaText = replaceTemplatePlaceholders(template.cta_text, clientName, vehicleName, dashboardUrl, uploadUrl);
  let ctaUrl = replaceTemplatePlaceholders(template.cta_url || '{{dashboardUrl}}', clientName, vehicleName, dashboardUrl, uploadUrl);

  // Convert body markdown to HTML
  const bodyHtml = markdownToHtml(bodyContent);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
        <!-- Header -->
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #f0f0f0;">
          <div style="font-size: 24px; font-weight: bold; color: #1a1a1a;">🚗 Lumina Auto</div>
          <p style="color: #666; margin: 5px 0;">Your Vehicle Finance Journey</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px 0;">
          <h2 style="margin: 0 0 20px 0; color: #1a1a1a;">${heading}</h2>
          <div style="color: #333; line-height: 1.8;">
            ${bodyHtml}
          </div>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #0070f3 0%, #0050d0 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; box-shadow: 0 4px 15px rgba(0, 112, 243, 0.3);">
              ${ctaText}
            </a>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px 0; border-top: 2px solid #f0f0f0; color: #666; font-size: 12px;">
          <p style="margin: 5px 0;">Lumina Auto | Premium Vehicle Finance</p>
          <p style="margin: 5px 0;">Questions? Reply to this email or WhatsApp us at +27 68 601 7462</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
};

// Fallback templates if database fetch fails
const getFallbackEmailContent = (
  status: string,
  clientName: string,
  accessToken?: string,
  vehicleName?: string
): { subject: string; html: string } => {
  const dashboardUrl = 'https://lumina-auto.lovable.app/dashboard';
  
  const fallbackTemplate: EmailTemplate = {
    status_key: status,
    subject: `Application Update - Lumina Auto`,
    heading: `Hi ${clientName},`,
    body_content: `There's been an update to your finance application.\n\nPlease log in to your dashboard to view the latest status.`,
    cta_text: 'View Dashboard',
    cta_url: dashboardUrl,
    is_active: true,
  };

  return generateEmailHtml(fallbackTemplate, clientName, accessToken, vehicleName);
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      clientEmail, 
      clientName, 
      newStatus, 
      applicationId,
      accessToken,
      vehicleName 
    }: StatusNotificationRequest = await req.json();

    console.log(`Sending status notification: ${newStatus} to ${clientEmail}`);

    if (!clientEmail || !clientName || !newStatus) {
      throw new Error("Missing required fields: clientEmail, clientName, or newStatus");
    }

    // Try to fetch template from database
    let emailContent: { subject: string; html: string };
    
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { data: template, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('status_key', newStatus)
        .single();

      if (error || !template) {
        console.log(`No template found for status ${newStatus}, using fallback`);
        emailContent = getFallbackEmailContent(newStatus, clientName, accessToken, vehicleName);
      } else if (!template.is_active) {
        console.log(`Template for ${newStatus} is disabled, skipping email`);
        return new Response(
          JSON.stringify({ success: true, message: 'Email disabled for this status' }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } else {
        emailContent = generateEmailHtml(template as EmailTemplate, clientName, accessToken, vehicleName);
      }
    } else {
      console.log('Supabase credentials not available, using fallback template');
      emailContent = getFallbackEmailContent(newStatus, clientName, accessToken, vehicleName);
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Lumina Auto <onboarding@resend.dev>",
        to: [clientEmail],
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      throw new Error(`Failed to send email: ${error}`);
    }

    const result = await response.json();
    console.log("Status notification sent successfully:", result);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-status-notification function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);