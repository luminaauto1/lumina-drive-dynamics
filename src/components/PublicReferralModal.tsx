import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, User, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sanitizePhone = (v: string) => v.replace(/[\s()\-]/g, '').trim();

export const PublicReferralModal = ({ open, onOpenChange }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    referrer_name: '',
    referrer_phone: '',
    referee_name: '',
    referee_phone: '',
    // honeypot
    website: '',
  });
  const [openedAt] = useState(() => Date.now());

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const reset = () =>
    setForm({ referrer_name: '', referrer_phone: '', referee_name: '', referee_phone: '', website: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Honeypot + time-trap (silently succeed to confuse bots)
    if (form.website.trim().length > 0 || Date.now() - openedAt < 1500) {
      onOpenChange(false);
      reset();
      toast.success('Referral submitted successfully. We will track the progress.');
      return;
    }

    const referrer_name = form.referrer_name.trim();
    const referee_name = form.referee_name.trim();
    const referrer_phone = sanitizePhone(form.referrer_phone);
    const referee_phone = sanitizePhone(form.referee_phone);

    if (referrer_name.length < 2 || referee_name.length < 2) {
      toast.error('Please enter both full names.');
      return;
    }
    const digitsR = referrer_phone.replace(/\D/g, '');
    const digitsE = referee_phone.replace(/\D/g, '');
    if (digitsR.length < 6 || digitsE.length < 6) {
      toast.error('Please enter valid mobile numbers.');
      return;
    }
    if (digitsR === digitsE) {
      toast.error("You can't refer your own number.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from('referrals').insert({
        referrer_name,
        referrer_phone,
        referrer_email: null,
        referee_name,
        referee_phone,
        referee_email: null,
        notes: null,
        status: 'Pending',
      });
      if (error) throw error;

      // Isolated referral WhatsApp notification (fire-and-forget)
      try {
        await supabase.functions.invoke('notify-referral', {
          body: { phone_number: referee_phone, client_name: referee_name },
        });
      } catch (notifyErr) {
        console.warn('notify-referral failed (non-fatal):', notifyErr);
      }

      onOpenChange(false);
      reset();
      toast.success('Referral submitted successfully. We will track the progress.');
    } catch (err: any) {
      console.error(err);
      toast.error('Could not submit referral. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border border-zinc-800 text-zinc-100">
        <DialogHeader className="space-y-2">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            <Sparkles className="h-3 w-3" /> Lumina Money Maker
          </div>
          <DialogTitle className="text-2xl font-light tracking-tight text-zinc-50">
            Refer &amp; Earn
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            Know someone shopping for a vehicle? Send them our way — earn when the deal closes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Honeypot — hidden from real users */}
          <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor="referral-website">Website</label>
            <input
              id="referral-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={update('website')}
            />
          </div>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
              <User className="h-3.5 w-3.5" /> Your Details
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-name" className="text-xs text-zinc-400">Full Name</Label>
              <Input
                id="ref-name"
                required
                maxLength={120}
                value={form.referrer_name}
                onChange={update('referrer_name')}
                placeholder="Your full name"
                className="bg-black border-zinc-800 focus-visible:ring-zinc-600 text-zinc-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-phone" className="text-xs text-zinc-400">Mobile Number</Label>
              <Input
                id="ref-phone"
                required
                inputMode="tel"
                maxLength={20}
                value={form.referrer_phone}
                onChange={update('referrer_phone')}
                placeholder="e.g. 068 601 7462"
                className="bg-black border-zinc-800 focus-visible:ring-zinc-600 text-zinc-100"
              />
            </div>
          </section>

          <div className="h-px bg-zinc-800/80" />

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
              <UserPlus className="h-3.5 w-3.5" /> Who Are You Referring?
            </div>
            <div className="space-y-2">
              <Label htmlFor="referee-name" className="text-xs text-zinc-400">Their Full Name</Label>
              <Input
                id="referee-name"
                required
                maxLength={120}
                value={form.referee_name}
                onChange={update('referee_name')}
                placeholder="Their full name"
                className="bg-black border-zinc-800 focus-visible:ring-zinc-600 text-zinc-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referee-phone" className="text-xs text-zinc-400">Their Mobile Number</Label>
              <Input
                id="referee-phone"
                required
                inputMode="tel"
                maxLength={20}
                value={form.referee_phone}
                onChange={update('referee_phone')}
                placeholder="e.g. 082 123 4567"
                className="bg-black border-zinc-800 focus-visible:ring-zinc-600 text-zinc-100"
              />
            </div>
          </section>

          <p className="text-[11px] leading-relaxed text-zinc-600">
            By submitting, you confirm you have permission to share these contact details.
          </p>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 bg-zinc-100 text-black hover:bg-white font-medium"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
              </>
            ) : (
              'Submit Referral'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PublicReferralModal;
