import { useEffect, useState } from 'react';
import { Save, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Deal, DeliveryChecklist, ChecklistStep, PickupOrDelivery } from '@/lib/dealdesk/types';
import { CHECKLIST_STEPS, CHECKLIST_STEP_LABEL, CHECKLIST_STEP_OPTIONS } from '@/lib/dealdesk/types';
import { useDealChecklist, useSaveChecklist } from '@/hooks/dealdesk/useDealDesk';

type StepState = Record<string, ChecklistStep>;

const STEP_DOT: Record<ChecklistStep, string> = {
  not_started: 'bg-muted-foreground/40', requested: 'bg-blue-400', in_progress: 'bg-amber-400',
  done: 'bg-emerald-400', not_applicable: 'bg-muted-foreground/30',
};

export function ChecklistTab({ deal }: { deal: Deal }) {
  const { data: existing, isLoading } = useDealChecklist(deal.id);
  const save = useSaveChecklist();
  const [steps, setSteps] = useState<StepState>(() => Object.fromEntries(CHECKLIST_STEPS.map((s) => [s.key, 'not_started'])));
  const [handover, setHandover] = useState<PickupOrDelivery>('delivery');
  const [ready, setReady] = useState(false);
  const [comments, setComments] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (isLoading || hydrated) return;
    if (existing) {
      setSteps(Object.fromEntries(CHECKLIST_STEPS.map((s) => [s.key, (existing as any)[s.key] || 'not_started'])));
      setHandover(existing.pickup_or_delivery || 'delivery');
      setReady(!!existing.delivery_ready);
      setComments(existing.comments || '');
    }
    setHydrated(true);
  }, [existing, isLoading, hydrated]);

  const onSave = () => {
    const patch: Partial<DeliveryChecklist> = {
      pickup_or_delivery: handover, delivery_ready: ready, comments: comments || null,
      ...(steps as any),
    };
    save.mutate({ dealId: deal.id, patch });
  };

  if (isLoading && !hydrated) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Handover</span>
        <Select value={handover} onValueChange={(v) => setHandover(v as PickupOrDelivery)}>
          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="delivery">Delivery</SelectItem><SelectItem value="pickup">Pickup</SelectItem></SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border divide-y divide-border">
        {CHECKLIST_STEPS.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="flex items-center gap-2 text-sm">
              <span className={'h-2 w-2 rounded-full ' + STEP_DOT[steps[s.key]]} /> {s.label}
            </span>
            <Select value={steps[s.key]} onValueChange={(v) => setSteps((p) => ({ ...p, [s.key]: v as ChecklistStep }))}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHECKLIST_STEP_OPTIONS.map((o) => <SelectItem key={o} value={o}>{CHECKLIST_STEP_LABEL[o]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className={'w-4 h-4 ' + (ready ? 'text-emerald-400' : 'text-muted-foreground')} /> Delivery ready
        </span>
        <Switch checked={ready} onCheckedChange={setReady} />
      </div>

      <div>
        <label className="text-xs uppercase tracking-wide text-muted-foreground">Comments</label>
        <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} className="mt-1" />
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={save.isPending} className="gap-2">
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save checklist
        </Button>
      </div>
    </div>
  );
}
