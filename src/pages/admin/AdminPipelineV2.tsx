import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, Users, ArrowDownUp, X } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useFinanceApplications, useUpdateFinanceApplication, type FinanceApplication } from '@/hooks/useFinanceApplications';
import { useFAndIUsers } from '@/hooks/useFAndIUsers';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { PIPELINE_TABS, inTab } from '@/lib/pipelinev2/tabs';
import { colorForUser } from '@/lib/pipelinev2/presence';
import { loadConfig, type TableConfig } from '@/lib/pipelinev2/columns';
import {
  FILTERABLE_KEYS, buildFacets, rowPassesColumnFilters, columnFiltersKey,
  activeColumnFilterCount, type FilterLabelMaps,
} from '@/lib/pipelinev2/filters';
import { PipelineTabNav } from '@/components/admin/pipelinev2/PipelineTabNav';
import { ApplicationTable } from '@/components/admin/pipelinev2/ApplicationTable';
import { ColumnsPicker } from '@/components/admin/pipelinev2/ColumnsPicker';
import { ApplicationDrawer } from '@/components/admin/pipelinev2/ApplicationDrawer';
import { StatusChangeModal } from '@/components/admin/pipelinev2/StatusChangeModal';
import { BulkStatusModal } from '@/components/admin/pipelinev2/BulkStatusModal';
import CreditCheckResultModal, { type CreditCheckOutcome } from '@/components/admin/CreditCheckResultModal';
import { SavedViewsBar } from '@/components/admin/SavedViewsBar';
import { useSavedViews } from '@/hooks/useSavedViews';

interface Busy { userId: string; name: string; color: string }
type FniFilter = 'all' | 'self' | 'unassigned';
type SearchScope = 'tab' | 'all';

/** Persisted Pipeline filter preset (saved views). Search text is intentionally
 *  excluded — a saved view captures lane/scope/sort/owner filters, not a query. */
interface PipelinePreset {
  activeTab: string;
  searchScope: SearchScope;
  sortDir: 'desc' | 'asc';
  fniFilter: FniFilter;
}

const appSearchBlob = (a: FinanceApplication): string => {
  const any = a as any;
  return [any.full_name, any.first_name, any.last_name, any.email, any.phone, any.id_number, any.bank_reference, any.bank_name]
    .filter(Boolean).join(' ').toLowerCase();
};

const AdminPipelineV2 = () => {
  const { user, role, isSuperAdmin, isSeniorFAndI } = useAuth();
  const { data: apps = [], isLoading } = useFinanceApplications();
  const { data: fniUsers = [] } = useFAndIUsers();
  const updateApplication = useUpdateFinanceApplication();
  const { labels: statusLabels, styles: statusStyles, financeLaneOverrides, clientLabels } = useStatusConfig();

  // 'all' tab was removed — default to the first real lane (New Applications).
  const [activeTab, setActiveTab] = useState('intake');
  const [search, setSearch] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('tab');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [fniFilter, setFniFilter] = useState<FniFilter>(isSuperAdmin || isSeniorFAndI ? 'all' : 'self');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Status-change modal target. `track` decides which tab the modal opens on
  // (Finance Status badge → 'finance'; Client Status badge → 'client').
  const [statusChangeApp, setStatusChangeApp] = useState<{ app: FinanceApplication; track: 'finance' | 'client' } | null>(null);
  const openStatusChange = (app: FinanceApplication, track: 'finance' | 'client' = 'finance') =>
    setStatusChangeApp({ app, track });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulk, setShowBulk] = useState(false);
  // Credit-check result modal (Passed/Failed from the intake lane's Credit Check cell).
  const [ccApp, setCcApp] = useState<FinanceApplication | null>(null);
  const [ccOutcome, setCcOutcome] = useState<CreditCheckOutcome>('passed');
  const [ccOpen, setCcOpen] = useState(false);
  const [tableConfig, setTableConfig] = useState<TableConfig>(() => loadConfig('intake'));
  const [busyByApp, setBusyByApp] = useState<Map<string, Busy>>(new Map());
  // Per-column header filter selections (session state; keyed by column key).
  // A missing/empty entry = that column imposes no filter. Cleared on tab change.
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const setColumnFilter = (key: string, values: string[]) =>
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (values.length === 0) delete next[key];
      else next[key] = values;
      return next;
    });

  // ---- Saved views (per-user filter presets) -------------------------------
  const { views, saveView, deleteView } = useSavedViews<PipelinePreset>('pipeline', user?.id);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const applyPreset = (p: PipelinePreset) => {
    // A saved view may still carry the removed 'all' lane — coerce any stale/invalid
    // tab to the first real lane so the view is never empty.
    const laneExists = PIPELINE_TABS.some((t) => t.key === p.activeTab);
    setActiveTab(laneExists ? p.activeTab : 'intake');
    setSearchScope(p.searchScope);
    setSortDir(p.sortDir);
    if (showFniFilter) setFniFilter(p.fniFilter);
  };

  // Re-load saved column config when switching tabs (per-tab presets). Also clear
  // per-column filters: columns differ per lane, so a filter carried into a lane
  // where its column is hidden would silently hide rows.
  useEffect(() => { setTableConfig(loadConfig(activeTab)); setColumnFilters({}); }, [activeTab]);

  // ---- Realtime presence: "who is viewing which profile" -------------------
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myColor = user ? colorForUser(user.id) : '#888';
  const myName = user?.email?.split('@')[0] || 'Someone';

  useEffect(() => {
    if (!user) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      if (cancelled) return;
      channel = supabase.channel('pipeline-v2-presence', { config: { presence: { key: user.id } } });
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel!.presenceState() as Record<string, any[]>;
        const map = new Map<string, Busy>();
        for (const metas of Object.values(state)) {
          for (const m of metas) {
            // Only show OTHER people; ignore my own cursor.
            if (m.applicationId && m.userId && m.userId !== user.id) {
              map.set(m.applicationId, { userId: m.userId, name: m.name, color: m.color });
            }
          }
        }
        setBusyByApp(map);
      });
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel!.track({ applicationId: null, userId: user.id, name: myName, color: myColor });
        }
      });
      channelRef.current = channel;
    })();
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); channelRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Broadcast which application the current user is viewing (drawer open).
  useEffect(() => {
    const ch = channelRef.current as any;
    if (ch && ch.state === 'joined' && user) {
      ch.track({ applicationId: selectedId, userId: user.id, name: myName, color: myColor });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ---- Filtering (mirrors AdminFinance ownership rules) --------------------
  const baseFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter((a) => {
      if (q && !appSearchBlob(a).includes(q)) return false;

      const owner = (a as any).assigned_f_and_i as string | null | undefined;
      const ownerIsSenior = !!owner && fniUsers.some((u) => u.id === owner && u.role === 'senior_f_and_i');
      const effectivelyUnassigned = !owner || ownerIsSenior;

      if (role === 'f_and_i') {
        // Normal F&I: only their own deals + still-claimable (unassigned) ones.
        return effectivelyUnassigned || owner === user?.id;
      }
      if (fniFilter === 'self') return owner === user?.id;
      if (fniFilter === 'unassigned') return effectivelyUnassigned;
      return true; // 'all'
    });
  }, [apps, search, fniUsers, role, fniFilter, user?.id]);

  // Counts per tab over the visible (ownership+search) set.
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of PIPELINE_TABS) c[t.key] = 0;
    for (const a of baseFiltered) {
      for (const t of PIPELINE_TABS) if (inTab(t.key, (a as any).status, financeLaneOverrides)) c[t.key] += 1;
    }
    return c;
  }, [baseFiltered, financeLaneOverrides]);

  // When searching with scope = 'all', results span every lane (the active-tab
  // filter is bypassed); otherwise rows stay scoped to the active tab.
  const searchingAllTabs = searchScope === 'all' && search.trim().length > 0;

  // Lane-scoped set = ownership + search + lane, BEFORE per-column filters. Faceted
  // filter options are derived from this so the option lists stay stable regardless
  // of what's currently selected.
  const laneScoped = useMemo(
    () =>
      searchingAllTabs
        ? baseFiltered
        : baseFiltered.filter((a) => inTab(activeTab, (a as any).status, financeLaneOverrides)),
    [baseFiltered, activeTab, searchingAllTabs, financeLaneOverrides],
  );

  const filterMaps: FilterLabelMaps = useMemo(
    () => ({ statusLabels, clientLabels }),
    [statusLabels, clientLabels],
  );

  // Faceted options (distinct values + counts) for each filterable column.
  const facets = useMemo(
    () => buildFacets(laneScoped, FILTERABLE_KEYS, filterMaps),
    [laneScoped, filterMaps],
  );

  // Final rows: apply per-column filters AFTER lane+search, BEFORE sort/render.
  const rows = useMemo(() => {
    const hasColumnFilter = activeColumnFilterCount(columnFilters) > 0;
    const list = hasColumnFilter
      ? laneScoped.filter((a) => rowPassesColumnFilters(a, columnFilters, filterMaps))
      : laneScoped;
    return [...list].sort((x, y) => {
      const dx = new Date((x as any).created_at || 0).getTime();
      const dy = new Date((y as any).created_at || 0).getTime();
      return sortDir === 'desc' ? dy - dx : dx - dy;
    });
  }, [laneScoped, columnFilters, filterMaps, sortDir]);

  // ---- Selection -----------------------------------------------------------
  const toggleSelect = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleSelectAll = (ids: string[], select: boolean) => setSelectedIds((prev) => {
    const next = new Set(prev); ids.forEach((id) => (select ? next.add(id) : next.delete(id))); return next;
  });
  const clearSelection = () => setSelectedIds(new Set());

  const selectedApp = selectedId ? apps.find((a) => a.id === selectedId) || null : null;
  const showFniFilter = isSuperAdmin || isSeniorFAndI;
  const othersViewing = busyByApp.size;

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Pipeline</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              A new view of the same finance applications — status changes fire the exact same notifications as the Finance page.
            </p>
          </div>
          {othersViewing > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" /> {othersViewing} other{othersViewing === 1 ? '' : 's'} viewing
            </div>
          )}
        </div>

        {/* Toolbar — every control locked to one 36px (h-9) height and one gap-2
            rhythm so search / scope / F&I / sort / columns align on a single row. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, ID, bank ref…" className="pl-8 h-9" />
          </div>
          {/* Search scope: limit matches to the current lane, or sweep every lane. */}
          <div className="inline-flex h-9 items-center rounded-md border border-border bg-background p-0.5 text-xs" title="Choose whether search looks only inside the current tab or across all tabs">
            {([['tab', 'This tab'], ['all', 'All tabs']] as const).map(([val, label]) => (
              <button key={val} type="button" onClick={() => setSearchScope(val)}
                className={'rounded px-2.5 py-1 font-medium transition ' +
                  (searchScope === val ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {label}
              </button>
            ))}
          </div>
          {showFniFilter && (
            <Select value={fniFilter} onValueChange={(v) => setFniFilter(v as FniFilter)}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All F&amp;I</SelectItem>
                <SelectItem value="self">Mine</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}>
            <ArrowDownUp className="w-4 h-4" /> {sortDir === 'desc' ? 'Newest' : 'Oldest'}
          </Button>
          <ColumnsPicker tabKey={activeTab} config={tableConfig} onChange={setTableConfig} />
        </div>

        <SavedViewsBar
          views={views}
          activeId={activeViewId}
          onApply={(v) => { applyPreset(v.preset); setActiveViewId(v.id); }}
          onSave={(name) => saveView(name, { activeTab, searchScope, sortDir, fniFilter })}
          onDelete={(id) => { deleteView(id); if (id === activeViewId) setActiveViewId(null); }}
        />

        <PipelineTabNav counts={counts} activeKey={activeTab} onChange={(k) => { setActiveTab(k); setActiveViewId(null); }} />

        {searchingAllTabs && (
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            <Search className="w-3.5 h-3.5" />
            Showing <span className="font-medium text-foreground">{rows.length.toLocaleString()}</span> match{rows.length === 1 ? '' : 'es'} for “{search.trim()}” across all tabs.
          </div>
        )}

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
            <span className="font-medium">{selectedIds.size} selected</span>
            <Button size="sm" onClick={() => setShowBulk(true)}>Change status</Button>
            <Button size="sm" variant="ghost" className="gap-1" onClick={clearSelection}><X className="w-3.5 h-3.5" /> Clear</Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading applications…
          </div>
        ) : (
          <ApplicationTable
            applications={rows}
            config={tableConfig}
            onSelect={setSelectedId}
            onChangeStatus={openStatusChange}
            selectable
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            busyByApp={busyByApp}
            statusLabels={statusLabels}
            statusStyles={statusStyles}
            facets={facets}
            columnFilters={columnFilters}
            onColumnFilterChange={setColumnFilter}
            windowKey={`${activeTab}|${searchScope}|${fniFilter}|${search.trim().toLowerCase()}|${columnFiltersKey(columnFilters)}`}
            showCreditScan={activeTab === 'intake'}
            onCreditCheckOutcome={(app, outcome) => { setCcApp(app); setCcOutcome(outcome); setCcOpen(true); }}
          />
        )}
      </div>

      <ApplicationDrawer
        app={selectedApp}
        onClose={() => setSelectedId(null)}
        onChangeStatus={(a) => openStatusChange(a)}
      />

      {statusChangeApp && (
        <StatusChangeModal
          app={statusChangeApp.app}
          initialTrack={statusChangeApp.track}
          updateApplication={updateApplication}
          onClose={() => setStatusChangeApp(null)}
          role={role}
        />
      )}

      {showBulk && (
        <BulkStatusModal
          appIds={Array.from(selectedIds)}
          updateApplication={updateApplication}
          onClose={() => setShowBulk(false)}
          onDone={clearSelection}
          role={role}
          labelOverrides={statusLabels}
        />
      )}

      {ccApp && (
        <CreditCheckResultModal
          open={ccOpen}
          onOpenChange={(o) => { setCcOpen(o); if (!o) setCcApp(null); }}
          outcome={ccOutcome}
          applicationId={ccApp.id}
        />
      )}
    </AdminLayout>
  );
};

export default AdminPipelineV2;
