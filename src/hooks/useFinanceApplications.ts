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
  created_by?: string | null;
  creator?: { full_name: string | null; email: string | null } | null;
  assigned_f_and_i?: string | null;
  fni_owner?: { full_name: string | null; email: string | null } | null;
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

      // Attach creator profiles in batch (no FK; manual join on profiles.user_id).
      // Only resolve when `created_by` is set — i.e. an admin/sales agent
      // submitted on behalf of the client. Self-submitted website applications
      // intentionally show no "Rep:" line.
      const apps = (data || []) as FinanceApplication[];
      const creatorIds = Array.from(
        new Set(apps.map(a => (a as any).created_by).filter(Boolean) as string[])
      );
      if (creatorIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', creatorIds);
        const byId = new Map((profs || []).map((p: any) => [p.user_id, p]));
        apps.forEach(a => {
          const cid = (a as any).created_by;
          a.creator = cid ? (byId.get(cid) as any) || null : null;
        });
      }

      // Attach F&I owner profiles in batch (manual join on profiles.user_id).
      const fniIds = Array.from(
        new Set(apps.map(a => (a as any).assigned_f_and_i).filter(Boolean) as string[])
      );
      if (fniIds.length) {
        const { data: fniProfs } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', fniIds);
        const byId = new Map((fniProfs || []).map((p: any) => [p.user_id, p]));
        apps.forEach(a => {
          const fid = (a as any).assigned_f_and_i;
          a.fni_owner = fid ? (byId.get(fid) as any) || null : null;
        });
      }
      return apps;
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
        .maybeSingle();

      // F&I auto-claim: any update by an F&I user stamps ownership.
      try {
        const { data: { user: actor } } = await supabase.auth.getUser();
        if (actor?.id && updates.assigned_f_and_i === undefined) {
          const { data: roleRow } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', actor.id)
            .eq('role', 'f_and_i')
            .maybeSingle();
          if (roleRow) {
            updates = {
              ...updates,
              assigned_f_and_i: actor.id,
              assigned_f_and_i_at: new Date().toISOString(),
            };
          }
        }
      } catch (_) { /* non-fatal */ }

      // 2. Perform the database update
      const { data, error } = await supabase
        .from('finance_applications')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;

      // 3. Auto-Mailer Engine — STRICT 1:1 Status → Template Mapping
      // Only these statuses are permitted to dispatch a client email.
      // Each must have an EXACT matching `status_key` row in `email_templates`
      // with `is_active=true`. No fallbacks, no fuzzy matches, no cross-firing.
      const EMAIL_ELIGIBLE_STATUSES = new Set<string>([
        'pending',
        'application_submitted',
        'sent_to_banks',
        'pre_approved',
        'documents_received',
        'validations_pending',
        'validations_complete',
        'contract_sent',
        'contract_signed',
        'vehicle_delivered',
        'declined',
        'declined_conditional',
        'vehicle_selected',
        'approved',
      ]);

      const newStatus = updates.status as string | undefined;
      const statusActuallyChanged =
        !!newStatus && !!currentApp && newStatus !== currentApp.status;

      if (
        statusActuallyChanged &&
        currentApp.email &&
        EMAIL_ELIGIBLE_STATUSES.has(newStatus!)
      ) {
        // Workflow Remap: When admin marks application as "Pre-Approved (Docs Req)",
        // the client must receive the "Validations Pending" email requesting their
        // outstanding documents (ID, Payslips, Proof of Address). The pre_approved
        // status itself has no client-facing template — it always fires the
        // validations_pending template instead.
        const STATUS_TEMPLATE_REMAP: Record<string, string> = {
          pre_approved: 'validations_pending',
          // validations_complete intentionally omitted — keep silent to avoid
          // re-requesting documents the client has already submitted.
        };
        const templateKey = STATUS_TEMPLATE_REMAP[newStatus!] ?? newStatus!;

        // Strict lookup: status_key MUST equal the resolved template key exactly.
        const { data: template } = await supabase
          .from('email_templates')
          .select('*')
          .eq('status_key', templateKey)
          .eq('is_active', true)
          .maybeSingle();

        // Guard: if no active template exists for THIS exact key, send nothing.
        // Never fall back to another template.
        if (template && template.status_key === templateKey) {
          console.log(`[Auto-Mailer] Status ${currentApp.status} → ${newStatus}. Dispatching template "${template.status_key}".`);
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
        } else if (statusActuallyChanged) {
          console.log(`[Auto-Mailer] Status changed to "${newStatus}" — no active template with status_key="${newStatus}". No email sent.`);
        }
      } else if (statusActuallyChanged && !EMAIL_ELIGIBLE_STATUSES.has(newStatus!)) {
        console.log(`[Auto-Mailer] Status "${newStatus}" is not email-eligible. Silent transition.`);
      }

      // WhatsApp "Submitted to Bank" notification — fires when status moves
      // from pending → application_submitted (regardless of submission_source).
      if (
        statusActuallyChanged &&
        newStatus === 'application_submitted' &&
        currentApp?.phone
      ) {
        try {
          const { publicApiHeaders } = await import('@/lib/publicApi');
          const clientName = currentApp.first_name || currentApp.full_name || 'Valued Client';
          supabase.functions.invoke('notify-app-submitted', {
            body: { phone_number: currentApp.phone, client_name: clientName },
            headers: publicApiHeaders(),
          }).then(({ error: waErr }) => {
            if (waErr) console.error('[notify-app-submitted] error:', waErr);
            else console.log('[notify-app-submitted] dispatched for', currentApp.phone);
          });
        } catch (waEx) {
          console.error('[notify-app-submitted] failed to invoke:', waEx);
        }
      }

      // WhatsApp "Declined" notification — fires only on hard `declined`,
      // never on `declined_conditional`.
      if (
        statusActuallyChanged &&
        newStatus === 'declined' &&
        currentApp?.phone
      ) {
        try {
          const { publicApiHeaders } = await import('@/lib/publicApi');
          const clientName = currentApp.first_name || currentApp.full_name || 'Valued Client';
          supabase.functions.invoke('notify-declined', {
            body: { phone_number: currentApp.phone, client_name: clientName },
            headers: publicApiHeaders(),
          }).then(({ error: waErr }) => {
            if (waErr) console.error('[notify-declined] error:', waErr);
            else console.log('[notify-declined] dispatched for', currentApp.phone);
          });
        } catch (waEx) {
          console.error('[notify-declined] failed to invoke:', waEx);
        }
      }

      // WhatsApp "Blacklisted / Bad Credit" notification — same dispatch
      // pattern as application_submitted, routed to notify-blacklisted.
      if (
        statusActuallyChanged &&
        newStatus === 'blacklisted' &&
        currentApp?.phone
      ) {
        try {
          const { publicApiHeaders } = await import('@/lib/publicApi');
          const clientName = currentApp.first_name || currentApp.full_name || 'Valued Client';
          supabase.functions.invoke('notify-blacklisted', {
            body: { phone_number: currentApp.phone, client_name: clientName },
            headers: publicApiHeaders(),
          }).then(({ error: waErr }) => {
            if (waErr) console.error('[notify-blacklisted] error:', waErr);
            else console.log('[notify-blacklisted] dispatched for', currentApp.phone);
          });
        } catch (waEx) {
          console.error('[notify-blacklisted] failed to invoke:', waEx);
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
