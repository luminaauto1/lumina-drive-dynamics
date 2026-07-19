import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Landmark, Loader2, Plus, X, Save, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  useDocumentSettings, useUpdateDocumentSettings, DEFAULT_DOCUMENT_SETTINGS, DEFAULT_BANK_BRANCHES,
} from '@/hooks/useDocumentSettings';

interface Row { bank: string; branchName: string; branchCode: string }

const BankBranchCodesTab = () => {
  const { data, isLoading } = useDocumentSettings();
  const update = useUpdateDocumentSettings();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (data) setRows((data.bankBranches?.length ? data.bankBranches : DEFAULT_BANK_BRANCHES).map((r) => ({ ...r })));
  }, [data]);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, { bank: '', branchName: '', branchCode: '' }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const save = () => {
    const cleaned = rows
      .map((r) => ({ bank: r.bank.trim(), branchName: r.branchName.trim(), branchCode: r.branchCode.trim() }))
      .filter((r) => r.bank);
    update.mutate({ ...(data ?? DEFAULT_DOCUMENT_SETTINGS), bankBranches: cleaned });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-6 space-y-5"
    >
      <div className="flex items-start gap-2">
        <Landmark className="mt-0.5 w-4 h-4 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          Branch name &amp; code printed on the finance application PDF, matched to the client's bank.
          Pre-filled with South African universal branch codes — edit to suit.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : (
        <div className="space-y-3">
          <div className="hidden md:grid grid-cols-[1.2fr_1.5fr_1fr_auto] gap-3 px-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>Bank</span><span>Branch name</span><span>Branch code</span><span></span>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-[1.2fr_1.5fr_1fr_auto] gap-2 md:gap-3 items-center">
              <Input value={r.bank} onChange={(e) => setRow(i, { bank: e.target.value })} placeholder="FNB" />
              <Input value={r.branchName} onChange={(e) => setRow(i, { branchName: e.target.value })} placeholder="Universal Branch" />
              <Input value={r.branchCode} onChange={(e) => setRow(i, { branchCode: e.target.value })} placeholder="250655" className="font-mono" />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(i)} className="text-destructive hover:text-destructive justify-self-start md:justify-self-center" aria-label="Remove">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="w-4 h-4 mr-1" /> Add bank
              </Button>
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground"
                onClick={() => setRows(DEFAULT_BANK_BRANCHES.map((r) => ({ ...r })))}>
                <RotateCcw className="w-4 h-4 mr-1" /> Reset to SA defaults
              </Button>
            </div>
            <Button type="button" onClick={save} disabled={update.isPending}>
              {update.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save branch codes
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Matching ignores case &amp; spacing, so "fnb", "FNB" and "Standard Bank"/"standard_bank" all resolve correctly.
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default BankBranchCodesTab;
