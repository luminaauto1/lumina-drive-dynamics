import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Loader2, Plus, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUpdateSiteSettings, SiteSettings } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SalesRep {
  name: string;
  commission: number;
}

/**
 * Sales-rep manager (self-saving). Reads `sales_reps` DIRECTLY from
 * `site_settings` because the public view stripped it out (which made the list
 * appear to vanish after a save). Each add/remove persists immediately.
 */
export const SalesRepsTab = ({
  settings,
  updateSettings,
}: {
  settings: SiteSettings | undefined;
  updateSettings: ReturnType<typeof useUpdateSiteSettings>;
}) => {
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [newRepName, setNewRepName] = useState('');
  const [newRepCommission, setNewRepCommission] = useState(5);
  const [loadingReps, setLoadingReps] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadReps = async () => {
    setLoadingReps(true);
    const { data, error } = await supabase
      .from('site_settings')
      .select('sales_reps')
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('Failed to load sales reps:', error);
      toast.error(`Failed to load sales reps: ${error.message}`);
    } else {
      setReps(((data as any)?.sales_reps as SalesRep[]) || []);
    }
    setLoadingReps(false);
  };

  useEffect(() => {
    loadReps();
  }, []);

  const persistReps = async (updatedReps: SalesRep[], previous: SalesRep[]) => {
    setSaving(true);
    setReps(updatedReps); // optimistic
    try {
      await updateSettings.mutateAsync({ sales_reps: updatedReps } as any);
      await loadReps(); // re-read source of truth
    } catch (err: any) {
      console.error('Sales reps save failed:', err);
      toast.error(err?.message || 'Failed to save sales reps');
      setReps(previous); // rollback
    } finally {
      setSaving(false);
    }
  };

  const addRep = () => {
    if (!newRepName.trim()) return;
    const updatedReps = [...reps, { name: newRepName.trim(), commission: newRepCommission }];
    const previous = reps;
    setNewRepName('');
    setNewRepCommission(5);
    persistReps(updatedReps, previous);
  };

  const removeRep = (index: number) => {
    const previous = reps;
    const updatedReps = reps.filter((_, i) => i !== index);
    persistReps(updatedReps, previous);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6 space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sales representatives</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Reps and their commission percentages — used when finalizing a deal. Changes save instantly.
        </p>
      </div>

      {/* Add form — stacks on phones, single aligned row from sm up. */}
      <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="new-rep-name">Rep Name</Label>
          <Input id="new-rep-name" placeholder="John Doe" value={newRepName} onChange={(e) => setNewRepName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-rep-commission">Commission (%)</Label>
          <Input
            id="new-rep-commission"
            type="number"
            value={newRepCommission}
            onChange={(e) => setNewRepCommission(parseFloat(e.target.value) || 0)}
            min={0}
            max={100}
            step={0.5}
          />
        </div>
        <Button onClick={addRep} disabled={saving || !newRepName.trim()} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add
        </Button>
      </div>

      {loadingReps ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : reps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No sales representatives added yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Add your first rep above — they'll appear when finalizing a deal.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reps.map((rep, index) => (
            <div
              key={index}
              className="grid grid-cols-[2rem_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg border border-border bg-muted/20 p-3"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 font-medium text-primary">
                {rep.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate font-medium">{rep.name}</span>
              <span className="text-sm tabular-nums text-muted-foreground">{rep.commission}%</span>
              <Button variant="ghost" size="icon" onClick={() => removeRep(index)} aria-label={`Remove ${rep.name}`} className="text-destructive hover:text-destructive">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
