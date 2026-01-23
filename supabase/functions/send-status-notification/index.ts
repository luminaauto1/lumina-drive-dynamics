import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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

// Email templates for each status
const getEmailContent = (
  status: string,
  clientName: string,
  accessToken?: string,
  vehicleName?: string
): { subject: string; html: string } => {
  const dashboardUrl = 'https://lumina-auto.lovable.app/dashboard';
  const uploadUrl = accessToken 
    ? `https://lumina-auto.lovable.app/upload-documents/${accessToken}`
    : dashboardUrl;

  const baseStyle = `
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #f0f0f0; }
      .logo { font-size: 24px; font-weight: bold; color: #1a1a1a; }
      .content { padding: 30px 0; }
      .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin: 10px 0; }
      .cta-button { display: inline-block; background: #0070f3; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
      .footer { text-align: center; padding: 20px 0; border-top: 2px solid #f0f0f0; color: #666; font-size: 12px; }
      .step-indicator { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
    </style>
  `;

  const header = `
    <div class="header">
      <div class="logo">🚗 Lumina Auto</div>
      <p style="color: #666; margin: 5px 0;">Your Vehicle Finance Journey</p>
    </div>
  `;

  const footer = `
    <div class="footer">
      <p>Lumina Auto | Premium Vehicle Finance</p>
      <p>Questions? Reply to this email or WhatsApp us at +27 68 601 7462</p>
    </div>
  `;

  const templates: Record<string, { subject: string; html: string }> = {
    pending: {
      subject: "✅ Application Received - Lumina Auto",
      html: `
        ${baseStyle}
        <div class="container">
          ${header}
          <div class="content">
            <h2>Hi ${clientName}! 👋</h2>
            <p>Thank you for submitting your finance application with Lumina Auto.</p>
            <div class="step-indicator">
              <strong>📍 Current Step:</strong> Application Received<br>
              <small>Step 1 of 9</small>
            </div>
            <p>Our team is currently analyzing your profile. We'll be in touch shortly with an update on your application.</p>
            <p><strong>What happens next?</strong></p>
            <ul>
              <li>We review your application details</li>
              <li>We assess your finance eligibility</li>
              <li>You'll receive an update within 24-48 hours</li>
            </ul>
            <a href="${dashboardUrl}" class="cta-button">Track Your Application</a>
          </div>
          ${footer}
        </div>
      `,
    },
    application_submitted: {
      subject: "📋 Application Under Review - Lumina Auto",
      html: `
        ${baseStyle}
        <div class="container">
          ${header}
          <div class="content">
            <h2>Hi ${clientName}!</h2>
            <p>Your finance application is now under review by our team.</p>
            <div class="step-indicator">
              <strong>📍 Current Step:</strong> Application Submitted<br>
              <small>Step 2 of 9</small>
            </div>
            <p>We're carefully reviewing your details to determine the best finance options for you.</p>
            <a href="${dashboardUrl}" class="cta-button">View Status</a>
          </div>
          ${footer}
        </div>
      `,
    },
    pre_approved: {
      subject: "🎉 Pre-Approved! Documents Required - Lumina Auto",
      html: `
        ${baseStyle}
        <div class="container">
          ${header}
          <div class="content">
            <h2>Congratulations ${clientName}! 🎉</h2>
            <p style="font-size: 18px; color: #22c55e;"><strong>You've been pre-approved for vehicle finance!</strong></p>
            <div class="step-indicator">
              <strong>📍 Current Step:</strong> Pre-Approved (Documents Required)<br>
              <small>Step 3 of 9</small>
            </div>
            <p>To proceed, we need you to upload the following documents:</p>
            <ul>
              <li>✅ ID Card (front and back)</li>
              <li>✅ Driver's License</li>
              <li>✅ Latest 3 Months Payslips</li>
              <li>✅ Latest 3 Months Bank Statements</li>
            </ul>
            <a href="${uploadUrl}" class="cta-button">📤 Upload Documents Now</a>
            <p style="color: #666; font-size: 14px;">The sooner you upload, the faster we can proceed!</p>
          </div>
          ${footer}
        </div>
      `,
    },
    documents_received: {
      subject: "📁 Documents Received - Lumina Auto",
      html: `
        ${baseStyle}
        <div class="container">
          ${header}
          <div class="content">
            <h2>Thank you ${clientName}!</h2>
            <p>We have received your documents and are now verifying them.</p>
            <div class="step-indicator">
              <strong>📍 Current Step:</strong> Documents Received<br>
              <small>Step 4 of 9</small>
            </div>
            <p>Our team is reviewing your documents to ensure everything is in order before submitting to the bank.</p>
            <p>We'll update you as soon as the verification is complete.</p>
            <a href="${dashboardUrl}" class="cta-button">Track Progress</a>
          </div>
          ${footer}
        </div>
      `,
    },
    validations_pending: {
      subject: "🏦 Submitted to Bank - Lumina Auto",
      html: `
        ${baseStyle}
        <div class="container">
          ${header}
          <div class="content">
            <h2>Exciting News ${clientName}!</h2>
            <p>Your application has been submitted to the bank for final approval.</p>
            <div class="step-indicator">
              <strong>📍 Current Step:</strong> At Bank - Awaiting Response<br>
              <small>Step 5 of 9</small>
            </div>
            <p>The bank is now reviewing your application. This typically takes 1-3 business days.</p>
            <p>We'll notify you immediately once we receive their response.</p>
            <a href="${dashboardUrl}" class="cta-button">Track Progress</a>
          </div>
          ${footer}
        </div>
      `,
    },
    validations_complete: {
      subject: "🎉 Bank Approved! - Lumina Auto",
      html: `
        ${baseStyle}
        <div class="container">
          ${header}
          <div class="content">
            <h2>Fantastic News ${clientName}! 🎉</h2>
            <p style="font-size: 18px; color: #22c55e;"><strong>The bank has approved your finance application!</strong></p>
            <div class="step-indicator">
              <strong>📍 Current Step:</strong> Bank Approved<br>
              <small>Step 6 of 9</small>
            </div>
            <p>We are now preparing your contract. You're just a few steps away from your new vehicle!</p>
            <a href="${dashboardUrl}" class="cta-button">View Details</a>
          </div>
          ${footer}
        </div>
      `,
    },
    contract_sent: {
      subject: "📝 Contract Ready for Signature - Lumina Auto",
      html: `
        ${baseStyle}
        <div class="container">
          ${header}
          <div class="content">
            <h2>Hi ${clientName}!</h2>
            <p>Your contract has been sent and is ready for your signature.</p>
            <div class="step-indicator">
              <strong>📍 Current Step:</strong> Contract Sent<br>
              <small>Step 7 of 9</small>
            </div>
            <p>Please review the contract carefully and sign at your earliest convenience.</p>
            <p>If you have any questions about the contract, don't hesitate to reach out.</p>
            <a href="${dashboardUrl}" class="cta-button">Review Contract</a>
          </div>
          ${footer}
        </div>
      `,
    },
    contract_signed: {
      subject: "✍️ Contract Signed - Preparing Delivery! - Lumina Auto",
      html: `
        ${baseStyle}
        <div class="container">
          ${header}
          <div class="content">
            <h2>Thank you ${clientName}! ✍️</h2>
            <p>Your contract has been signed successfully!</p>
            <div class="step-indicator">
              <strong>📍 Current Step:</strong> Contract Signed<br>
              <small>Step 8 of 9</small>
            </div>
            ${vehicleName ? `<p>Your <strong>${vehicleName}</strong> is being prepared for delivery.</p>` : '<p>Your vehicle is being prepared for delivery.</p>'}
            <p>We'll be in touch shortly with delivery details and scheduling.</p>
            <a href="${dashboardUrl}" class="cta-button">View Status</a>
          </div>
          ${footer}
        </div>
      `,
    },
    vehicle_delivered: {
      subject: "🚗🎉 Congratulations! Vehicle Delivered - Lumina Auto",
      html: `
        ${baseStyle}
        <div class="container">
          ${header}
          <div class="content">
            <h2>Congratulations ${clientName}! 🎉🚗</h2>
            <p style="font-size: 20px; color: #f59e0b;"><strong>Your vehicle has been delivered!</strong></p>
            <div class="step-indicator" style="background: #fef3c7;">
              <strong>🏆 Journey Complete!</strong><br>
              <small>Step 9 of 9 - All Done!</small>
            </div>
            ${vehicleName ? `<p>We hope you enjoy your new <strong>${vehicleName}</strong>!</p>` : '<p>We hope you enjoy your new vehicle!</p>'}
            <p>Thank you for choosing Lumina Auto. It's been a pleasure serving you.</p>
            <p><strong>Important Reminders:</strong></p>
            <ul>
              <li>Keep up with your service schedule</li>
              <li>Contact us for any after-sales support</li>
              <li>Refer friends and family for exclusive deals!</li>
            </ul>
            <a href="${dashboardUrl}" class="cta-button">Visit Dashboard</a>
          </div>
          ${footer}
        </div>
      `,
    },
    declined: {
      subject: "Application Update - Lumina Auto",
      html: `
        ${baseStyle}
        <div class="container">
          ${header}
          <div class="content">
            <h2>Hi ${clientName},</h2>
            <p>Unfortunately, we were unable to approve your finance application at this time.</p>
            <p>This could be due to various factors, and we encourage you to:</p>
            <ul>
              <li>Contact us to discuss alternative options</li>
              <li>Consider reapplying in the future</li>
              <li>Explore our cash purchase options</li>
            </ul>
            <p>Please don't hesitate to reach out – we're here to help find solutions.</p>
            <a href="https://wa.me/27686017462" class="cta-button">WhatsApp Us</a>
          </div>
          ${footer}
        </div>
      `,
    },
    vehicle_selected: {
      subject: "🚗 Vehicle Reserved! - Lumina Auto",
      html: `
        ${baseStyle}
        <div class="container">
          ${header}
          <div class="content">
            <h2>Great Choice ${clientName}! 🚗</h2>
            ${vehicleName ? `<p>Your <strong>${vehicleName}</strong> has been reserved!</p>` : '<p>Your selected vehicle has been reserved!</p>'}
            <div class="step-indicator">
              <strong>📍 Status:</strong> Vehicle Reserved<br>
              <small>Preparing Contract</small>
            </div>
            <p>We're now preparing the contract and will be in touch shortly with the next steps.</p>
            <a href="${dashboardUrl}" class="cta-button">View Details</a>
          </div>
          ${footer}
        </div>
      `,
    },
  };

  return templates[status] || {
    subject: "Application Update - Lumina Auto",
    html: `
      ${baseStyle}
      <div class="container">
        ${header}
        <div class="content">
          <h2>Hi ${clientName},</h2>
          <p>There's been an update to your finance application.</p>
          <p>Please log in to your dashboard to view the latest status.</p>
          <a href="${dashboardUrl}" class="cta-button">View Dashboard</a>
        </div>
        ${footer}
      </div>
    `,
  };
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

    const { subject, html } = getEmailContent(newStatus, clientName, accessToken, vehicleName);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Lumina Auto <onboarding@resend.dev>",
        to: [clientEmail],
        subject,
        html,
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
