// Manual per-application documents checklist (owner rule: clients send docs on
// WhatsApp — staff tick what has arrived; there is NO client upload portal).
// Chip shows n/4 (red 0 · amber partial · green complete); clicking opens a
// popover with the four standard items. Writes finance_applications.
// docs_checklist (jsonb, P0 migration) + an audit-log entry per change.
import { useState } from 'react';
import { FileCheck2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const DOC_CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'licence', label: "Driver's Licence" },
  { key: 'payslips', label: 'Payslips' },
  { key: 'statements', label: 'Bank Statements' },
];

export function docsChecklistCount(app: any): { done: number; total: number } {
  const cl = (app?.docs_checklist || {}) as Record<string, boolean>;
  const done = DOC_CHECKLIST_ITEMS.filter((i) => cl[i.key] === true).length;
  return { done, total: DOC_CHECKLIST_ITEMS.length };
}

export function DocsChecklistChip({ app }: { app: any }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  // Local optimistic copy so ticks feel instant; realtime refresh reconciles.
  const [local, setLocal] = useState<Record<string, boolean> | null>(null);

  const checklist = local ?? ((app?.docs_checklist || {}) as Record<string, boolean>);
  const done = DOC_CHECKLIST_ITEMS.filter((i) => checklist[i.key] === true).length;
  const total = DOC_CHECKLIST_ITEMS.length;

  const chipCls =
    done === 0
      ? 'bg-red-500/10 text-red-400 border-red-500/30'
      : done < total
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

  const toggle = async (key: string, label: string, value: boolean) => {
    const next = { ...checklist, [key]: value };
    setLocal(next);
    setBusy(true);
    try {
      const { error } = await supabase
        .from('finance_applications')
        .update({ docs_checklist: next } as any)
        .eq('id', app.id);
      if (error) throw error;
      const actorName = user?.email?.split('@')[0] || 'staff';
      const doneNow = DOC_CHECKLIST_ITEMS.filter((i) => next[i.key] === true).length;
      await supabase.from('client_audit_logs').insert([{
        client_email: app.email || null,
        client_phone: app.phone || null,
        note: `Docs checklist — ${label} ${value ? '✓' : '✗'} (${doneNow}/${total}) by ${actorName}`,
        author_id: user?.id || null,
        author_name: actorName,
        action_type: 'Docs Checklist',
        application_id: app.id,
      } as any]);
    } catch (e) {
      console.error('[docs-checklist] update failed', e);
      setLocal(checklist); // roll back the optimistic tick
      toast({ title: 'Failed to update checklist', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1 text-[10px] tabular-nums whitespace-nowrap px-1.5 py-0.5 rounded border transition-colors hover:brightness-125 ${chipCls}`}
          title="Documents checklist — tick what has arrived on WhatsApp"
        >
          <FileCheck2 className="w-3 h-3" /> {done}/{total}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Documents received
        </p>
        <div className="space-y-2">
          {DOC_CHECKLIST_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <Checkbox
                id={`docs-${app.id}-${item.key}`}
                checked={checklist[item.key] === true}
                disabled={busy}
                onCheckedChange={(v) => void toggle(item.key, item.label, v === true)}
              />
              <Label htmlFor={`docs-${app.id}-${item.key}`} className="text-sm cursor-pointer">
                {item.label}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
