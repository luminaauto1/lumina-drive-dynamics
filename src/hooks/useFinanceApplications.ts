import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

export type FinanceApplication = Tables<'finance_applications'> & {
  vehicle?: {
    make: string;
    model: string;
    year: number;
  };
  internal_status?: string | null;
};

export const useFinanceApplications = () => {
  return useQuery({
    queryKey: ['finance-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_applications')
        .select(`
          *,
          vehicle:vehicles!finance_applications_vehicle_id_fkey(make, model, year)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as FinanceApplication[];
    },
  });
};

export const useUpdateFinanceApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      // 1. Fetch current app to detect status change and get email
      const { data: currentApp } = await supabase
        .from('finance_applications')
        .select('*')
        .eq('id', id)
        .single();

      // 2. Perform the database update
      const { data, error } = await supabase
        .from('finance_applications')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // 3. Auto-Mailer Engine
      if (updates.status && currentApp && updates.status !== currentApp.status && currentApp.email) {
        let subject = "";
        let message = "";
        const firstName = currentApp.first_name || "Valued Client";

        switch (updates.status) {
          case 'pre_approved':
            subject = "Great News! Your Finance is Pre-Approved";
            message = `<p>Hi ${firstName},</p><p>Fantastic news. Your finance application has been pre-approved. Our F&I team will be in touch shortly to help you finalize your vehicle selection within your approved structure.</p>`;
            break;
          case 'approved':
            subject = "Congratulations! Your Vehicle Finance is Approved";
            message = `<p>Hi ${firstName},</p><p>Congratulations. Your vehicle finance has been officially approved by the bank. We are currently preparing your contracts and will contact you to arrange the signing and delivery process.</p>`;
            break;
          case 'declined':
            subject = "Update on Your Finance Application";
            message = `<p>Hi ${firstName},</p><p>We regret to inform you that the banks have currently declined your finance application. Our F&I team will reach out to explain the reasons and discuss potential future steps or alternative options to secure your mobility.</p>`;
            break;
          case 'validations_pending':
            subject = "Action Required: FICA & Validations";
            message = `<p>Hi ${firstName},</p><p>Your application is moving forward. To proceed to the final approval stage, the bank requires standard validation documents (e.g., ID, Proof of Address, Payslips). Our team will contact you shortly with the exact requirements.</p>`;
            break;
          case 'delivered':
            subject = "Congratulations on Your New Vehicle";
            message = `<p>Hi ${firstName},</p><p>Congratulations on taking delivery of your new vehicle. Thank you for choosing Lumina Auto. We wish you many safe and happy miles.</p>`;
            break;
        }

        if (subject && message) {
          const emailHtml = `
            <div style="font-family: system-ui, -apple-system, sans-serif; background-color: #09090b; color: #ffffff; padding: 40px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #27272a;">
              <h2 style="color: #ffffff; border-bottom: 1px solid #27272a; padding-bottom: 15px; font-weight: 500; letter-spacing: 1px;">LUMINA AUTO</h2>
              <div style="color: #a1a1aa; font-size: 15px; line-height: 1.6; padding-top: 10px;">
                ${message}
              </div>
              <br/><br/>
              <p style="color: #52525b; font-size: 12px; border-top: 1px solid #27272a; padding-top: 15px;">
                Pretoria, South Africa<br/>Premium Pre-Owned Vehicles & Finance
              </p>
            </div>
          `;

          // Direct Frontend Dispatch to EmailJS
          fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              service_id: "service_myacl2m",
              template_id: "template_b2igduv",
              user_id: "pWT3blntfZk-_syL4",
              template_params: {
                to_email: currentApp.email,
                subject: subject,
                html_message: emailHtml,
              }
            }),
          })
          .then(async (res) => {
            if (!res.ok) {
              const text = await res.text();
              console.error("EmailJS API Rejected the request:", text);
            } else {
              console.log("EmailJS successfully received the payload.");
            }
          })
          .catch(err => console.error("Frontend failed to reach EmailJS:", err));
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-applications'] });
      toast.success('Status updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update application');
    },
  });
};

export const useDeleteFinanceApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('finance_applications')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-applications'] });
      toast.success('Application deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete application: ' + error.message);
    },
  });
};
