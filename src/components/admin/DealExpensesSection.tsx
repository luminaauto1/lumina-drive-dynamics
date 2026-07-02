// Deal Expenses — a mirror of the vehicle (recon) expenses tab, but for the DEAL.
// Expenses added here attach to the deal via its application_id and roll up together
// with the linked car's vehicle_expenses into the deal's total cost / gross_profit.
// Mounted in the Deal Room (during the deal) and the Deal Ledger (after finalize).
import { useState, useCallback } from 'react';
import { Plus, Trash2, Receipt, Fuel, MapPin, Package, Wrench, CarFront, Scissors, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { formatPrice } from '@/hooks/useVehicles';
import { useDealExpenses, useCreateDealExpense, useDeleteDealExpense, EXPENSE_CATEGORIES } from '@/hooks/useDealExpenses';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  fuel: Fuel, toll: MapPin, parts: Package, labor: Wrench, transport: CarFront, cleaning: Scissors, general: Receipt,
};

interface Props {
  applicationId: string;
  dealId?: string | null;
  /** Compact heading; omit to render just the controls. */
  title?: string;
}

export function DealExpensesSection({ applicationId, dealId = null, title = 'Deal Expenses' }: Props) {
  const { data: expenses = [] } = useDealExpenses(applicationId);
  const createExpense = useCreateDealExpense();
  const deleteExpense = useDeleteDealExpense();

  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newExpense, setNewExpense] = useState<{ description: string; amount: number; category: string; date_incurred: string; receipt_url: string | null }>({
    description: '', amount: 0, category: 'general', date_incurred: new Date().toISOString().split('T')[0], receipt_url: null,
  });

  const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const handleReceiptUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const ext = compressed.name.split('.').pop();
      const filePath = `receipts/deal/${applicationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('vehicle-images')
        .upload(filePath, compressed, { contentType: compressed.type, cacheControl: '3600' });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('vehicle-images').getPublicUrl(filePath);
      setNewExpense((p) => ({ ...p, receipt_url: publicUrl }));
    } catch (err) {
      console.error('receipt upload failed', err);
    } finally {
      setUploading(false);
    }
  }, [applicationId]);

  const handleAdd = async () => {
    if (!newExpense.description.trim() || newExpense.amount <= 0) return;
    await createExpense.mutateAsync({
      application_id: applicationId,
      deal_id: dealId,
      description: newExpense.description.trim(),
      amount: newExpense.amount,
      category: newExpense.category,
      date_incurred: newExpense.date_incurred,
      receipt_url: newExpense.receipt_url,
    });
    setNewExpense({ description: '', amount: 0, category: 'general', date_incurred: new Date().toISOString().split('T')[0], receipt_url: null });
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold">{title}</span>
          {expenses.length > 0 && (
            <span className="text-xs text-muted-foreground">({expenses.length}) — <span className="text-sky-400 font-medium">{formatPrice(total)}</span></span>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5"><Plus className="w-4 h-4" /> Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Deal Expense</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="e.g., Fuel to collect the vehicle for the client"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (R)</Label>
                  <Input type="number" placeholder="0" value={newExpense.amount || ''}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={newExpense.category} onValueChange={(v) => setNewExpense({ ...newExpense, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={newExpense.date_incurred}
                  onChange={(e) => setNewExpense({ ...newExpense, date_incurred: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Receipt Photo (optional)</Label>
                <div className="flex gap-2">
                  <Input type="file" accept="image/*" onChange={handleReceiptUpload} disabled={uploading} className="flex-1" />
                  {newExpense.receipt_url && (
                    <div className="w-12 h-10 rounded overflow-hidden border">
                      <img src={newExpense.receipt_url} alt="Receipt" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleAdd} disabled={!newExpense.description.trim() || newExpense.amount <= 0 || createExpense.isPending}>
                Add Expense
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {expenses.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground border border-dashed border-border rounded-lg">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No deal expenses yet</p>
            <p className="text-xs">Costs incurred for this deal (not tied to the car itself)</p>
          </div>
        ) : (
          expenses.map((exp) => {
            const Icon = CATEGORY_ICONS[exp.category] || Receipt;
            const catLabel = EXPENSE_CATEGORIES.find((c) => c.value === exp.category)?.label || 'General';
            return (
              <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-sky-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{exp.description}</p>
                    <p className="text-xs text-muted-foreground">{catLabel} • {new Date(exp.date_incurred).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {exp.receipt_url && (
                    <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" title="View receipt">
                      <Image className="w-4 h-4" />
                    </a>
                  )}
                  <span className="font-medium text-sky-400">{formatPrice(exp.amount)}</span>
                  <Button variant="ghost" size="icon" onClick={() => deleteExpense.mutate(exp.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
