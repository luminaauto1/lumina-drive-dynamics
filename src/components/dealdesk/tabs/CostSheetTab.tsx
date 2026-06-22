import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Save, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Deal, AccessoryLine, FniLine } from '@/lib/dealdesk/types';
import {
  computeCostSheet, blankCostSheetInput, accessoryProfit, fniProfit,
  type CostSheetInput,
} from '@/lib/dealdesk/costsheet';
import { formatRand, parseMoney } from '@/lib/dealdesk/format';
import { useDealCostsheet, useSaveCostsheet } from '@/hooks/dealdesk/useDealDesk';

// Inline editable Rand cell. Holds raw text while focused; parses to number on change.
function Money({ value, onChange, className = '' }: { value: number; onChange: (n: number) => void; className?: string }) {
  const [text, setText] = useState<string>(value ? String(value) : '');
  useEffect(() => { setText(value ? String(value) : ''); }, [value]);
  return (
    <Input
      inputMode="decimal"
      value={text}
      onChange={(e) => { setText(e.target.value); onChange(parseMoney(e.target.value)); }}
      onBlur={() => setText(value ? String(value) : '')}
      className={'h-8 text-right tabular-nums ' + className}
      placeholder="0"
    />
  );
}

function NumRow({ label, value, onChange, hint }: { label: string; value: number; onChange: (n: number) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-muted-foreground">{label}{hint && <span className="ml-1 text-[10px] text-amber-400">{hint}</span>}</span>
      <div className="w-40"><Money value={value} onChange={onChange} /></div>
    </div>
  );
}

export function CostSheetTab({ deal }: { deal: Deal }) {
  const { data: existing, isLoading } = useDealCostsheet(deal.id);
  const save = useSaveCostsheet();
  const [input, setInput] = useState<CostSheetInput>(() => blankCostSheetInput());
  const [hydrated, setHydrated] = useState(false);

  // Seed blank by default (verdict #6 — do NOT prefill from the ledger, since this
  // sheet is analytical and must never look like it writes back). Hydrate from the
  // saved row if one exists.
  useEffect(() => {
    if (isLoading || hydrated) return;
    if (existing) {
      setInput({
        retail: Number(existing.retail) || 0, spotter: Number(existing.spotter) || 0,
        delivery: Number(existing.delivery) || 0, over_allowance: Number(existing.over_allowance) || 0,
        vehicle_cost: Number(existing.vehicle_cost) || 0, recon: Number(existing.recon) || 0,
        fleet_1pct: Number(existing.fleet_1pct) || 0, c4c: Number(existing.c4c) || 0,
        accessories: Array.isArray(existing.accessories) ? existing.accessories : [],
        fni: Array.isArray(existing.fni) ? existing.fni : [],
      });
    }
    setHydrated(true);
  }, [existing, isLoading, hydrated]);

  const computed = useMemo(() => computeCostSheet(input), [input]);

  const set = (patch: Partial<CostSheetInput>) => setInput((prev) => ({ ...prev, ...patch }));
  const setAcc = (i: number, patch: Partial<AccessoryLine>) =>
    setInput((p) => ({ ...p, accessories: p.accessories.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
  const setFni = (i: number, patch: Partial<FniLine>) =>
    setInput((p) => ({ ...p, fni: p.fni.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));

  if (isLoading && !hydrated) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        This cost sheet is <strong>analytical</strong> — it does not change the deal's recorded profit (set in Finalize Deal).
        The deal's ledger gross profit is <strong>{formatRand(deal.gross_profit)}</strong>.
      </div>

      {/* Vehicle GP block */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">Vehicle GP</CardTitle></CardHeader>
        <CardContent className="space-y-0.5">
          <NumRow label="Retail" value={input.retail} onChange={(n) => set({ retail: n })} />
          <NumRow label="Spotter" value={input.spotter} onChange={(n) => set({ spotter: n })} />
          <NumRow label="Delivery" value={input.delivery} onChange={(n) => set({ delivery: n })} />
          <NumRow label="Over-allowance" value={input.over_allowance} onChange={(n) => set({ over_allowance: n })} />
          <div className="flex items-center justify-between py-1 border-t border-border mt-1">
            <span className="text-sm font-medium">Sub Total</span>
            <span className="w-40 text-right tabular-nums font-medium">{formatRand(computed.sub_total)}</span>
          </div>
          <NumRow label="Vehicle cost" value={input.vehicle_cost} onChange={(n) => set({ vehicle_cost: n })} />
          <NumRow label="Recon" value={input.recon} onChange={(n) => set({ recon: n })} />
          <NumRow label="C4C" value={input.c4c} onChange={(n) => set({ c4c: n })} />
          <NumRow label="1% fleet" value={input.fleet_1pct} onChange={(n) => set({ fleet_1pct: n })} hint="(shown, not summed)" />
          <div className="flex items-center justify-between py-1 border-t border-border mt-1">
            <span className="text-sm font-semibold">Vehicle GP</span>
            <span className="w-40 text-right tabular-nums font-semibold text-emerald-400">{formatRand(computed.vehicle_gp)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Accessories */}
      <Card>
        <CardHeader className="py-3 flex-row items-center justify-between">
          <CardTitle className="text-base">Accessories</CardTitle>
          <Button size="sm" variant="outline" className="h-7 gap-1"
            onClick={() => set({ accessories: [...input.accessories, { detail: '', supplier: '', retail: 0, cost: 0 }] })}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted-foreground">
              <tr><th className="text-left py-1">Detail</th><th className="text-left">Supplier</th><th className="text-right">Retail</th><th className="text-right">Cost</th><th className="text-right">Profit</th><th /></tr>
            </thead>
            <tbody>
              {input.accessories.map((l, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1 pr-2"><Input value={l.detail} onChange={(e) => setAcc(i, { detail: e.target.value })} className="h-8" /></td>
                  <td className="pr-2"><Input value={l.supplier} onChange={(e) => setAcc(i, { supplier: e.target.value })} className="h-8" /></td>
                  <td className="w-28"><Money value={l.retail} onChange={(n) => setAcc(i, { retail: n })} /></td>
                  <td className="w-28"><Money value={l.cost} onChange={(n) => setAcc(i, { cost: n })} /></td>
                  <td className="w-28 text-right tabular-nums pr-2">{formatRand(accessoryProfit(l))}</td>
                  <td><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => set({ accessories: input.accessories.filter((_, idx) => idx !== i) })}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end pt-2 text-sm font-medium">Accessories Total:&nbsp;<span className="tabular-nums">{formatRand(computed.accessories_total)}</span></div>
        </CardContent>
      </Card>

      {/* F&I */}
      <Card>
        <CardHeader className="py-3 flex-row items-center justify-between">
          <CardTitle className="text-base">F&amp;I</CardTitle>
          <Button size="sm" variant="outline" className="h-7 gap-1"
            onClick={() => set({ fni: [...input.fni, { detail: '', retail: 0, cost: 0, profit_override: null }] })}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted-foreground">
              <tr><th className="text-left py-1">Detail</th><th className="text-right">Retail</th><th className="text-right">Cost</th><th className="text-right">Profit override</th><th className="text-right">Profit</th><th /></tr>
            </thead>
            <tbody>
              {input.fni.map((l, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1 pr-2"><Input value={l.detail} onChange={(e) => setFni(i, { detail: e.target.value })} className="h-8" /></td>
                  <td className="w-28"><Money value={l.retail} onChange={(n) => setFni(i, { retail: n })} /></td>
                  <td className="w-28"><Money value={l.cost} onChange={(n) => setFni(i, { cost: n })} /></td>
                  <td className="w-32"><Money value={l.profit_override ?? 0} onChange={(n) => setFni(i, { profit_override: n || null })} /></td>
                  <td className="w-28 text-right tabular-nums pr-2">{formatRand(fniProfit(l))}</td>
                  <td><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => set({ fni: input.fni.filter((_, idx) => idx !== i) })}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end pt-2 text-sm font-medium">F&amp;I Total:&nbsp;<span className="tabular-nums">{formatRand(computed.fni_total)}</span></div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="py-4 space-y-1">
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Total</span><span className="tabular-nums">{formatRand(computed.total)}</span></div>
          <div className="flex items-center justify-between text-lg font-bold border-t border-border pt-2">
            <span>Correct Total</span><span className="tabular-nums text-emerald-400">{formatRand(computed.correct_total)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate({ dealId: deal.id, input, computed })} disabled={save.isPending} className="gap-2">
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save cost sheet
        </Button>
      </div>
    </div>
  );
}
