// Deal Desk react-query hooks. All reads/writes go through the supabase client
// under RLS (can_deal_desk()). Namespaced queryKeys (['dealdesk', ...]) so they
// never disturb the frozen ['deal-records'] / ['accounting-deals'] caches.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fromDealRecord, DEAL_DESK_SELECT } from '@/lib/dealdesk/fromDealRecord';
import type { Deal, DealCosting, DeliveryChecklist, Payee, Expense, DealEvent, DeskSettings, DealStage, NatisStage } from '@/lib/dealdesk/types';
import { DEAL_STAGE_LABEL, NATIS_STAGE_LABEL } from '@/lib/dealdesk/types';
import { compressIfImage } from '@/lib/compressFile';
import type { CostSheetInput, CostSheetComputed } from '@/lib/dealdesk/costsheet';
import { nextStageAfter } from '@/lib/dealdesk/stageFlow';

// New deal_* tables/columns aren't in the generated types yet.
const db = supabase as any;

/* ---------------- Deals (read-only over deal_records) ---------------- */

export function useDealDeskList() {
  return useQuery<Deal[]>({
    queryKey: ['dealdesk', 'deals'],
    queryFn: async () => {
      const { data, error } = await db
        .from('deal_records')
        .select(DEAL_DESK_SELECT)
        .order('sale_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(fromDealRecord);
    },
  });
}

/** Fetch the FULL raw deal_records row (all columns) for a single deal. Used to
 *  seed the embedded Finalize modal's edit-mode form with the complete draft. */
export function useDealRecordRaw(dealId: string | null) {
  return useQuery<any | null>({
    queryKey: ['dealdesk', 'deal-record-raw', dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await db
        .from('deal_records')
        .select('*, vehicle:vehicles(id, make, model, year, price, cost_price, purchase_price, reconditioning_cost, stock_number, mileage, status)')
        .eq('id', dealId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/* ---------------- Deal stage (the back-office deal track) ---------------- */

/**
 * Write deal_records.deal_stage, never moving backwards (guarded by nextStageAfter).
 * Pass `force` to set an exact stage regardless of rank (manual override). Advancing
 * the stage NEVER touches gross_profit or finance_applications.status — the two
 * tracks stay parallel.
 */
export function useSetDealStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      { dealId, stage, currentStage, force = false }:
      { dealId: string; stage: DealStage; currentStage?: DealStage; force?: boolean },
    ) => {
      const target = force || !currentStage ? stage : nextStageAfter(currentStage, stage);
      if (!target) return null; // already at/after the target — no-op.
      const { error } = await db.from('deal_records').update({ deal_stage: target }).eq('id', dealId);
      if (error) throw error;
      await logDealEvent(dealId, 'stage_changed', `Deal stage → ${DEAL_STAGE_LABEL[target]}`);
      return target;
    },
    onSuccess: (target, v) => {
      if (!target) return;
      qc.invalidateQueries({ queryKey: ['dealdesk', 'deals'] });
      qc.invalidateQueries({ queryKey: ['dealdesk', 'events', v.dealId] });
    },
    onError: (e: any) => toast.error('Stage update failed: ' + (e?.message || e)),
  });
}

/** Best-effort, non-throwing stage advance used by other Deal Desk actions
 *  (delivery / NATIS). Only ever moves the stage forward. */
async function advanceDealStage(dealId: string, currentStage: DealStage | undefined, target: DealStage) {
  try {
    if (!currentStage) {
      await db.from('deal_records').update({ deal_stage: target }).eq('id', dealId);
      return;
    }
    const next = nextStageAfter(currentStage, target);
    if (!next) return;
    await db.from('deal_records').update({ deal_stage: next }).eq('id', dealId);
  } catch (e) {
    console.error('[dealdesk] advanceDealStage failed (non-fatal):', e);
  }
}

/* ---------------- Cost sheet ---------------- */

export function useDealCostsheet(dealId: string | null) {
  return useQuery<DealCosting | null>({
    queryKey: ['dealdesk', 'costsheet', dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await db.from('deal_costsheet').select('*').eq('deal_id', dealId).maybeSingle();
      if (error) throw error;
      return (data as DealCosting) ?? null;
    },
  });
}

export function useSaveCostsheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, input, computed }: { dealId: string; input: CostSheetInput; computed: CostSheetComputed }) => {
      const row = {
        deal_id: dealId,
        retail: input.retail, spotter: input.spotter, delivery: input.delivery, over_allowance: input.over_allowance,
        vehicle_cost: input.vehicle_cost, recon: input.recon, fleet_1pct: input.fleet_1pct, c4c: input.c4c,
        accessories: input.accessories, fni: input.fni,
        vehicle_gp: computed.vehicle_gp, accessories_total: computed.accessories_total,
        fni_total: computed.fni_total, total: computed.total, correct_total: computed.correct_total,
        updated_at: new Date().toISOString(),
      };
      const { error } = await db.from('deal_costsheet').upsert(row, { onConflict: 'deal_id' });
      if (error) throw error;
      await logDealEvent(dealId, 'costing_saved', `Cost sheet saved · Correct Total ${computed.correct_total}`);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['dealdesk', 'costsheet', v.dealId] });
      qc.invalidateQueries({ queryKey: ['dealdesk', 'events', v.dealId] });
      toast.success('Cost sheet saved');
    },
    onError: (e: any) => toast.error('Save failed: ' + (e?.message || e)),
  });
}

/* ---------------- Checklist ---------------- */

export function useDealChecklist(dealId: string | null) {
  return useQuery<DeliveryChecklist | null>({
    queryKey: ['dealdesk', 'checklist', dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await db.from('deal_checklist').select('*').eq('deal_id', dealId).maybeSingle();
      if (error) throw error;
      return (data as DeliveryChecklist) ?? null;
    },
  });
}

export function useSaveChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, patch, currentStage }: { dealId: string; patch: Partial<DeliveryChecklist>; currentStage?: DealStage }) => {
      const row = { deal_id: dealId, ...patch, updated_at: new Date().toISOString() };
      const { error } = await db.from('deal_checklist').upsert(row, { onConflict: 'deal_id' });
      if (error) throw error;
      await logDealEvent(dealId, 'checklist_saved', 'Delivery checklist updated');
      // Marking the deal "delivery ready" advances the deal track to 'delivered'.
      if (patch.delivery_ready === true) {
        await advanceDealStage(dealId, currentStage, 'delivered');
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['dealdesk', 'checklist', v.dealId] });
      qc.invalidateQueries({ queryKey: ['dealdesk', 'events', v.dealId] });
      qc.invalidateQueries({ queryKey: ['dealdesk', 'deals'] });
    },
    onError: (e: any) => toast.error('Save failed: ' + (e?.message || e)),
  });
}

/* ---------------- Natis / delivery actions (write net-new deal_records cols only) ---------------- */

export function useMarkNatisSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, sent, currentStage }: { dealId: string; sent: boolean; currentStage?: DealStage }) => {
      const patch: Record<string, unknown> = { natis_sent_at: sent ? new Date().toISOString() : null };
      // Sending completes the NATIS lifecycle — clear the stepper stage. (Un-sending
      // leaves the stage as-is; the tab re-defaults to 'delivered'.)
      if (sent) patch.natis_stage = null;
      const { error } = await db.from('deal_records').update(patch).eq('id', dealId);
      if (error) throw error;
      await logDealEvent(dealId, 'delivery_changed', sent ? 'Natis marked as sent' : 'Natis sent flag cleared');
      // NATIS sent → the deal is fully cleared.
      if (sent) await advanceDealStage(dealId, currentStage, 'cleared');
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['dealdesk', 'deals'] });
      qc.invalidateQueries({ queryKey: ['dealdesk', 'events', v.dealId] });
      toast.success('Natis status updated');
    },
    onError: (e: any) => toast.error('Update failed: ' + (e?.message || e)),
  });
}

/* ---------------- NATIS lifecycle (deal_records.natis_* columns) ----------------
   Powers the NATIS tab stepper (Delivered → ID & POR → Original Natis → Dealer
   stock → Blue File → Ready to send) plus the location / plates toggles and the
   uploaded NATIS document. Same shape as useMarkNatisSent: write the net-new
   deal_records columns, log to deal_events, invalidate the dealdesk caches. */

const NATIS_DOCS_BUCKET = 'documents';

const sanitizeFileName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 120);

/** Move the NATIS lifecycle stage (forward or back). Every transition is logged
 *  to deal_events as 'Natis: X → Y' (event_type 'natis_stage_changed') so the
 *  tab's Change history can replay it. */
export function useSetNatisStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, stage, fromStage }: { dealId: string; stage: NatisStage; fromStage?: NatisStage | null }) => {
      const { error } = await db.from('deal_records').update({ natis_stage: stage }).eq('id', dealId);
      if (error) throw error;
      const from = fromStage ? NATIS_STAGE_LABEL[fromStage] : 'Not started';
      await logDealEvent(dealId, 'natis_stage_changed', `Natis: ${from} → ${NATIS_STAGE_LABEL[stage]}`);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['dealdesk', 'deals'] });
      qc.invalidateQueries({ queryKey: ['dealdesk', 'events', v.dealId] });
    },
    onError: (e: any) => toast.error('Natis stage update failed: ' + (e?.message || e)),
  });
}

/** Patch the NATIS location / plates-disc / whatsapp-opt-in fields. `summary`
 *  is the human line written to the deal_events log for this change. */
export function useSaveNatisFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, patch, summary }: {
      dealId: string;
      patch: Partial<Pick<Deal, 'natis_location' | 'natis_plates_disc_done' | 'natis_whatsapp_on_done'>>;
      summary: string;
    }) => {
      const { error } = await db.from('deal_records').update(patch).eq('id', dealId);
      if (error) throw error;
      await logDealEvent(dealId, 'natis_updated', summary);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['dealdesk', 'deals'] });
      qc.invalidateQueries({ queryKey: ['dealdesk', 'events', v.dealId] });
    },
    onError: (e: any) => toast.error('Update failed: ' + (e?.message || e)),
  });
}

/** Append a manual note to the NATIS update log (deal_events kind 'natis_note').
 *  Unlike logDealEvent this THROWS on failure so the form can surface it. */
export function useAddNatisNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, note }: { dealId: string; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await db.from('deal_events').insert({
        deal_id: dealId, actor_id: user?.id ?? null, event_type: 'natis_note', summary: note, changes: null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['dealdesk', 'events', v.dealId] });
      toast.success('Note added');
    },
    onError: (e: any) => toast.error('Could not add note: ' + (e?.message || e)),
  });
}

/** Upload the NATIS document (documents bucket, deal/{dealId}/natis/…) and store
 *  the path on deal_records.natis_doc_path. Mirrors useUploadVehicleStockDoc:
 *  compress images, upload, write the row, roll the object back on row failure. */
export function useUploadNatisDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, file }: { dealId: string; file: File }) => {
      const compressed = await compressIfImage(file, 'balanced');
      const path = `deal/${dealId}/natis/${Date.now()}-${sanitizeFileName(compressed.name)}`;

      const { error: upErr } = await supabase.storage
        .from(NATIS_DOCS_BUCKET)
        .upload(path, compressed, { contentType: compressed.type || undefined, upsert: false });
      if (upErr) throw upErr;

      const { error } = await db.from('deal_records').update({ natis_doc_path: path }).eq('id', dealId);
      if (error) {
        // Roll back the orphaned storage object if the row write failed.
        await supabase.storage.from(NATIS_DOCS_BUCKET).remove([path]);
        throw error;
      }
      await logDealEvent(dealId, 'natis_doc_uploaded', `Natis document uploaded (${compressed.name})`);
      return path;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['dealdesk', 'deals'] });
      qc.invalidateQueries({ queryKey: ['dealdesk', 'events', v.dealId] });
      toast.success('Natis document uploaded');
    },
    onError: (e: any) => toast.error('Upload failed: ' + (e?.message || e)),
  });
}

/** Short-lived signed URL to view/download the uploaded NATIS document. */
export async function getNatisDocUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(NATIS_DOCS_BUCKET).createSignedUrl(filePath, 60 * 60);
  if (error) {
    toast.error('Could not open document');
    return null;
  }
  return data?.signedUrl ?? null;
}

/* ---------------- Payees + expenses (payables tracker) ---------------- */

export function usePayees() {
  return useQuery<Payee[]>({
    queryKey: ['dealdesk', 'payees'],
    queryFn: async () => {
      const { data, error } = await db.from('deal_payees').select('*').order('name');
      if (error) throw error;
      return (data as Payee[]) || [];
    },
  });
}

export function useSavePayee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payee: Partial<Payee>) => {
      const { error } = await db.from('deal_payees').upsert({ ...payee, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dealdesk', 'payees'] }); toast.success('Payee saved'); },
    onError: (e: any) => toast.error('Save failed: ' + (e?.message || e)),
  });
}

export function useExpenses(dealId?: string | null) {
  return useQuery<Expense[]>({
    queryKey: ['dealdesk', 'expenses', dealId ?? 'all'],
    queryFn: async () => {
      let q = db.from('deal_expense_items').select('*').order('expense_date', { ascending: false, nullsFirst: false });
      if (dealId) q = q.eq('deal_id', dealId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as Expense[]) || [];
    },
  });
}

export function useSaveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (exp: Partial<Expense>) => {
      const { error } = await db.from('deal_expense_items').upsert({ ...exp, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dealdesk', 'expenses'] });
      toast.success('Expense saved');
    },
    onError: (e: any) => toast.error('Save failed: ' + (e?.message || e)),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('deal_expense_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dealdesk', 'expenses'] }); toast.success('Expense removed'); },
    onError: (e: any) => toast.error('Delete failed: ' + (e?.message || e)),
  });
}

/* ---------------- Activity ---------------- */

export function useDealEvents(dealId: string | null) {
  return useQuery<DealEvent[]>({
    queryKey: ['dealdesk', 'events', dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await db.from('deal_events').select('*').eq('deal_id', dealId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data as DealEvent[]) || [];
    },
  });
}

/** Best-effort append to the deal activity log. Never throws into the caller. */
export async function logDealEvent(dealId: string, eventType: string, summary: string, changes?: any) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await db.from('deal_events').insert({
      deal_id: dealId, actor_id: user?.id ?? null, event_type: eventType, summary, changes: changes ?? null,
    });
  } catch (e) {
    console.error('[dealdesk] logDealEvent failed (non-fatal):', e);
  }
}

/* ---------------- Settings ---------------- */

export function useDeskSettings() {
  return useQuery<DeskSettings>({
    queryKey: ['dealdesk', 'settings'],
    queryFn: async () => {
      const { data, error } = await db.from('deal_desk_settings').select('*').eq('id', 'default').maybeSingle();
      if (error) throw error;
      return (data as DeskSettings) ?? { id: 'default', natis_window_days: 21, natis_warn_days: 5, updated_at: '' };
    },
  });
}

export function useSaveDeskSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<DeskSettings>) => {
      const { error } = await db.from('deal_desk_settings')
        .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 'default');
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dealdesk', 'settings'] }); toast.success('Settings saved'); },
    onError: (e: any) => toast.error('Save failed: ' + (e?.message || e)),
  });
}
