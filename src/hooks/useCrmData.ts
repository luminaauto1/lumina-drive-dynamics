import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizeStage, CRM_STAGES } from '@/lib/crmStages';

export interface CrmRecord {
  id: string;
  isVirtual?: boolean;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  notes: string | null;
  source?: string;
  status?: string;
  pipeline_stage: string | null;
  created_at: string;
  status_updated_at: string | null;
  admin_last_viewed_at: string | null;
  is_archived?: boolean;
  displayStage: string;
  appDetails?: any;
  [key: string]: any;
}

export interface CrmAccount {
  id: string;
  user_id?: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at: string;
}

const digits = (p?: string | null) => (p || '').replace(/\D/g, '');

/**
 * Unified CRM data layer. Replicates the original board's leads ⇆ finance_applications
 * merge (email/phone matching, virtual leads from orphan apps) so both the Board and
 * Table views share ONE source of truth. Mutations preserve the original behaviour:
 * stage moves raw-write leads.pipeline_stage + sync finance_applications.status
 * (no side-effects on drag, matching the legacy board). Finance status changes that
 * MUST fire emails/WhatsApp should still go through useUpdateFinanceApplication in the
 * Table view — this hook intentionally does not duplicate those.
 */
export const useCrmData = () => {
  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    const [{ data: leadData }, { data: apps }, { data: profiles }] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(20000),
      supabase.from('finance_applications')
        .select('id, user_id, status, created_at, full_name, email, phone, assigned_f_and_i, selected_vehicle_id, vehicles:vehicles!finance_applications_selected_vehicle_id_fkey(make, model, year)')
        .limit(20000),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(20000),
    ]);

    let combined: CrmRecord[] = (leadData || []).map((l: any) => ({
      ...l,
      displayStage: normalizeStage(l.pipeline_stage || 'new'),
    }));

    // Orphan finance apps → virtual leads.
    apps?.forEach((app: any) => {
      if (!app.email && !app.phone) return;
      const exists = combined.find((l) =>
        (l.client_email && app.email && l.client_email.toLowerCase() === app.email.toLowerCase()) ||
        (l.client_phone && app.phone && digits(l.client_phone) === digits(app.phone))
      );
      if (!exists) {
        combined.push({
          id: `virtual-${app.id}`,
          isVirtual: true,
          client_name: app.full_name,
          client_phone: app.phone,
          client_email: app.email,
          notes: null,
          source: 'finance_app',
          pipeline_stage: normalizeStage(app.status),
          created_at: app.created_at,
          status_updated_at: app.created_at,
          admin_last_viewed_at: null,
          is_archived: false,
          displayStage: normalizeStage(app.status),
          appDetails: app,
        });
      }
    });

    // Link apps to existing leads; let a progressed app status drive display.
    const mapped = combined.map((lead) => {
      let rawStatus = lead.pipeline_stage;
      if (!lead.isVirtual && !lead.appDetails) {
        const app = apps?.find((a: any) =>
          (lead.client_email && a.email && lead.client_email.toLowerCase() === a.email.toLowerCase()) ||
          (lead.client_phone && a.phone && digits(lead.client_phone) === digits(a.phone))
        );
        if (app) {
          lead.appDetails = app;
          if (app.status && normalizeStage(app.status) !== 'new') rawStatus = app.status;
        }
      }
      let cleanStage = normalizeStage(rawStatus);
      if (cleanStage === 'archived') { lead.is_archived = true; cleanStage = 'lost'; }
      if (cleanStage === 'lost') lead.is_archived = true;
      if (!CRM_STAGES.find((c) => c.id === cleanStage)) cleanStage = 'new';
      lead.displayStage = cleanStage;
      return lead;
    });

    setRecords(mapped);

    // Registered accounts with no app and no lead.
    const accountsWithout = (profiles || []).filter((profile: any) => {
      const hasApp = apps?.some((a: any) => a.user_id === profile.user_id || (a.email && profile.email && a.email.toLowerCase() === profile.email.toLowerCase()));
      const hasLead = (leadData || []).some((l: any) => l.client_email && profile.email && l.client_email.toLowerCase() === profile.email.toLowerCase());
      return !hasApp && !hasLead;
    });
    setAccounts(accountsWithout as CrmAccount[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Move a record to a new stage (drag/drop or dropdown). Preserves legacy behaviour.
  const moveStage = useCallback(async (recordId: string, newStage: string) => {
    const idx = records.findIndex((l) => l.id === recordId);
    if (idx === -1) return;
    const lead = records[idx];
    const isLost = newStage === 'lost';

    const updated = [...records];
    updated[idx] = { ...lead, displayStage: newStage, pipeline_stage: newStage, is_archived: isLost };
    if (updated[idx].appDetails) {
      updated[idx] = { ...updated[idx], appDetails: { ...updated[idx].appDetails, status: newStage } };
    }
    setRecords(updated);

    try {
      if (lead.isVirtual) {
        const { data: newDbLead, error } = await supabase.from('leads').insert({
          client_name: lead.client_name,
          client_phone: lead.client_phone,
          client_email: lead.client_email,
          pipeline_stage: newStage,
          source: 'finance_app',
          status: 'new',
        }).select().single();
        if (!error && newDbLead) {
          updated[idx] = { ...updated[idx], id: newDbLead.id, isVirtual: false };
          setRecords([...updated]);
        }
      } else {
        await supabase.from('leads').update({
          pipeline_stage: newStage,
          status_updated_at: new Date().toISOString(),
          is_archived: isLost,
        }).eq('id', lead.id);
      }
      if (lead.appDetails) {
        await supabase.from('finance_applications').update({ status: newStage }).eq('id', lead.appDetails.id);
      }
      toast.success(`Moved to ${newStage.replace(/_/g, ' ')}`);
    } catch {
      toast.error('Move failed — reverting');
      fetchAll();
    }
  }, [records, fetchAll]);

  const archiveRecords = useCallback(async (ids: string[]) => {
    const realIds = ids.filter((id) => !id.startsWith('virtual-'));
    if (realIds.length === 0) { toast.error('Selected leads are virtual — move them into a stage first.'); return; }
    const { error } = await supabase.from('leads').update({ is_archived: true }).in('id', realIds);
    if (error) { toast.error('Archive failed: ' + error.message); return; }
    setRecords((prev) => prev.map((l) => realIds.includes(l.id) ? { ...l, is_archived: true } : l));
    toast.success(`Archived ${realIds.length} lead${realIds.length > 1 ? 's' : ''}`);
  }, []);

  const deleteRecords = useCallback(async (ids: string[]) => {
    const realIds = ids.filter((id) => !id.startsWith('virtual-'));
    if (realIds.length === 0) { toast.error('No deletable leads selected.'); return; }
    const { error } = await supabase.from('leads').delete().in('id', realIds);
    if (error) { toast.error('Delete failed: ' + error.message); return; }
    setRecords((prev) => prev.filter((l) => !realIds.includes(l.id)));
    toast.success(`Deleted ${realIds.length} lead${realIds.length > 1 ? 's' : ''}`);
  }, []);

  const assignRecords = useCallback(async (ids: string[], fniId: string, fniName: string) => {
    const appIds = Array.from(new Set(ids.map((id) => records.find((l) => l.id === id)?.appDetails?.id).filter(Boolean) as string[]));
    const skipped = ids.length - appIds.length;
    if (appIds.length === 0) { toast.error('None of the selected leads have a finance application to assign.'); return; }
    const { error } = await supabase.from('finance_applications')
      .update({ assigned_f_and_i: fniId, assigned_f_and_i_at: new Date().toISOString() } as any)
      .in('id', appIds);
    if (error) { toast.error('Assign failed: ' + error.message); return; }
    toast.success(`Assigned ${appIds.length} to ${fniName}${skipped > 0 ? ` • ${skipped} skipped (no application)` : ''}`);
  }, [records]);

  const addLead = useCallback(async (name: string, phone: string, notes?: string) => {
    const { error } = await supabase.from('leads').insert({
      client_name: name, client_phone: phone, notes: notes || 'Manual Entry',
      pipeline_stage: 'new', source: 'manual', status: 'new',
    });
    if (error) { toast.error(error.message); return false; }
    toast.success('Lead added');
    fetchAll();
    return true;
  }, [fetchAll]);

  return {
    records, accounts, loading,
    refetch: fetchAll,
    moveStage, archiveRecords, deleteRecords, assignRecords, addLead,
  };
};
