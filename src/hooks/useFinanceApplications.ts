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

      // 3. Auto-Mailer Engine — Dynamic Templates
      if (updates.status && currentApp && updates.status !== currentApp.status && currentApp.email) {
        const { data: template } = await supabase
          .from('email_templates')
          .select('*')
          .eq('status_key', updates.status)
          .eq('is_active', true)
          .maybeSingle();

        if (template) {
          const firstName = currentApp.first_name || "Valued Client";
          const subject = template.subject;
          const heading = (template.heading || '').replace(/\{\{clientName\}\}/g, firstName);
          const bodyContent = (template.body_content || '').replace(/\{\{clientName\}\}/g, firstName);

          const emailHtml = `
            <div style="font-family: system-ui, -apple-system, sans-serif; background-color: #09090b; color: #ffffff; padding: 40px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #27272a;">
              <h2 style="color: #ffffff; border-bottom: 1px solid #27272a; padding-bottom: 15px; font-weight: 500; letter-spacing: 1px;">LUMINA AUTO</h2>
              <div style="color: #a1a1aa; font-size: 15px; line-height: 1.6; padding-top: 10px;">
                <p style="color: #ffffff; font-size: 16px;">${heading}</p>
                <p>${bodyContent}</p>
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
            headers: { "Content-Type": "application/json" },
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
