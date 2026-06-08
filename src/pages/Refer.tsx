import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, UserPlus, Coins, ShieldCheck, Sparkles } from 'lucide-react';
import moneyMakerIcon from '@/assets/money-maker.png.asset.json';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import SEO from '@/components/seo/SEO';

const sanitizePhone = (v: string) => v.replace(/[\s()\-]/g, '').trim();

const Refer = () => {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    referrer_name: '',
    referrer_phone: '',
    referee_name: '',
    referee_phone: '',
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

    if (form.website.trim().length > 0 || Date.now() - openedAt < 1500) {
      setSubmitted(true);
      reset();
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

      try {
        await supabase.functions.invoke('notify-referral', {
          body: { phone_number: referee_phone, client_name: referee_name },
        });
      } catch (notifyErr) {
        console.warn('notify-referral failed (non-fatal):', notifyErr);
      }

      setSubmitted(true);
      reset();
      toast.success('Referral submitted. We will track the progress.');
    } catch (err: any) {
      console.error(err);
      toast.error('Could not submit referral. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEO
        title="Money Maker — Refer & Earn | Lumina Auto"
        description="Refer someone shopping for a vehicle to Lumina Auto and earn a referral fee when the deal closes."
        canonical="/refer"
      />
      <div className="min-h-screen bg-background text-foreground pt-28 pb-20">
        <div className="container mx-auto px-6 max-w-6xl">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-zinc-700/80 bg-zinc-950/70 text-[10px] uppercase tracking-[0.25em] text-zinc-400 mb-6">
              <img src={moneyMakerIcon.url} alt="" className="h-3 w-3 object-contain invert" />
              Lumina Money Maker
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-light tracking-tight mb-6">
              Refer. Relax.
              <br />
              <span className="italic font-extralight text-muted-foreground">Get Paid.</span>
            </h1>
            <p className="max-w-2xl mx-auto text-base md:text-lg text-muted-foreground leading-relaxed">
              Know someone shopping for a vehicle? Send them our way. When their deal closes, you earn —
              no signup, no app, no catch.
            </p>
          </motion.div>

          {/* Value props */}
          <div className="grid md:grid-cols-3 gap-4 mb-16">
            {[
              { icon: UserPlus, title: 'Submit a name', body: 'Drop their details below. Takes 30 seconds.' },
              { icon: ShieldCheck, title: 'We handle it', body: 'Our team reaches out, qualifies, and closes.' },
              { icon: Coins, title: 'You get paid', body: 'When their deal finalizes, we settle your fee.' },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * i }}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-6"
              >
                <step.icon className="h-5 w-5 text-zinc-400 mb-4" />
                <h3 className="text-sm uppercase tracking-wider text-zinc-200 mb-2">{step.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{step.body}</p>
              </motion.div>
            ))}
          </div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-xl mx-auto rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 md:p-10 shadow-[0_20px_80px_-30px_rgba(255,255,255,0.1)]"
          >
            {submitted ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 mb-5">
                  <Sparkles className="h-6 w-6 text-zinc-200" />
                </div>
                <h2 className="text-2xl font-light tracking-tight mb-3">Referral received.</h2>
                <p className="text-sm text-zinc-500 mb-6">
                  We'll reach out to your contact shortly. You'll be notified the moment the deal closes.
                </p>
                <Button
                  onClick={() => setSubmitted(false)}
                  variant="outline"
                  className="border-zinc-700 hover:bg-zinc-900"
                >
                  Refer Another
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
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
                  className="w-full h-12 bg-zinc-100 text-black hover:bg-white font-medium"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting…
                    </>
                  ) : (
                    'Submit Referral'
                  )}
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Refer;
