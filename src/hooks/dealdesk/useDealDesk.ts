// Deal Desk react-query hooks. All reads/writes go through the supabase client
// under RLS (can_deal_desk()). Namespaced queryKeys (['dealdesk', ...]) so they
// never disturb the frozen ['deal-records'] / ['accounting-deals'] caches.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fromDealRecord, DEAL_DESK_SELECT } from '@/lib/dealdesk/fromDealRecord';
import type { Deal, DealCosting, DeliveryChecklist, Payee, Expense, DealEvent, DeskSettings } from '@/lib/dealdesk/types';
import type { CostSheetInput, CostSheetComputed } from '@/lib/dealdesk/costsheet';

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
    mutationFn: async ({ dealId, patch }: { dealId: string; patch: Partial<DeliveryChecklist> }) => {
      const row = { deal_id: dealId, ...patch, updated_at: new Date().toISOString() };
      const { error } = await db.from('deal_checklist').upsert(row, { onConflict: 'deal_id' });
      if (error) throw error;
      await logDealEvent(dealId, 'checklist_saved', 'Delivery checklist updated');
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['dealdesk', 'checklist', v.dealId] });
      qc.invalidateQueries({ queryKey: ['dealdesk', 'events', v.dealId] });
    },
    onError: (e: any) => toast.error('Save failed: ' + (e?.message || e)),
  });
}

/* ---------------- Natis / delivery actions (write net-new deal_records cols only) ---------------- */

export function useMarkNatisSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, sent }: { dealId: string; sent: boolean }) => {
      const { error } = await db.from('deal_records')
        .update({ natis_sent_at: sent ? new Date().toISOString() : null })
        .eq('id', dealId);
      if (error) throw error;
      await logDealEvent(dealId, 'delivery_changed', sent ? 'Natis marked as sent' : 'Natis sent flag cleared');
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['dealdesk', 'deals'] });
      qc.invalidateQueries({ queryKey: ['dealdesk', 'events', v.dealId] });
      toast.success('Natis status updated');
    },
    onError: (e: any) => toast.error('Update failed: ' + (e?.message || e)),
  });
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
      const { error } = await db.from('deal_payees').upsert({ ...payee, updated_at: new Date().toISOString() });
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
      const { error } = await db.from('deal_expense_items').upsert({ ...exp, updated_at: new Date().toISOString() });
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
