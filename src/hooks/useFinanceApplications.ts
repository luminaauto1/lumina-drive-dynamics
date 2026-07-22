import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { logActivity, humanizeStatus } from '@/lib/activityLog';
import { sendClientEmail } from '@/lib/clientEmail';
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

// Finance slugs whose client WhatsApp notification is ALREADY owned by a dedicated
// notify-* function (each fires its own send below). The ZTC-parity config-driven
// auto-send (block I → wa-status-send) MUST exclude these so exactly ONE path ever
// fires for them — no double messaging. Kept in sync with wa-status-send's
// NOTIFY_OWNED_STATUSES (defense-in-depth: guarded in BOTH the hook and the fn).
const NOTIFY_OWNED_STATUSES = new Set<string>([
  'application_submitted',
  'ready_to_submit',
  'declined',
  'blacklisted',
  'client_cancelled',
  'pre_approved',
]);

export const useUpdateFinanceApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      // Optional transient status-change comment, passed by status-change UIs to
      // feed lead_data.last_note (EasySocial) + the WhatsApp {comment} body source.
      // It is NOT a finance_applications column — strip it before the DB write so
      // the update never fails on an unknown field. Omitted => behaves as today.
      const statusComment =
        typeof updates?.comment === 'string' ? updates.comment.trim() : '';
      if (updates && 'comment' in updates) {
        const { comment: _omit, ...rest } = updates;
        updates = rest;
      }

      // Optional transient "WhatsApp To Client Info" text — a SEPARATE per-status
      // box (distinct from `comment`), passed by status-change UIs to feed the
      // wa_client_info WhatsApp body source. Like `comment` it is NOT a
      // finance_applications column — strip it before the DB write. Omitted =>
      // behaves as today. It is NOT forwarded to easysocial-tag-sync.
      const waClientInfo =
        typeof updates?.wa_client_info === 'string' ? updates.wa_client_info.trim() : '';
      if (updates && 'wa_client_info' in updates) {
        const { wa_client_info: _omitWci, ...restWci } = updates;
        updates = restWci;
      }

      // suppressClientNotifications — virtual flag (stripped before the DB write)
      // for callers whose path has NEVER messaged the client (e.g. the CRM-modal
      // preset buttons). When true, every CLIENT-facing dispatch below is skipped
      // (auto-mailer email, notify-app-submitted/declined/blacklisted/cancelled,
      // wa-status-send) while ALL bookkeeping still runs: status_history +
      // status_updated_at stamp, activity trail, EasySocial tag-sync, deal-draft
      // and staff-facing alerts. Owner rule 2026-07-14: no new client sends.
      const suppressClient = updates?.suppressClientNotifications === true;
      if (updates && 'suppressClientNotifications' in updates) {
        const { suppressClientNotifications: _omit2, ...rest2 } = updates;
        updates = rest2;
      }

      // 1. Fetch current app to detect status change and get email — narrowed
      // to ONLY the fields the dispatch logic below actually reads (status +
      // history, client identity/contact, notes, bank_reference, vehicle_id,
      // ttclid). The row is never spread or forwarded wholesale, so nothing
      // else is needed. NOTE: ttclid exists in the DB (migration
      // 20260630150000_add_ttclid) but not yet in the regenerated Supabase
      // types, hence the explicit row type on maybeSingle.
      const { data: currentApp } = await supabase
        .from('finance_applications')
        .select('id, status, status_history, email, phone, first_name, last_name, full_name, notes, bank_reference, vehicle_id, ttclid, assigned_f_and_i')
        .eq('id', id)
        .maybeSingle<
          Pick<
            Tables<'finance_applications'>,
            | 'id' | 'status' | 'status_history' | 'email' | 'phone'
            | 'first_name' | 'last_name' | 'full_name' | 'notes'
            | 'bank_reference' | 'vehicle_id' | 'assigned_f_and_i'
          > & { ttclid: string | null }
        >();

      // F&I auto-claim — ONLY when the file is UNASSIGNED (owner rule
      // 2026-07-14: an existing assignment is never overwritten by another
      // F&I's activity; re-assignment happens only via the explicit pickers,
      // which pass assigned_f_and_i in `updates`).
      try {
        const { data: { user: actor } } = await supabase.auth.getUser();
        if (actor?.id && updates.assigned_f_and_i === undefined && !currentApp?.assigned_f_and_i) {
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
        // 'application_submitted' intentionally REMOVED — "Ready To Load"
        // (credit-check passed) is fully silent and fires no auto-email.
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
      if (statusActuallyChanged && newStatus === 'client_cancelled' && !suppressClient) {
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
        !suppressClient &&
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

          // ONE shared client-email helper (P4) — same EmailJS transport and
          // payload as always, plus a comms-log entry on the client's timeline.
          // Fire-and-forget: a failed email never breaks the status update.
          void sendClientEmail({
            to: currentApp.email,
            subject,
            html: emailHtml,
            applicationId: id,
            clientPhone: currentApp.phone ?? null,
          });
        } else if (statusActuallyChanged) {
          console.log(`[Auto-Mailer] Status changed to "${newStatus}" — no active template with status_key="${newStatus}". No email sent.`);
        }
      } else if (statusActuallyChanged && !EMAIL_ELIGIBLE_STATUSES.has(newStatus!)) {
        console.log(`[Auto-Mailer] Status "${newStatus}" is not email-eligible. Silent transition.`);
      }

      // WhatsApp "Submitted to Bank" notification — fires when status moves
      // into `ready_to_submit` for the first time. `application_submitted`
      // ("Ready To Load", credit-check passed) is intentionally SILENT and no
      // longer triggers this client WhatsApp. The dedup below still inspects
      // BOTH submission-phase slugs in status_history so `ready_to_submit`
      // behaves EXACTLY as before (never double-sends across the phase).
      if (
        statusActuallyChanged &&
        newStatus === 'ready_to_submit' &&
        !suppressClient &&
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
        !suppressClient &&
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
        !suppressClient &&
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

        // TikTok CAPI — server-side conversion event when a lead is pre-approved
        // (a qualified, high-value conversion for ad optimization). Deterministic
        // event_id so re-toggling the status never double-counts. Fire-and-forget;
        // the function no-ops until the TikTok access token is configured.
        try {
          const { publicApiHeaders } = await import('@/lib/publicApi');
          supabase.functions.invoke('tiktok-capi', {
            headers: publicApiHeaders(),
            body: {
              event: 'CompleteRegistration',
              event_id: `preapp:${id}`,
              email: currentApp?.email || null,
              phone: currentApp?.phone || null,
              ttclid: (currentApp as any)?.ttclid || null,
              properties: { content_name: 'Pre-Approved', content_category: 'Lead' },
            },
          }).then(({ error: ttErr }) => {
            if (ttErr) console.error('[tiktok-capi] pre-approval error:', ttErr);
          });
        } catch (ttEx) {
          console.error('[tiktok-capi] pre-approval invoke failed:', ttEx);
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
              // ZTC-parity additive: the function reads per-status config server-side
              // (tag remove-mode / client_status). The comment feeds lead_data.last_note.
              // Omitted comment => lead_data.last_note simply not written (today's payload).
              comment: statusComment || undefined,
            },
          });
          console.log('[easysocial-tag-sync] response', { tagData, tagErr });
          if (tagErr) {
            toast.error(`Client tag sync failed: ${tagErr.message || 'unknown error'}`, {
              style: { background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' },
            });
          } else if (tagData?.ok === false) {
            const detail = tagData?.upstream?.body?.message || tagData?.error || tagData?.detail || `status ${tagData?.upstream?.status ?? '?'}`;
            toast.error(`Client tag sync failed: ${detail}`, {
              style: { background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' },
            });
          } else if (tagData?.skipped) {
            // No mapping for this status — informational only, no toast needed.
          } else {
            toast.success('Client tags updated', {
              style: { background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' },
            });
          }
        } catch (tagEx: any) {
          console.error('[easysocial-tag-sync] failed to invoke:', tagEx);
          toast.error(`Client tag sync failed: ${tagEx?.message || tagEx}`, {
            style: { background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' },
          });
        }
      }

      // ── Block I — ZTC-parity config-driven WhatsApp auto-send ──────────────
      // Fires wa-status-send ONLY when:
      //   • the status actually changed AND there's a phone, AND
      //   • the new slug is NOT one of the 5 notify-* owned slugs (NO DOUBLE-SEND
      //     guard — those already auto-send above; one path only).
      // wa-status-send itself returns skipped:'no_template' when the status has no
      // curated template configured, so an UNCONFIGURED status sends nothing —
      // byte-for-byte today's behaviour. Fire-and-forget (NOT awaited): a failed
      // send must never break the status update or its toast. Defense-in-depth:
      // the function re-checks NOTIFY_OWNED_STATUSES after its DB read.
      if (
        statusActuallyChanged &&
        newStatus &&
        currentApp?.phone &&
        !suppressClient &&
        !NOTIFY_OWNED_STATUSES.has(newStatus)
      ) {
        try {
          const { publicApiHeaders } = await import('@/lib/publicApi');
          supabase.functions.invoke('wa-status-send', {
            headers: publicApiHeaders(),
            body: {
              application_id: id,
              new_status: newStatus,
              comment: statusComment || undefined,
              wa_client_info: waClientInfo || undefined,
            },
          }).then(({ data: waData, error: waErr }) => {
            if (waErr) console.error('[wa-status-send] error:', waErr);
            else if ((waData as any)?.skipped) console.log('[wa-status-send] skipped:', (waData as any).skipped);
            else console.log('[wa-status-send] dispatched for application', id, waData);
          });
        } catch (waEx) {
          console.error('[wa-status-send] failed to invoke:', waEx);
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

// Isolated writer for the customizable CLIENT-status track (finance_applications.
// client_status). Low blast radius: it touches ONLY that one column and fires NO
// notify-* / auto-mailer / status_history side-effects. It DOES fire two isolated,
// self-gating microservices: easysocial-tag-sync (CRM tags) and — opt-in since the
// client auto-send scope — wa-status-send. wa-status-send reads THIS client slug's
// config from status_overrides and NO-OPS (skipped:'no_template') unless the status
// has a whatsapp_template_key + send_url attached, so every existing client status
// (none configured) stays exactly as silent as before.
export const useUpdateClientStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, client_status, label, wa_client_info }: { id: string; client_status: string; label?: string; wa_client_info?: string }) => {
      const { data, error } = await supabase
        .from('finance_applications')
        .update({ client_status } as any)
        .eq('id', id)
        .select('phone, pipeline_notes, vehicle_id')
        .maybeSingle();
      if (error) throw error;
      // Lightweight audit trail only — never a status_change dispatch.
      void logActivity({ actionType: 'other', note: `Client status → ${client_status}`, applicationId: id });

      // ── Client "Contract Signed 🎉" → Deal Desk draft ──────────────────────
      // Mirrors the finance-status auto-create in useUpdateFinanceApplication
      // (same site_settings flag, same existing-deal idempotency guard — which
      // also makes the nightly client_status reset → re-set cycle safe; the
      // unique application_id index backstops races). Deliberate differences:
      // NO vehicle_id requirement (client-track apps often lack a car — every
      // deal_records column is nullable/defaulted and the Finalize modal picks
      // the vehicle later) and EXPLICIT sale_date: null so the draft reads as
      // awaiting-finalize, never a phantom invoiced deal.
      if (client_status === 'client_contract_signed') {
        try {
          const docSettings = queryClient.getQueryData<DocumentSettings>(['document-settings']);
          if (docSettings?.autoCreateDealOnContractSigned === true) {
            const { data: existingDeal } = await (supabase as any)
              .from('deal_records').select('id').eq('application_id', id).maybeSingle();
            if (!existingDeal) {
              const appVehicleId = (data as any)?.vehicle_id ?? null;
              let soldPrice = 0;
              if (appVehicleId) {
                const { data: veh } = await supabase
                  .from('vehicles').select('price').eq('id', appVehicleId).maybeSingle();
                soldPrice = Number((veh as any)?.price) || 0;
              }
              const { error: draftErr } = await (supabase as any).from('deal_records').insert({
                application_id: id,
                vehicle_id: appVehicleId,
                sold_price: soldPrice,
                sale_date: null,
                cost_price: 0, gross_profit: 0, recon_cost: 0, discount_amount: 0,
                dealer_deposit_contribution: 0, external_admin_fee: 0, bank_initiation_fee: 0,
                total_financed_amount: 0, client_deposit: 0, dic_amount: 0,
                sales_rep_commission: 0, referral_commission_amount: 0, referral_income_amount: 0,
                partner_capital_contribution: 0, is_shared_capital: false, is_closed: false,
                addons_data: [], aftersales_expenses: [],
              });
              if (draftErr) console.error('[deal-draft/client] insert failed (non-fatal):', draftErr);
              else console.log('[deal-draft/client] draft created for application', id);
            }
          }
        } catch (ex) {
          console.error('[deal-draft/client] failed (non-fatal):', ex);
        }
      }

      // Auto-note (owner 2026-07-17): picking a client status stamps an EVENT
      // note ("Client status → No Answer", …) so yesterday's call outcome
      // survives the DAILY client-status reset in the notes history. Category
      // 'status_change' = system note (owner 2026-07-18: it must NOT surface in
      // the pipeline table's Notes column — that column is for user-written
      // notes; see SYSTEM_NOTE_CATEGORIES). Clearing a status adds none.
      if (client_status && String(client_status).trim()) {
        try {
          // Label from the caller when available; otherwise humanize the slug
          // (client_no_answer → "No Answer").
          const statusLabel = (label && label.trim())
            || String(client_status).replace(/^client_/, '').replace(/_/g, ' ')
                 .replace(/\b\w/g, (c) => c.toUpperCase());
          const { data: { user: actor } } = await supabase.auth.getUser();
          const authorName = (actor as any)?.user_metadata?.full_name?.trim()
            || actor?.email?.split('@')[0] || 'Staff';
          const { addPipelineNote } = await import('@/lib/pipelinev2/notes');
          await addPipelineNote({ id, pipeline_notes: (data as any)?.pipeline_notes }, {
            body: `Client status → ${statusLabel}`,
            // 'client_status_set' = system auto-stamp (SYSTEM_NOTE_CATEGORIES), so
            // it stays out of the table's Notes column. It used to share
            // 'status_change' with user-typed comments, which is what hid those
            // comments; isSystemNote() still recognises the old rows by body.
            category: 'client_status_set',
            author_id: actor?.id ?? null,
            author_name: authorName,
          });
        } catch (noteEx) {
          console.error('[client-status] auto-note failed (non-fatal):', noteEx);
        }
      }
      // EasySocial tags for the CLIENT track (2026-07-14): the edge function reads
      // this status's config (tags to add / remove-mode) server-side and NO-OPS
      // when nothing is configured — so an unconfigured client status stays as
      // silent as before. Still no notify-* / auto-mailer.
      //
      // AWAITED, not fire-and-forget (2026-07-20). Both dispatches used to be
      // dangling promises launched as the mutation resolved — which means React
      // Query's onSuccess (invalidate + refetch) and the modal's unmount raced
      // them, and a call that never left the browser left NO trace anywhere: no
      // console line, no toast, no edge-function log. That is exactly the hole
      // "the tag didn't update and I saw nothing" fell through. The finance path
      // above already awaits + toasts for this reason; the client path now
      // matches it, so an unconfigured status says so and a broken one shouts.
      const phone = (data as any)?.phone;
      if (phone) {
        try {
          console.log('[easysocial-tag-sync] client invoking', { phone, new_status: client_status });
          const { data: tagData, error: tagErr } = await supabase.functions
            .invoke('easysocial-tag-sync', { body: { phone_number: phone, new_status: client_status } });
          console.log('[easysocial-tag-sync] client response', { tagData, tagErr });
          if (tagErr || (tagData as any)?.ok === false) {
            const detail = tagErr?.message
              || (tagData as any)?.upstream?.body?.message
              || (tagData as any)?.error
              || (tagData as any)?.detail
              || 'unknown error';
            toast.error(`Client tag sync failed: ${detail}`);
          } else if ((tagData as any)?.skipped) {
            // No tag plan configured for this client status — informational only.
            console.log('[easysocial-tag-sync] client skipped:', (tagData as any).skipped);
          } else {
            toast.success('Client tags updated');
          }
        } catch (tagEx: any) {
          console.error('[easysocial-tag-sync] client failed to invoke:', tagEx);
          toast.error(`Client tag sync failed: ${tagEx?.message || tagEx}`);
        }

        // Opt-in client-status WhatsApp auto-send. Self-gates to skipped:'no_template'
        // unless THIS client slug has a curated template attached (status editor →
        // WhatsApp auto-send), so it's silent for every existing client status. Uses
        // the SAME x-lumina-key auth as the finance path (checkInternalKey fails
        // closed without it). Non-fatal: a send failure never fails the status write.
        try {
          const { publicApiHeaders } = await import('@/lib/publicApi');
          const { data: waData, error: waErr } = await supabase.functions.invoke('wa-status-send', {
            headers: publicApiHeaders(),
            body: {
              application_id: id,
              new_status: client_status,
              wa_client_info: wa_client_info?.trim() || undefined,
            },
          });
          if (waErr) {
            console.error('[wa-status-send] client error:', waErr);
            toast.error(`WhatsApp send failed: ${waErr.message || 'unknown error'}`);
          } else if ((waData as any)?.skipped) {
            // 'no_template' is the everyday case: this status has no WhatsApp
            // template attached, so nothing was meant to go out. Say so quietly
            // rather than leaving the user to guess whether a send failed.
            console.log('[wa-status-send] client skipped:', (waData as any).skipped);
          } else {
            console.log('[wa-status-send] client dispatched for application', id, waData);
            toast.success('WhatsApp message sent');
          }
        } catch (waEx: any) {
          console.error('[wa-status-send] client failed to invoke:', waEx);
          toast.error(`WhatsApp send failed: ${waEx?.message || waEx}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-applications'] });
      toast.success('Client status updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update client status');
    },
  });
};

// Isolated writer for the application's SUBMISSION SOURCE
// (finance_applications.submission_source). Same minimal blast radius as
// useUpdateClientStatus: it touches ONLY that one column and fires NO notify-* /
// wa-status-send / easysocial / auto-mailer dispatch. The finance fan-out in
// useUpdateFinanceApplication is never involved — this is a plain, silent write.
export const useUpdateApplicationSource = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, submission_source }: { id: string; submission_source: string }) => {
      const { error } = await supabase
        .from('finance_applications')
        .update({ submission_source } as any)
        .eq('id', id);
      if (error) throw error;
      // Lightweight audit trail only — never a status_change dispatch.
      void logActivity({ actionType: 'other', note: `Source → ${submission_source}`, applicationId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-applications'] });
      toast.success('Source updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update source');
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
