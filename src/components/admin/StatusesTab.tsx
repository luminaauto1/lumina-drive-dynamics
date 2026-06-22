import { useState } from 'react';
import { Loader2, Save, ListChecks, Info, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStatusConfig, useStatusOverrides, useUpsertStatusOverride, type MergedStatus } from '@/hooks/useZtcSettings';

// Colour presets (shadcn/dark tokens) the admin can pick per status.
const COLOR_PRESETS: { label: string; cls: string }[] = [
  { label: 'Slate', cls: 'bg-muted text-muted-foreground border-border' },
  { label: 'Blue', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { label: 'Cyan', cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { label: 'Amber', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { label: 'Green', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { label: 'Purple', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { label: 'Red', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
];

const Row = ({ s, order }: { s: MergedStatus; order: number }) => {
  const upsert = useUpsertStatusOverride();
  const [label, setLabel] = useState(s.label);
  const [cls, setCls] = useState(s.colorClass);
  const [sortOrder, setSortOrder] = useState(order);
  const [hidden, setHidden] = useState(s.hidden);
  const save = () => upsert.mutate({ slug: s.value, label, color_class: cls, sort_order: sortOrder, is_hidden: hidden });
  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={'rounded border px-1.5 py-0.5 text-xs font-semibold ' + cls}>{label || s.value}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{s.value}</span>
          <div className="flex-1" />
          <Button size="sm" onClick={save} disabled={upsert.isPending} className="h-7 gap-1">
            {upsert.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          <div className="md:col-span-2">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Display label" className="h-8 text-sm" />
          </div>
          <Select value={cls} onValueChange={setCls}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Colour" /></SelectTrigger>
            <SelectContent>{COLOR_PRESETS.map((p) => <SelectItem key={p.cls} value={p.cls}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="h-8 w-20" title="Sort order" />
            <button type="button" onClick={() => setHidden((h) => !h)} title={hidden ? 'Hidden' : 'Visible'}
              className={'inline-flex items-center gap-1 text-xs ' + (hidden ? 'text-muted-foreground' : 'text-foreground')}>
              {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const StatusesTab = () => {
  const { merged } = useStatusConfig();
  const { isLoading } = useStatusOverrides();
  return (
    <div className="space-y-3 max-w-3xl">
      <div className="flex items-center gap-2">
        <ListChecks className="w-4 h-4 text-primary" />
        <h2 className="text-lg font-semibold">Pipeline Statuses</h2>
      </div>
      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        You can rename, recolour, reorder and hide statuses here — these apply to the new <strong>Pipeline</strong> view. The underlying status
        keys are fixed (they're wired into the auto-mailer, WhatsApp notifications and pipeline lanes), so adding/removing statuses isn't done here.
      </div>
      {isLoading ? <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        : merged.map((s, i) => <Row key={s.value} s={s} order={s.sortOrder ?? i} />)}
    </div>
  );
};

export default StatusesTab;
