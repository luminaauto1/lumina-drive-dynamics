import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateReferral } from '@/hooks/useReferrals';
import { Gift } from 'lucide-react';

interface LogReferralModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Optional prefill for the referee side (e.g. when opened from a deal/handover). */
  defaultReferee?: { name?: string; phone?: string; email?: string };
}

export const LogReferralModal = ({ open, onOpenChange, defaultReferee }: LogReferralModalProps) => {
  const create = useCreateReferral();
  const [form, setForm] = useState({
    referrer_name: '',
    referrer_phone: '',
    referrer_email: '',
    referee_name: defaultReferee?.name || '',
    referee_phone: defaultReferee?.phone || '',
    referee_email: defaultReferee?.email || '',
    notes: '',
  });

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid =
    form.referrer_name.trim() &&
    form.referrer_phone.trim() &&
    form.referee_name.trim() &&
    form.referee_phone.trim();

  const submit = async () => {
    if (!valid) return;
    await create.mutateAsync({
      referrer_name: form.referrer_name,
      referrer_phone: form.referrer_phone,
      referrer_email: form.referrer_email || null,
      referee_name: form.referee_name,
      referee_phone: form.referee_phone,
      referee_email: form.referee_email || null,
      notes: form.notes || null,
    });
    onOpenChange(false);
    setForm({
      referrer_name: '',
      referrer_phone: '',
      referrer_email: '',
      referee_name: defaultReferee?.name || '',
      referee_phone: defaultReferee?.phone || '',
      referee_email: defaultReferee?.email || '',
      notes: '',
    });
  };

  const fieldCls = 'bg-black/40 border-zinc-800 text-zinc-200 focus:border-zinc-600';
  const sectionCls = 'space-y-3 p-4 rounded-md border border-zinc-800 bg-zinc-900/40';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-200 max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Gift className="h-4 w-4 text-emerald-400" />
            Log New Referral
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className={sectionCls}>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Referrer (who is owed)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-zinc-400">Name</Label>
                <Input className={fieldCls} value={form.referrer_name} onChange={update('referrer_name')} />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Phone</Label>
                <Input className={fieldCls} value={form.referrer_phone} onChange={update('referrer_phone')} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-zinc-400">Email (optional)</Label>
                <Input className={fieldCls} value={form.referrer_email} onChange={update('referrer_email')} />
              </div>
            </div>
          </div>

          <div className={sectionCls}>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Referee (potential buyer)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-zinc-400">Name</Label>
                <Input className={fieldCls} value={form.referee_name} onChange={update('referee_name')} />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Phone</Label>
                <Input className={fieldCls} value={form.referee_phone} onChange={update('referee_phone')} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-zinc-400">Email (optional)</Label>
                <Input className={fieldCls} value={form.referee_email} onChange={update('referee_email')} />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs text-zinc-400">Notes (optional)</Label>
            <Textarea className={fieldCls} rows={2} value={form.notes} onChange={update('notes')} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-zinc-400">
            Cancel
          </Button>
          <Button
            disabled={!valid || create.isPending}
            onClick={submit}
            className="bg-emerald-600 hover:bg-emerald-500 text-black"
          >
            {create.isPending ? 'Saving…' : 'Log Referral'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LogReferralModal;
