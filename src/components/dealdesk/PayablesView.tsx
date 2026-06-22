import { useState } from 'react';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PayeeType } from '@/lib/dealdesk/types';
import { EXPENSE_REASON_LABEL } from '@/lib/dealdesk/types';
import { formatRand, formatDate } from '@/lib/dealdesk/format';
import { usePayees, useSavePayee, useExpenses, useSaveExpense, useDeleteExpense } from '@/hooks/dealdesk/useDealDesk';

export function PayablesView() {
  const { data: payees = [] } = usePayees();
  const savePayee = useSavePayee();
  const { data: expenses = [], isLoading } = useExpenses(null);
  const saveExpense = useSaveExpense();
  const delExpense = useDeleteExpense();
  const [name, setName] = useState('');
  const [type, setType] = useState<PayeeType>('other');
  const [phone, setPhone] = useState('');
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);

  const addPayee = () => {
    if (!name.trim()) return;
    savePayee.mutate({ name: name.trim(), type, phone: phone || null, active: true });
    setName(''); setPhone(''); setType('other');
  };

  const rows = onlyUnpaid ? expenses.filter((e) => !e.paid) : expenses;
  const total = rows.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const payeeName = (id: string | null) => (id ? payees.find((p) => p.id === id)?.name : null) || '—';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Payees */}
      <Card className="lg:col-span-1">
        <CardHeader className="py-3"><CardTitle className="text-base">Payees</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
            <div className="flex gap-2">
              <Select value={type} onValueChange={(v) => setType(v as PayeeType)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="spotter">Spotter</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
              </Select>
              <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8" />
            </div>
            <Button onClick={addPayee} disabled={savePayee.isPending} size="sm" className="w-full gap-1">
              {savePayee.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add payee
            </Button>
          </div>
          <div className="divide-y divide-border">
            {payees.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-1.5 text-sm">
                <span className={p.active ? '' : 'text-muted-foreground line-through'}>{p.name}<span className="ml-1 text-xs text-muted-foreground">({p.type})</span></span>
                <Switch checked={p.active} onCheckedChange={(v) => savePayee.mutate({ ...p, active: v })} />
              </div>
            ))}
            {payees.length === 0 && <p className="py-2 text-xs text-muted-foreground">No payees yet.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Expense ledger (all deals) */}
      <Card className="lg:col-span-2">
        <CardHeader className="py-3 flex-row items-center justify-between">
          <CardTitle className="text-base">All payables <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">{formatRand(total)}</span></CardTitle>
          <label className="flex items-center gap-2 text-xs"><Switch checked={onlyUnpaid} onCheckedChange={setOnlyUnpaid} /> Unpaid only</label>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="py-6 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
            : rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No payables.</p>
            : (
              <div className="divide-y divide-border">
                {rows.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-1 py-2 text-sm">
                    <span className="w-24 tabular-nums">{formatRand(e.amount)}</span>
                    <span className="flex-1">{EXPENSE_REASON_LABEL[e.reason]} · {payeeName(e.payee_id)}{e.comments ? ` · ${e.comments}` : ''}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(e.expense_date)}</span>
                    <label className="flex items-center gap-1 text-xs"><Switch checked={e.paid} onCheckedChange={(v) => saveExpense.mutate({ ...e, paid: v })} /> Paid</label>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => delExpense.mutate(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
          <p className="mt-3 text-[11px] text-muted-foreground">Payables tracker only — these figures never affect any deal's recorded profit or the Accounting &amp; VAT totals.</p>
        </CardContent>
      </Card>
    </div>
  );
}
