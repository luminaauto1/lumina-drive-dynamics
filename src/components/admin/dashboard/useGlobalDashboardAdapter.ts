import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Layout } from 'react-grid-layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentSettings } from '@/hooks/useDocumentSettings';
import type { DashboardPersistedState, DashboardStorageAdapter } from './types';

/**
 * DB-backed storage adapter for the Command Center dashboard.
 *
 * Owner decision: there is ONE dashboard layout for the whole team. It lives in
 * site_settings.document_settings.commandDashboardLayout ({version, layout,
 * visibleIds}) — the same JSON blob that already carries navConfig and
 * quoteAddonLabels — so every staff member reads the same arrangement, and only
 * super-admins can write it (adapter.canEdit ⇒ no customize UI for anyone else;
 * RLS on site_settings remains the real write floor).
 *
 * Reads go through useDocumentSettings (shared react-query cache — AdminSidebar
 * already keeps it warm for navConfig, so the dashboard usually paints with the
 * saved layout immediately). Writes are debounced so a drag burst collapses into
 * one DB write + one "Dashboard updated for all users" toast, and use a fresh
 * read-modify-write on the row (consumeInvoiceNumber pattern) so we only touch
 * our key and never clobber concurrently-saved document settings.
 */

export const COMMAND_LAYOUT_VERSION = 'v1';

// document_settings is a JSON column not in the generated Supabase types.
const db = supabase as any;

function validate(raw: unknown): DashboardPersistedState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as DashboardPersistedState;
  if (s.version !== COMMAND_LAYOUT_VERSION) return null;
  if (!Array.isArray(s.layout) || !Array.isArray(s.visibleIds)) return null;
  return s;
}

async function persistCommandLayout(state: DashboardPersistedState) {
  const { data: row } = await db
    .from('site_settings')
    .select('id, document_settings')
    .limit(1)
    .maybeSingle();
  const merged = { ...(row?.document_settings || {}), commandDashboardLayout: state };
  if (row?.id) {
    const { error } = await db.from('site_settings').update({ document_settings: merged }).eq('id', row.id);
    if (error) throw error;
  } else {
    const { error } = await db.from('site_settings').insert({ document_settings: merged });
    if (error) throw error;
  }
}

const SAVE_DEBOUNCE_MS = 800;

export function useGlobalDashboardAdapter(): DashboardStorageAdapter {
  const { isSuperAdmin } = useAuth();
  const { data, isLoading } = useDocumentSettings();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: persistCommandLayout,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-settings'] });
      toast.success('Dashboard updated for all users');
    },
    onError: (e: any) => toast.error('Could not save dashboard: ' + (e?.message || e)),
  });

  const state = useMemo(() => validate(data?.commandDashboardLayout), [data?.commandDashboardLayout]);

  // Debounced save: rapid drag/resize/toggle bursts collapse into one write.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<DashboardPersistedState | null>(null);
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;

  const save = useCallback((next: { layout: Layout[]; visibleIds: string[] }) => {
    pending.current = {
      version: COMMAND_LAYOUT_VERSION,
      layout: next.layout,
      visibleIds: next.visibleIds,
    };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (pending.current) {
        mutateRef.current(pending.current);
        pending.current = null;
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Flush a pending save if the page unmounts inside the debounce window.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current) {
        mutateRef.current(pending.current);
        pending.current = null;
      }
    },
    [],
  );

  return useMemo(
    () => ({ state, isLoading, canEdit: isSuperAdmin, save }),
    [state, isLoading, isSuperAdmin, save],
  );
}
