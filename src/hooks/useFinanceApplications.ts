import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { logActivity, humanizeStatus } from '@/lib/activityLog';
import type { DocumentSettings } from '@/hooks/useDocumentSettings';

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
  const queryClient = useQueryClient();

  // LIVE updates — subscribe to any change on finance_applications and invalidate
  // the cache so the table AND the directed-note Action Feed refresh in realtime,
  // with no manual refresh. Unique channel name so multiple mounts never collide.
  useEffect(() => {
    const channel = supabase
      .channel(`finance-applications-rt-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'finance_applications' },
        () => queryClient.invalidateQueries({ queryKey: ['finance-applications'] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

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
          const { data: roleRows } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', actor.id)
            .in('role', ['f_and_i', 'senior_f_and_i'] as any);
          if (roleRows && roleRows.length > 0) {
            updates = {
              ...updates,
              assigned_f_and_i: actor.id,
              assigned_f_and_i_at: new Date().toISOString(),
            };
          }
        }
      } catch (_) { /* non-fatal */ }

      // Stamp status_updated_at whenever the pipeline status actually changes,
      // so daily "today" counters in the admin dashboard are reliable
      // (updated_at gets bumped by unrelated writes like archiving).
      if (
        updates.status &&
        currentApp &&
        updates.status !== currentApp.status &&
        updates.status_updated_at === undefined
      ) {
        const nowIso = new Date().toISOString();
        const existingHistory = Array.isArray((currentApp as any)?.status_history)
          ? ((currentApp as any).status_history as Array<{ status: string; timestamp: string }>)
          : [];
        const newHistoryEntry = { status: updates.status as string, timestamp: nowIso };
        updates = {
          ...updates,
          status_updated_at: nowIso,
          status_history: [...existingHistory, newHistoryEntry] as any,
        };
      }

      // 2. Perform the database update
      const { data, error } = await supabase
        .from('finance_applications')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;

      // Universal activity trail — record the status change with the acting person's
      // real name + time (fire-and-forget; never blocks the mutation or its emails).
      // This is the single choke point for status changes from every surface
      // (AdminFinance, Pipeline v2, credit/contract modals), so one log here covers
      // them all. Existing manual audit writes live on separate direct-update paths,
      // so this adds coverage without duplicating them.
      if (updates.status && currentApp && updates.status !== (currentApp as any).status) {
        void logActivity({
          actionType: 'status_change',
          note: `Status → ${humanizeStatus(updates.status as string)}`,
          applicationId: id,
          clientEmail: (currentApp as any).email ?? null,
          clientPhone: (currentApp as any).phone ?? null,
        });
      }

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

      // ── Contract-signed → Deal Desk draft auto-population (FEATURE-FLAGGED) ──
      // When the document setting `autoCreateDealOnContractSigned` is ON and the
      // status actually transitions to 'contract_signed', create a DRAFT
      // deal_records row so the deal surfaces in Deal Desk ready to finalize.
      //
      // Guarantees:
      //   • Flag OFF (default) → this block does nothing at all.
      //   • Idempotent → we query for an existing deal_records row by
      //     application_id first and never create a second row.
      //   • All financial fields are 0 and there is NO sale_date, so the draft
      //     is excluded from Accounting/Reports (see isFinalizedDeal) and reads
      //     as 'contract_signed' in Deal Desk (see deriveDealStatus) until a
      //     human finalizes it.
      //   • Fully wrapped in try/catch — a failure here can NEVER break the
      //     status update or its emails/notifications.
      if (statusActuallyChanged && newStatus === 'contract_signed') {
        try {
          const docSettings = queryClient.getQueryData<DocumentSettings>(['document-settings']);
          if (docSettings?.autoCreateDealOnContractSigned === true) {
            const appVehicleId =
              (data as any)?.vehicle_id ?? (currentApp as any)?.vehicle_id ?? null;

            // Idempotency guard: bail if a deal_records row already exists.
            const { data: existingDeal } = await (supabase as any)
              .from('deal_records')
              .select('id')
              .eq('application_id', id)
              .maybeSingle();

            if (!existingDeal && appVehicleId) {
              // Default sold_price from the matched vehicle's listed price.
              let soldPrice = 0;
              const { data: veh } = await supabase
                .from('vehicles')
                .select('price')
                .eq('id', appVehicleId)
                .maybeSingle();
              soldPrice = Number((veh as any)?.price) || 0;

              const { error: draftErr } = await (supabase as any)
                .from('deal_records')
                .insert({
                  application_id: id,
                  vehicle_id: appVehicleId,
                  sold_price: soldPrice,
                  // Draft: no sale_date / delivery_date / sales rep → derives as
                  // 'contract_signed' and is excluded from financial totals.
                  // Every figure explicitly zero so nothing is left undefined.
                  cost_price: 0,
                  gross_profit: 0,
                  recon_cost: 0,
                  discount_amount: 0,
                  dealer_deposit_contribution: 0,
                  external_admin_fee: 0,
                  bank_initiation_fee: 0,
                  total_financed_amount: 0,
                  client_deposit: 0,
                  dic_amount: 0,
                  sales_rep_commission: 0,
                  referral_commission_amount: 0,
                  referral_income_amount: 0,
                  partner_capital_contribution: 0,
                  is_shared_capital: false,
                  is_closed: false,
                  addons_data: [],
                  aftersales_expenses: [],
                });
              if (draftErr) {
                console.error('[deal-draft] insert failed (non-fatal):', draftErr);
              } else {
                console.log('[deal-draft] draft deal_records created for application', id);
              }
            } else if (existingDeal) {
              console.log('[deal-draft] skipped — deal_records already exists for application', id);
            } else {
              console.log('[deal-draft] skipped — no vehicle_id on application', id);
            }
          }
        } catch (draftEx) {
          console.error('[deal-draft] failed (non-fatal):', draftEx);
        }
      }

      // WhatsApp "Client Cancelled / Ghosted" notification — fires when the
      // main finance status update path moves into `client_cancelled`.
      if (statusActuallyChanged && newStatus === 'client_cancelled') {
        try {
          const { publicApiHeaders } = await import('@/lib/publicApi');
          supabase.functions.invoke('notify-client-cancelled', {
            headers: publicApiHeaders(),
            body: { application_id: id },
          }).then(({ error: waErr }) => {
            if (waErr) console.error('[notify-client-cancelled] error:', waErr);
            else console.log('[notify-client-cancelled] dispatched for application', id);
          });
        } catch (waEx) {
          console.error('[notify-client-cancelled] failed to invoke:', waEx);
        }
      }

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
      // into either `application_submitted` OR `ready_to_submit` for the first
      // time. Deduplicated via status_history so toggling between the two
      // submission-phase statuses never fires twice.
      if (
        statusActuallyChanged &&
        (newStatus === 'application_submitted' || newStatus === 'ready_to_submit') &&
        currentApp?.phone
      ) {
        const priorHistory = Array.isArray((currentApp as any)?.status_history)
          ? ((currentApp as any).status_history as Array<{ status: string; timestamp: string }>)
          : [];
        const hasAlreadyBeenSubmitted = priorHistory.some(
          (entry) => entry?.status === 'application_submitted' || entry?.status === 'ready_to_submit'
        );

        if (hasAlreadyBeenSubmitted) {
          console.log('[notify-app-submitted] skipped — application already passed through submission phase.');
        } else {
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

      // Pre-Approval staff alert — fan out a WhatsApp summary to the F&I
      // duty pair whenever an application transitions INTO `pre_approved`.
      if (
        statusActuallyChanged &&
        newStatus === 'pre_approved' &&
        currentApp?.status !== 'pre_approved'
      ) {
        try {
          const { publicApiHeaders } = await import('@/lib/publicApi');
          const clientName =
            currentApp?.full_name ||
            [currentApp?.first_name, currentApp?.last_name].filter(Boolean).join(' ').trim() ||
            'Unknown Client';
          supabase.functions.invoke('notify-pre-approval-internal', {
            headers: publicApiHeaders(),
            body: {
              client_name: clientName,
              first_name: currentApp?.first_name || null,
              last_name: currentApp?.last_name || null,
              client_phone: currentApp?.phone || null,
              bank_reference_code: (currentApp as any)?.bank_reference || null,
              fni_notes: currentApp?.notes || null,
            },
          }).then(({ error: paErr }) => {
            if (paErr) console.error('[notify-pre-approval-internal] error:', paErr);
            else console.log('[notify-pre-approval-internal] dispatched for', clientName);
          });
        } catch (paEx) {
          console.error('[notify-pre-approval-internal] failed to invoke:', paEx);
        }
      }

      // EasySocial 2-way tag sync — isolated microservice, runs in addition
      // to (and never instead of) the notify-* WhatsApp dispatches above.
      // Awaited + surfaced via toast so silent failures stop happening.
      if (statusActuallyChanged && newStatus && currentApp?.phone) {
        try {
          console.log('[easysocial-tag-sync] invoking', { phone: currentApp.phone, new_status: newStatus, old_status: currentApp.status });
          const { data: tagData, error: tagErr } = await supabase.functions.invoke('easysocial-tag-sync', {
            body: {
              phone_number: currentApp.phone,
              new_status: newStatus,
              old_status: currentApp.status,
            },
          });
          console.log('[easysocial-tag-sync] response', { tagData, tagErr });
          if (tagErr) {
            toast.error(`EasySocial sync failed: ${tagErr.message || 'unknown error'}`, {
              style: { background: '#1A1A1A', color: '#fca5a5', border: '1px solid #7f1d1d' },
            });
          } else if (tagData?.ok === false) {
            const detail = tagData?.upstream?.body?.message || tagData?.error || tagData?.detail || `status ${tagData?.upstream?.status ?? '?'}`;
            toast.error(`EasySocial sync failed: ${detail}`, {
              style: { background: '#1A1A1A', color: '#fca5a5', border: '1px solid #7f1d1d' },
            });
          } else if (tagData?.skipped) {
            // No mapping for this status — informational only, no toast needed.
          } else {
            toast.success('EasySocial tags updated', {
              style: { background: '#1A1A1A', color: '#86efac', border: '1px solid #14532d' },
            });
          }
        } catch (tagEx: any) {
          console.error('[easysocial-tag-sync] failed to invoke:', tagEx);
          toast.error(`EasySocial sync failed: ${tagEx?.message || tagEx}`, {
            style: { background: '#1A1A1A', color: '#fca5a5', border: '1px solid #7f1d1d' },
          });
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
