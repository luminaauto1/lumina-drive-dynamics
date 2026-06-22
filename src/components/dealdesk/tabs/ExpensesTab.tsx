import { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Deal, ExpenseReason } from '@/lib/dealdesk/types';
import { EXPENSE_REASON_LABEL, EXPENSE_REASON_OPTIONS } from '@/lib/dealdesk/types';
import { formatRand, formatDate, parseMoney } from '@/lib/dealdesk/format';
import { useExpenses, usePayees, useSaveExpense, useDeleteExpense } from '@/hooks/dealdesk/useDealDesk';

export function ExpensesTab({ deal }: { deal: Deal }) {
  const { data: expenses = [], isLoading } = useExpenses(deal.id);
  const { data: payees = [] } = usePayees();
  const saveExpense = useSaveExpense();
  const delExpense = useDeleteExpense();

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<ExpenseReason>('other');
  const [payeeId, setPayeeId] = useState<string>('none');
  const [date, setDate] = useState('');
  const [comments, setComments] = useState('');

  const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const unpaid = expenses.filter((e) => !e.paid).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const add = () => {
    const amt = parseMoney(amount);
    if (!amt) return;
    saveExpense.mutate({
      deal_id: deal.id, amount: amt, reason, payee_id: payeeId === 'none' ? null : payeeId,
      expense_date: date || null, vin: deal.vehicle_vin, comments: comments || null, paid: false,
    });
    setAmount(''); setComments(''); setDate(''); setReason('other'); setPayeeId('none');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">Total <strong className="text-foreground tabular-nums">{formatRand(total)}</strong></span>
        <span className="text-muted-foreground">Unpaid <strong className="text-amber-400 tabular-nums">{formatRand(unpaid)}</strong></span>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">Payables tracker — does not affect the deal's recorded profit.</p>

      {/* Add row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-lg border border-border p-3">
        <Input placeholder="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8" />
        <Select value={reason} onValueChange={(v) => setReason(v as ExpenseReason)}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>{EXPENSE_REASON_OPTIONS.map((r) => <SelectItem key={r} value={r}>{EXPENSE_REASON_LABEL[r]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={payeeId} onValueChange={setPayeeId}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Payee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No payee</SelectItem>
            {payees.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8" />
        <Button onClick={add} disabled={saveExpense.isPending} className="h-8 gap-1">
          {saveExpense.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
        </Button>
        <Input placeholder="Comments" value={comments} onChange={(e) => setComments(e.target.value)} className="h-8 col-span-2 md:col-span-5" />
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : expenses.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No expenses logged for this deal.</p>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-24 tabular-nums">{formatRand(e.amount)}</span>
              <span className="flex-1">{EXPENSE_REASON_LABEL[e.reason]}{e.comments ? ` · ${e.comments}` : ''}</span>
              <span className="text-xs text-muted-foreground">{formatDate(e.expense_date)}</span>
              <span className="flex items-center gap-1.5 text-xs">
                <Switch checked={e.paid} onCheckedChange={(v) => saveExpense.mutate({ ...e, paid: v })} /> Paid
              </span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => delExpense.mutate(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
