import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Phone, Loader2, MapPin, CreditCard, Target, TestTube } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useSiteSettings, useUpdateSiteSettings, SiteSettings } from '@/hooks/useSiteSettings';
import { SalesRepsTab } from './SalesRepsTab';
import { TestEmailButton } from './TestEmailButton';

/**
 * Form-bound settings bodies.
 *
 * Previously these five panels (Finance / Sales / Contact / Location / Features)
 * shared ONE react-hook-form + a single global "Save All Settings" bar on the
 * tabbed AdminSettings page. Now that each setting is its own route, each panel
 * owns a self-contained form scoped to just its own fields, with its own Save
 * button — so saving Finance never silently writes Contact's fields and vice
 * versa. They all read/write the same `site_settings` row via the shared hooks.
 */

type SettingsFormData = Omit<SiteSettings, 'id' | 'created_at' | 'updated_at'> & { tiktok_url: string };

// Shared save row so every form body saves the same way: a bordered footer with
// the action right-aligned (full-width on phones where a right-hugging button is
// awkward to reach).
const SaveBar = ({ pending }: { pending: boolean }) => (
  <div className="mt-6 flex justify-end border-t border-border pt-4">
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Saving...
        </>
      ) : (
        'Save changes'
      )}
    </Button>
  </div>
);

// Shared section label — same treatment across every settings body.
const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
);

// Shared row for a labelled switch, so the toggle rows line up everywhere.
const ToggleRow = ({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: ReactNode;
  hint: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
    <div className="min-w-0 space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5 shrink-0" />
  </div>
);

const Loading = () => (
  <div className="flex items-center justify-center h-48">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

// STRICT numeric conversion (prevents "Failed to save" string-vs-number errors).
const toNum = (v: any) => Number(v);

/* ------------------------------------------------------------------ Finance */

export const FinanceBody = () => {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const { register, handleSubmit, reset } = useForm<SettingsFormData>();

  useEffect(() => {
    if (settings) {
      reset({
        default_interest_rate: settings.default_interest_rate ?? 13.25,
        min_interest: settings.min_interest ?? 10.5,
        max_interest: settings.max_interest ?? 25.0,
        min_deposit_percent: settings.min_deposit_percent ?? 0,
        min_balloon_percent: settings.min_balloon_percent,
        max_balloon_percent: settings.max_balloon_percent,
        default_balloon_percent: settings.default_balloon_percent ?? 35,
      } as SettingsFormData);
    }
  }, [settings, reset]);

  const onSubmit = (data: SettingsFormData) => {
    updateSettings.mutate({
      default_interest_rate: toNum(data.default_interest_rate),
      min_interest: toNum(data.min_interest),
      max_interest: toNum(data.max_interest),
      min_deposit_percent: toNum(data.min_deposit_percent),
      min_balloon_percent: toNum(data.min_balloon_percent),
      max_balloon_percent: toNum(data.max_balloon_percent),
      default_balloon_percent: toNum(data.default_balloon_percent),
    } as Partial<SiteSettings>);
  };

  if (isLoading) return <Loading />;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-xl p-6 space-y-6"
      >
        <p className="text-sm text-muted-foreground">
          These values drive the public finance calculator and the sourcing/quote tools. The min/max
          pairs set the slider bounds; the defaults set where each slider starts.
        </p>

        <section className="space-y-4">
          <SectionTitle>Interest</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="default_interest_rate">Default Interest Rate (%)</Label>
              <Input
                id="default_interest_rate"
                type="number"
                step="0.01"
                min="0"
                max="50"
                {...register('default_interest_rate', { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">
                Starting rate shown in calculators (typically Prime + margin).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="min_interest">Min Interest Rate (%)</Label>
              <Input id="min_interest" type="number" step="0.25" min="0" max="50" {...register('min_interest', { valueAsNumber: true })} />
              <p className="text-xs text-muted-foreground">Slider minimum.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_interest">Max Interest Rate (%)</Label>
              <Input id="max_interest" type="number" step="0.25" min="0" max="50" {...register('max_interest', { valueAsNumber: true })} />
              <p className="text-xs text-muted-foreground">Slider maximum.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-border pt-6">
          <SectionTitle>Deposit &amp; balloon</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="min_deposit_percent">Min Deposit (%)</Label>
              <Input id="min_deposit_percent" type="number" min="0" max="100" {...register('min_deposit_percent', { valueAsNumber: true })} />
              <p className="text-xs text-muted-foreground">Minimum deposit percentage the calculator allows.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="min_balloon_percent">Min Balloon (%)</Label>
              <Input id="min_balloon_percent" type="number" min="0" max="100" {...register('min_balloon_percent', { valueAsNumber: true })} />
              <p className="text-xs text-muted-foreground">Slider minimum.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_balloon_percent">Max Balloon (%)</Label>
              <Input id="max_balloon_percent" type="number" min="0" max="100" {...register('max_balloon_percent', { valueAsNumber: true })} />
              <p className="text-xs text-muted-foreground">Slider maximum on the calculator.</p>
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="default_balloon_percent">Default Balloon (%) — sourcing cards</Label>
              <Input id="default_balloon_percent" type="number" min="0" max="50" {...register('default_balloon_percent', { valueAsNumber: true })} />
              <p className="text-xs text-muted-foreground">
                Balloon used for sourcing vehicle-card monthly estimates (makes advertised payments look lower).
              </p>
            </div>
          </div>
        </section>
      </motion.div>
      <SaveBar pending={updateSettings.isPending} />
    </form>
  );
};

/* -------------------------------------------------------------------- Sales */

export const SalesBody = () => {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const { register, handleSubmit, reset } = useForm<SettingsFormData>();

  useEffect(() => {
    if (settings) {
      reset({ monthly_sales_target: settings.monthly_sales_target ?? 10 } as SettingsFormData);
    }
  }, [settings, reset]);

  const onSubmit = (data: SettingsFormData) => {
    updateSettings.mutate({ monthly_sales_target: toNum(data.monthly_sales_target) } as Partial<SiteSettings>);
  };

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <SectionTitle>Sales target</SectionTitle>
          </div>
          <div className="space-y-2 sm:max-w-xs">
            <Label htmlFor="monthly_sales_target">Monthly Sales Target (Units)</Label>
            <Input id="monthly_sales_target" type="number" min="1" max="100" {...register('monthly_sales_target', { valueAsNumber: true })} />
            <p className="text-xs text-muted-foreground">
              Target units to sell per month — drives the dashboard velocity / pace tracker.
            </p>
          </div>
        </motion.div>
        <SaveBar pending={updateSettings.isPending} />
      </form>

      {/* Sales reps save themselves (own persistence). */}
      <SalesRepsTab settings={settings} updateSettings={updateSettings} />
    </div>
  );
};

/* ------------------------------------------------------------------ Contact */

export const ContactBody = () => {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const { register, handleSubmit, reset } = useForm<SettingsFormData>();

  useEffect(() => {
    if (settings) {
      reset({
        primary_phone: settings.primary_phone || '',
        secondary_phone: settings.secondary_phone || '',
        primary_email: settings.primary_email || '',
        finance_email: settings.finance_email || '',
        whatsapp_number: settings.whatsapp_number || '',
        facebook_url: settings.facebook_url || '',
        instagram_url: settings.instagram_url || '',
        tiktok_url: settings.tiktok_url || '',
        google_review_url: settings.google_review_url || '',
        hellopeter_url: settings.hellopeter_url || '',
        trustpilot_url: settings.trustpilot_url || '',
      } as SettingsFormData);
    }
  }, [settings, reset]);

  const onSubmit = (data: SettingsFormData) => {
    const { id, created_at, updated_at, sales_reps, ...rest } = data as any;
    updateSettings.mutate({
      primary_phone: rest.primary_phone,
      secondary_phone: rest.secondary_phone,
      primary_email: rest.primary_email,
      finance_email: rest.finance_email,
      whatsapp_number: rest.whatsapp_number,
      facebook_url: rest.facebook_url,
      instagram_url: rest.instagram_url,
      tiktok_url: rest.tiktok_url,
      google_review_url: rest.google_review_url,
      hellopeter_url: rest.hellopeter_url,
      trustpilot_url: rest.trustpilot_url,
    } as Partial<SiteSettings>);
  };

  if (isLoading) return <Loading />;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6 space-y-6">
        <p className="text-sm text-muted-foreground">
          Phone numbers and emails shown across the public site; the review/social links appear on the
          Client Handover page and in the footer.
        </p>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" />
            <SectionTitle>Contact details</SectionTitle>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primary_phone">Primary Phone *</Label>
              <Input id="primary_phone" placeholder="+27 68 601 7462" {...register('primary_phone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary_phone">Secondary Phone (optional)</Label>
              <Input id="secondary_phone" placeholder="+27 11 000 1234" {...register('secondary_phone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_email">Primary Email *</Label>
              <Input id="primary_email" type="email" placeholder="hello@luminaauto.co.za" {...register('primary_email')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="finance_email">Finance Email *</Label>
              <Input id="finance_email" type="email" placeholder="finance@luminaauto.co.za" {...register('finance_email')} />
              <p className="text-xs text-muted-foreground">Where finance-application alerts are sent.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
              <Input id="whatsapp_number" placeholder="27686017462" {...register('whatsapp_number')} />
              <p className="text-xs text-muted-foreground">
                Country code + number, no “+” or spaces (used by every WhatsApp click-to-chat link).
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-border pt-6">
          <div className="space-y-1">
            <SectionTitle>Review &amp; social links</SectionTitle>
            <p className="text-sm text-muted-foreground">
              Shown on the Client Handover page and across the site. Leave a field blank to hide that link.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="google_review_url">Google Review URL</Label>
              <Input id="google_review_url" placeholder="https://g.page/r/..." {...register('google_review_url' as any)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hellopeter_url">HelloPeter URL</Label>
              <Input id="hellopeter_url" placeholder="https://www.hellopeter.com/..." {...register('hellopeter_url' as any)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trustpilot_url">Trustpilot URL</Label>
              <Input id="trustpilot_url" placeholder="https://www.trustpilot.com/review/..." {...register('trustpilot_url' as any)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facebook_url">Facebook URL</Label>
              <Input id="facebook_url" placeholder="https://www.facebook.com/..." {...register('facebook_url')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram_url">Instagram URL</Label>
              <Input id="instagram_url" placeholder="https://www.instagram.com/..." {...register('instagram_url')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tiktok_url">TikTok URL</Label>
              <Input id="tiktok_url" placeholder="https://www.tiktok.com/@..." {...register('tiktok_url')} />
            </div>
          </div>
        </section>
      </motion.div>
      <SaveBar pending={updateSettings.isPending} />
    </form>
  );
};

/* ----------------------------------------------------------------- Location */

export const LocationBody = () => {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const { register, handleSubmit, reset, watch, setValue } = useForm<SettingsFormData>();

  useEffect(() => {
    if (settings) {
      reset({
        show_physical_location: settings.show_physical_location ?? true,
        physical_address: settings.physical_address || '',
      } as SettingsFormData);
    }
  }, [settings, reset]);

  const onSubmit = (data: SettingsFormData) => {
    updateSettings.mutate({
      show_physical_location: data.show_physical_location,
      physical_address: data.physical_address,
    } as Partial<SiteSettings>);
  };

  const show = watch('show_physical_location');

  if (isLoading) return <Loading />;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <SectionTitle>Physical location</SectionTitle>
        </div>

        <div className="space-y-4">
          <ToggleRow
            label="Show Physical Location"
            hint="Display the address & map on the Contact page."
            checked={!!show}
            onCheckedChange={(checked) => setValue('show_physical_location', checked, { shouldDirty: true })}
          />

          {show && (
            <div className="space-y-2">
              <Label htmlFor="physical_address">Physical Address</Label>
              <Textarea id="physical_address" placeholder="123 Automotive Drive, Sandton, Johannesburg, South Africa" {...register('physical_address')} rows={3} />
            </div>
          )}
        </div>
      </motion.div>
      <SaveBar pending={updateSettings.isPending} />
    </form>
  );
};

/* ----------------------------------------------------------------- Features */

export const FeaturesBody = () => {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const { handleSubmit, reset, watch, setValue } = useForm<SettingsFormData>();

  useEffect(() => {
    if (settings) {
      reset({
        show_finance_tab: settings.show_finance_tab ?? true,
        show_trade_in: (settings as any).show_trade_in ?? true,
        require_application_signature: (settings as any).require_application_signature ?? true,
      } as SettingsFormData);
    }
  }, [settings, reset]);

  const onSubmit = (data: SettingsFormData) => {
    updateSettings.mutate({
      show_finance_tab: data.show_finance_tab,
      show_trade_in: (data as any).show_trade_in,
      require_application_signature: (data as any).require_application_signature,
    } as Partial<SiteSettings>);
  };

  const showFinanceTab = watch('show_finance_tab');
  const showTradeIn = watch('show_trade_in' as any) ?? true;
  const requireSignature = watch('require_application_signature' as any) ?? true;

  if (isLoading) return <Loading />;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          <SectionTitle>Feature toggles</SectionTitle>
        </div>
        <p className="text-sm text-muted-foreground">Turn storefront features on or off without a code change.</p>

        <div className="grid gap-3 lg:grid-cols-2">
          <ToggleRow
            label="Show “Apply for Finance” Tab"
            hint="Display the finance-application link in the public navigation."
            checked={!!showFinanceTab}
            onCheckedChange={(checked) => setValue('show_finance_tab', checked, { shouldDirty: true })}
          />
          <ToggleRow
            label="Show “Trade-In Experts” Section"
            hint="Toggle the trade-in feature card on the homepage."
            checked={!!showTradeIn}
            onCheckedChange={(checked) => setValue('show_trade_in' as any, checked, { shouldDirty: true })}
          />
          <ToggleRow
            label="Require Client Signature on Finance Apps"
            hint="When off, applicants can submit without a digital signature."
            checked={!!requireSignature}
            onCheckedChange={(checked) => setValue('require_application_signature' as any, checked, { shouldDirty: true })}
          />
        </div>

        <SaveBar pending={updateSettings.isPending} />

        {/* System diagnostics — self-contained, no form binding. */}
        <section className="space-y-4 border-t border-border pt-6">
          <div className="flex items-center gap-2">
            <TestTube className="w-4 h-4 text-amber-500" />
            <SectionTitle>System diagnostics</SectionTitle>
          </div>
          <TestEmailButton />
        </section>
      </motion.div>
    </form>
  );
};
