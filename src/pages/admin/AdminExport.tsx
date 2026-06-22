import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Save, Trash2, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { STATUS_OPTIONS } from '@/lib/statusConfig';
import { EXPORT_COLUMNS, DEFAULT_EXPORT_COLUMNS, formatExportValue } from '@/lib/export/columns';

const db = supabase as any; // export_presets not in generated types yet
type DateField = 'created_at' | 'status_updated_at';
interface Preset { id: string; name: string; config: any }

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const AdminExport = () => {
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [dateField, setDateField] = useState<DateField>('created_at');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [columns, setColumns] = useState<Set<string>>(new Set(DEFAULT_EXPORT_COLUMNS));
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);

  const loadPresets = async () => {
    const { data } = await db.from('export_presets').select('id, name, config').order('name');
    setPresets((data as Preset[]) ?? []);
  };
  useEffect(() => { loadPresets(); }, []);

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  };

  // Apply the current filters to a finance_applications query.
  const applyFilters = (q: any) => {
    if (statuses.size) q = q.in('status', [...statuses]);
    if (!includeArchived) q = q.or('is_archived.is.null,is_archived.eq.false');
    if (fromDate) q = q.gte(dateField, new Date(`${fromDate}T00:00:00`).toISOString());
    if (toDate) q = q.lte(dateField, new Date(`${toDate}T23:59:59`).toISOString());
    return q;
  };

  const orderedCols = useMemo(() => EXPORT_COLUMNS.filter((c) => columns.has(c.key)), [columns]);

  const preview = async () => {
    setCounting(true);
    try {
      let q = db.from('finance_applications').select('id', { count: 'exact', head: true });
      q = applyFilters(q);
      const { count: c, error } = await q;
      if (error) throw error;
      setCount(c ?? 0);
    } catch (e: any) {
      toast.error('Count failed: ' + e.message);
    } finally {
      setCounting(false);
    }
  };

  const runExport = async () => {
    if (!orderedCols.length) { toast.error('Pick at least one column'); return; }
    setBusy(true);
    try {
      const selectStr = ['id', ...orderedCols.map((c) => c.key)].join(',');
      const page = 1000;
      let from = 0;
      const rows: any[] = [];
      // Paginate past the PostgREST 1000-row cap. RLS still scopes what each user sees.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q = db.from('finance_applications').select(selectStr).order(dateField, { ascending: false }).range(from, from + page - 1);
        q = applyFilters(q);
        const { data, error } = await q;
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < page) break;
        from += page;
      }
      const header = orderedCols.map((c) => csvCell(c.label)).join(',');
      const body = rows.map((r) => orderedCols.map((c) => csvCell(formatExportValue(c.key, r[c.key]))).join(',')).join('\n');
      const csv = '﻿' + header + '\n' + body;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-applications-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} application${rows.length === 1 ? '' : 's'}`);
    } catch (e: any) {
      toast.error('Export failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const currentConfig = () => ({
    statuses: [...statuses], dateField, fromDate, toDate, includeArchived, columns: [...columns],
  });
  const applyConfig = (c: any) => {
    setStatuses(new Set(c.statuses ?? []));
    setDateField(c.dateField ?? 'created_at');
    setFromDate(c.fromDate ?? '');
    setToDate(c.toDate ?? '');
    setIncludeArchived(!!c.includeArchived);
    setColumns(new Set(c.columns?.length ? c.columns : DEFAULT_EXPORT_COLUMNS));
  };

  const savePreset = async () => {
    const name = presetName.trim();
    if (!name) { toast.error('Name the preset first'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await db.from('export_presets').upsert(
      { name, config: currentConfig(), created_by: user?.id ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'name' },
    );
    if (error) { toast.error('Save failed: ' + error.message); return; }
    toast.success('Preset saved');
    setPresetName('');
    loadPresets();
  };
  const deletePreset = async (id: string) => {
    const { error } = await db.from('export_presets').delete().eq('id', id);
    if (error) { toast.error('Delete failed: ' + error.message); return; }
    toast.success('Preset deleted');
    loadPresets();
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-primary" /> Export Builder
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build a custom CSV of finance applications — filter by status &amp; date, pick your columns, and save reusable presets.
          </p>
        </div>

        {/* Presets */}
        <Card>
          <CardHeader><CardTitle className="text-base">Saved exports</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {presets.length === 0 && <span className="text-xs text-muted-foreground">No saved presets yet.</span>}
              {presets.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 pl-2 pr-1 py-1 text-xs">
                  <button className="hover:text-primary" onClick={() => applyConfig(p.config)} title="Load this preset">{p.name}</button>
                  <button className="text-muted-foreground hover:text-red-400 p-0.5" onClick={() => deletePreset(p.id)} aria-label="Delete preset"><Trash2 className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Name this configuration…" className="max-w-xs h-9" />
              <Button type="button" variant="outline" size="sm" onClick={savePreset}><Save className="w-4 h-4 mr-1" /> Save preset</Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Statuses <span className="opacity-60">(none = all)</span></Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 mt-2">
                {STATUS_OPTIONS.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={statuses.has(s.value)} onCheckedChange={() => toggle(statuses, s.value, setStatuses)} />
                    <span className="truncate">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Date field</Label>
                <Select value={dateField} onValueChange={(v) => setDateField(v as DateField)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Received date</SelectItem>
                    <SelectItem value="status_updated_at">Status-change date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={includeArchived} onCheckedChange={(c) => setIncludeArchived(c === true)} />
              Include archived applications
            </label>
          </CardContent>
        </Card>

        {/* Columns */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Columns ({columns.size})</CardTitle>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setColumns(new Set(EXPORT_COLUMNS.map((c) => c.key)))}>All</Button>
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setColumns(new Set())}>None</Button>
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setColumns(new Set(DEFAULT_EXPORT_COLUMNS))}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Default</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
              {EXPORT_COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={columns.has(c.key)} onCheckedChange={() => toggle(columns, c.key, setColumns)} />
                  <span className="truncate">{c.label}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={preview} disabled={counting}>
            {counting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            {count == null ? 'Preview count' : `${count} match${count === 1 ? '' : 'es'}`}
          </Button>
          <Button type="button" onClick={runExport} disabled={busy || !columns.size} size="lg">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Export CSV
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminExport;
