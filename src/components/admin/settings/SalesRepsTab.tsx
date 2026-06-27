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
      <div className="flex items-center gap-3 mb-1">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Sales Representatives</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Reps and their commission percentages — used when finalizing a deal. Changes save instantly.
      </p>

      <div className="flex items-end gap-4 p-4 bg-muted/30 rounded-lg">
        <div className="flex-1 space-y-2">
          <Label>Rep Name</Label>
          <Input placeholder="John Doe" value={newRepName} onChange={(e) => setNewRepName(e.target.value)} />
        </div>
        <div className="w-32 space-y-2">
          <Label>Commission (%)</Label>
          <Input
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
        <p className="text-center text-muted-foreground py-8">No sales representatives added yet.</p>
      ) : (
        <div className="space-y-2">
          {reps.map((rep, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
                  {rep.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium">{rep.name}</span>
                <span className="text-sm text-muted-foreground">({rep.commission}%)</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeRep(index)} className="text-destructive hover:text-destructive">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
