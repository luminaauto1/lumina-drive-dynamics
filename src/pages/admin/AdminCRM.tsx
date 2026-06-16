import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search, UserPlus, RefreshCw, Archive, Trash2, Eye, EyeOff, LayoutGrid, Table as TableIcon,
  MessageCircle, UserCog, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useFAndIUsers } from '@/hooks/useFAndIUsers';
import { useCrmData, CrmRecord } from '@/hooks/useCrmData';
import { CRM_PHASES, CRM_STAGES } from '@/lib/crmStages';
import CrmBoard from '@/components/admin/crm/CrmBoard';
import CrmTable from '@/components/admin/crm/CrmTable';
import { LeadCockpit } from '@/components/admin/leads/LeadCockpit';
import UniversalClientHub from '@/components/admin/UniversalClientHub';

const STALE_MS = 24 * 60 * 60 * 1000;

const AdminCRM = () => {
  const { isSuperAdmin } = useAuth();
  const { data: fniUsers = [] } = useFAndIUsers();
  const { records, loading, refetch, moveStage, archiveRecords, deleteRecords, assignRecords, addLead } = useCrmData();

  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<'board' | 'table'>(searchParams.get('view') === 'table' ? 'table' : 'board');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [showStale, setShowStale] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Drawers
  const [cockpitLeadId, setCockpitLeadId] = useState<string | null>(null);
  const [hubOpen, setHubOpen] = useState(false);
  const [hubEmail, setHubEmail] = useState<string | undefined>();
  const [hubPhone, setHubPhone] = useState<string | undefined>();

  // Add lead
  const [addOpen, setAddOpen] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', phone: '', notes: '' });
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const switchView = (v: 'board' | 'table') => {
    setView(v);
    setSearchParams((p) => { p.set('view', v); return p; }, { replace: true });
  };

  const openRecord = (rec: CrmRecord) => {
    if (rec.isVirtual) {
      setHubEmail(rec.client_email || undefined);
      setHubPhone(rec.client_phone || undefined);
      setHubOpen(true);
    } else {
      setCockpitLeadId(rec.id);
    }
  };

  const toggleSelect = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const clearSelection = () => setSelectedIds(new Set());

  const isStale = (r: CrmRecord) => {
    if (r.displayStage !== 'new' || r.appDetails) return false;
    const created = new Date(r.created_at).getTime();
    if (Date.now() - created < STALE_MS) return false;
    const updated = r.status_updated_at ? new Date(r.status_updated_at).getTime() : created;
    return Math.abs(updated - created) < 60_000;
  };

  const sources = useMemo(() => Array.from(new Set(records.map((r) => r.source).filter(Boolean))) as string[], [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      const dead = r.is_archived || r.displayStage === 'lost';
      if (showArchived ? !dead : dead) return false;
      if (!showArchived && !showStale && isStale(r)) return false;
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (!q) return true;
      return (r.client_name?.toLowerCase().includes(q) || r.client_phone?.includes(q) || r.client_email?.toLowerCase().includes(q)) ?? false;
    });
  }, [records, search, sourceFilter, showArchived, showStale]);

  const staleHidden = useMemo(() => records.filter((r) => !r.is_archived && isStale(r)).length, [records]);
  const needsAttention = useMemo(() => filtered.filter((r) => !r.isVirtual && new Date(r.status_updated_at || r.created_at).getTime() > new Date(r.admin_last_viewed_at || 0).getTime()).length, [filtered]);

  const phaseCounts = useMemo(() => {
    const byStage: Record<string, number> = {};
    filtered.forEach((r) => { byStage[r.displayStage] = (byStage[r.displayStage] || 0) + 1; });
    return CRM_PHASES.map((p) => ({
      ...p,
      count: CRM_STAGES.filter((s) => s.phase === p.id).reduce((sum, s) => sum + (byStage[s.id] || 0), 0),
    }));
  }, [filtered]);

  const handleAdd = async () => {
    if (!newLead.name || !newLead.phone) { toast.error('Name and phone required'); return; }
    setAdding(true);
    const ok = await addLead(newLead.name, newLead.phone, newLead.notes);
    setAdding(false);
    if (ok) { setAddOpen(false); setNewLead({ name: '', phone: '', notes: '' }); }
  };

  const bulkMessage = async () => {
    const nums = Array.from(selectedIds)
      .map((id) => records.find((r) => r.id === id)?.client_phone)
      .filter((p): p is string => !!p)
      .map((p) => { const d = p.replace(/\D/g, ''); return d.startsWith('0') ? `27${d.slice(1)}` : d; });
    const unique = Array.from(new Set(nums)).filter(Boolean);
    if (!unique.length) { toast.error('No numbers on the selected leads.'); return; }
    try { await navigator.clipboard.writeText(unique.join('\n')); toast.success(`Copied ${unique.length} number(s) for a WhatsApp broadcast.`); }
    catch { toast.error('Clipboard unavailable.'); }
  };

  const runBulk = async (fn: () => Promise<void>) => { setBulkBusy(true); try { await fn(); clearSelection(); } finally { setBulkBusy(false); } };

  return (
    <AdminLayout>
      <Helmet><title>CRM | Lumina Admin</title><meta name="robots" content="noindex, nofollow" /></Helmet>

      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* HEADER + TOOLBAR */}
        <div className="px-4 py-3 border-b border-border shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">CRM</h1>
              {/* View switcher */}
              <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/30">
                <Button variant={view === 'board' ? 'default' : 'ghost'} size="sm" className="h-7 px-2.5" onClick={() => switchView('board')}>
                  <LayoutGrid className="w-4 h-4 mr-1" /> Board
                </Button>
                <Button variant={view === 'table' ? 'default' : 'ghost'} size="sm" className="h-7 px-2.5" onClick={() => switchView('table')}>
                  <TableIcon className="w-4 h-4 mr-1" /> Table
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search name, phone, email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 w-56 text-sm" />
              </div>

              {/* Source filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    {sourceFilter === 'all' ? 'All sources' : sourceFilter}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSourceFilter('all')}>All sources</DropdownMenuItem>
                  {sources.map((s) => <DropdownMenuItem key={s} onClick={() => setSourceFilter(s)}>{s}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant={showStale ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setShowStale((v) => !v)} title="24h+ untouched inbox leads">
                {showStale ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
                {showStale ? 'Hide stale' : `Stale${staleHidden > 0 ? ` (${staleHidden})` : ''}`}
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={() => setShowArchived((v) => !v)}>
                <Archive className="w-4 h-4 mr-1" /> {showArchived ? 'Active' : 'Archived'}
              </Button>

              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild><Button size="sm" className="h-8"><UserPlus className="w-4 h-4 mr-1" /> Add</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Lead</DialogTitle></DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div><Label>Name *</Label><Input value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} /></div>
                    <div><Label>Phone *</Label><Input value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} /></div>
                    <div><Label>Notes</Label><Input value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} /></div>
                    <Button className="w-full" onClick={handleAdd} disabled={adding}>{adding && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save Lead</Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" size="sm" className="h-8" onClick={refetch}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
            </div>
          </div>

          {/* KPI / phase summary + bulk bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-xs">{filtered.length} active</Badge>
              {needsAttention > 0 && <Badge variant="outline" className="text-xs border-red-500/40 text-red-400">{needsAttention} need attention</Badge>}
              <span className="text-muted-foreground text-xs mx-1">·</span>
              {phaseCounts.map((p) => (
                <span key={p.id} className="text-[11px] text-muted-foreground">
                  <span className={`font-semibold ${p.color}`}>{p.count}</span> {p.label}
                </span>
              ))}
            </div>

            {isSuperAdmin && selectedIds.size > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2 py-1">
                <span className="text-xs text-muted-foreground px-1">{selectedIds.size} selected</span>
                <Button variant="outline" size="sm" className="h-7" onClick={bulkMessage} disabled={bulkBusy}><MessageCircle className="w-4 h-4 mr-1" /> Copy #s</Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-7" disabled={bulkBusy}><UserCog className="w-4 h-4 mr-1" /> Assign</Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Assign F&amp;I</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {fniUsers.length === 0 ? <DropdownMenuItem disabled>No F&amp;I users</DropdownMenuItem>
                      : fniUsers.map((u) => <DropdownMenuItem key={u.id} onClick={() => runBulk(() => assignRecords(Array.from(selectedIds), u.id, u.name))}>{u.name}</DropdownMenuItem>)}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" className="h-7" onClick={() => runBulk(() => archiveRecords(Array.from(selectedIds)))} disabled={bulkBusy}><Archive className="w-4 h-4 mr-1" /> Archive</Button>
                <Button variant="destructive" size="sm" className="h-7" onClick={() => setConfirmDelete(true)} disabled={bulkBusy}><Trash2 className="w-4 h-4 mr-1" /> Delete</Button>
                <Button variant="ghost" size="sm" className="h-7" onClick={clearSelection}>Clear</Button>
              </div>
            )}
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          {loading ? (
            <div className="flex items-center justify-center flex-1"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : view === 'board' ? (
            <CrmBoard records={filtered} onMove={moveStage} onOpen={openRecord} selectedIds={selectedIds} onToggleSelect={toggleSelect} canSelect={isSuperAdmin} />
          ) : (
            <CrmTable records={filtered} onOpen={openRecord} onChanged={refetch} selectedIds={selectedIds} onToggleSelect={toggleSelect} canSelect={isSuperAdmin} />
          )}
        </div>
      </div>

      {/* Drawers */}
      <LeadCockpit leadId={cockpitLeadId} isOpen={!!cockpitLeadId} onClose={() => setCockpitLeadId(null)} onUpdate={refetch} />
      <UniversalClientHub open={hubOpen} onOpenChange={setHubOpen} clientEmail={hubEmail} clientPhone={hubPhone} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} lead{selectedIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the selected leads. Virtual leads (apps without a saved lead row) are skipped. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); runBulk(() => deleteRecords(Array.from(selectedIds))).then(() => setConfirmDelete(false)); }} disabled={bulkBusy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminCRM;
