-- Create email_templates table for custom notification templates
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_key TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  heading TEXT NOT NULL,
  body_content TEXT NOT NULL,
  cta_text TEXT DEFAULT 'Track Your Application',
  cta_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read templates
CREATE POLICY "Authenticated users can read email templates"
  ON public.email_templates FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to update templates
CREATE POLICY "Admins can update email templates"
  ON public.email_templates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to insert templates
CREATE POLICY "Admins can insert email templates"
  ON public.email_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates for all 9 statuses
INSERT INTO public.email_templates (status_key, subject, heading, body_content, cta_text, cta_url) VALUES
('pending', '✅ Application Received - Lumina Auto', 'Hi {{clientName}}! 👋', 'Thank you for submitting your finance application with Lumina Auto.\n\nOur team is currently analyzing your profile. We''ll be in touch shortly with an update on your application.\n\n**What happens next?**\n- We review your application details\n- We assess your finance eligibility\n- You''ll receive an update within 24-48 hours', 'Track Your Application', '{{dashboardUrl}}'),

('application_submitted', '📋 Application Under Review - Lumina Auto', 'Hi {{clientName}}!', 'Your finance application is now under review by our team.\n\nWe''re carefully reviewing your details to determine the best finance options for you.', 'View Status', '{{dashboardUrl}}'),

('pre_approved', '🎉 Pre-Approved! Documents Required - Lumina Auto', 'Congratulations {{clientName}}! 🎉', '**You''ve been pre-approved for vehicle finance!**\n\nTo proceed, we need you to upload the following documents:\n\n✅ ID Card (front and back)\n✅ Driver''s License\n✅ Latest 3 Months Payslips\n✅ Latest 3 Months Bank Statements\n\nThe sooner you upload, the faster we can proceed!', '📤 Upload Documents Now', '{{uploadUrl}}'),

('documents_received', '📁 Documents Received - Lumina Auto', 'Thank you {{clientName}}!', 'We have received your documents and are now verifying them.\n\nOur team is reviewing your documents to ensure everything is in order before submitting to the bank.\n\nWe''ll update you as soon as the verification is complete.', 'Track Progress', '{{dashboardUrl}}'),

('validations_pending', '🏦 Submitted to Bank - Lumina Auto', 'Exciting News {{clientName}}!', 'Your application has been submitted to the bank for final approval.\n\nThe bank is now reviewing your application. This typically takes 1-3 business days.\n\nWe''ll notify you immediately once we receive their response.', 'Track Progress', '{{dashboardUrl}}'),

('validations_complete', '🎉 Bank Approved! - Lumina Auto', 'Fantastic News {{clientName}}! 🎉', '**The bank has approved your finance application!**\n\nWe are now preparing your contract. You''re just a few steps away from your new vehicle!', 'View Details', '{{dashboardUrl}}'),

('contract_sent', '📝 Contract Ready for Signature - Lumina Auto', 'Hi {{clientName}}!', 'Your contract has been sent and is ready for your signature.\n\nPlease review the contract carefully and sign at your earliest convenience.\n\nIf you have any questions about the contract, don''t hesitate to reach out.', 'Review Contract', '{{dashboardUrl}}'),

('contract_signed', '✍️ Contract Signed - Preparing Delivery! - Lumina Auto', 'Thank you {{clientName}}! ✍️', 'Your contract has been signed successfully!\n\n{{#if vehicleName}}Your **{{vehicleName}}** is being prepared for delivery.{{else}}Your vehicle is being prepared for delivery.{{/if}}\n\nWe''ll be in touch shortly with delivery details and scheduling.', 'View Status', '{{dashboardUrl}}'),

('vehicle_delivered', '🚗🎉 Congratulations! Vehicle Delivered - Lumina Auto', 'Congratulations {{clientName}}! 🎉🚗', '**Your vehicle has been delivered!**\n\n{{#if vehicleName}}We hope you enjoy your new **{{vehicleName}}**!{{else}}We hope you enjoy your new vehicle!{{/if}}\n\nThank you for choosing Lumina Auto. It''s been a pleasure serving you.\n\n**Important Reminders:**\n- Keep up with your service schedule\n- Contact us for any after-sales support\n- Refer friends and family for exclusive deals!', 'Visit Dashboard', '{{dashboardUrl}}'),

('declined', 'Application Update - Lumina Auto', 'Hi {{clientName}},', 'Unfortunately, we were unable to approve your finance application at this time.\n\nThis could be due to various factors, and we encourage you to:\n- Contact us to discuss alternative options\n- Consider reapplying in the future\n- Explore our cash purchase options\n\nPlease don''t hesitate to reach out – we''re here to help find solutions.', 'WhatsApp Us', 'https://wa.me/27686017462'),

('vehicle_selected', '🚗 Vehicle Reserved! - Lumina Auto', 'Great Choice {{clientName}}! 🚗', '{{#if vehicleName}}Your **{{vehicleName}}** has been reserved!{{else}}Your selected vehicle has been reserved!{{/if}}\n\nWe''re now preparing the contract and will be in touch shortly with the next steps.', 'View Details', '{{dashboardUrl}}');