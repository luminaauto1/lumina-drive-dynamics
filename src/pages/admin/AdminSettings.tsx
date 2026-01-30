import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Settings, DollarSign, Phone, Palette, Loader2, MapPin, CreditCard, Users, Plus, X, Target, Mail, TestTube, Building2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import AdminLayout from '@/components/admin/AdminLayout';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSiteSettings, useUpdateSiteSettings, SiteSettings } from '@/hooks/useSiteSettings';
import EmailTemplateEditor from '@/components/admin/EmailTemplateEditor';
import BankIntegrationsTab from '@/components/admin/BankIntegrationsTab';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type SettingsFormData = Omit<SiteSettings, 'id' | 'created_at' | 'updated_at'> & { tiktok_url: string };

interface SalesRep {
  name: string;
  commission: number;
}

// Sales Reps Management Component
const SalesRepsTab = ({ settings, updateSettings }: { settings: SiteSettings | undefined; updateSettings: ReturnType<typeof useUpdateSiteSettings> }) => {
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [newRepName, setNewRepName] = useState('');
  const [newRepCommission, setNewRepCommission] = useState(5);

  useEffect(() => {
    if (settings && (settings as any).sales_reps) {
      setReps((settings as any).sales_reps || []);
    }
  }, [settings]);

  const addRep = () => {
    if (!newRepName.trim()) return;
    const updatedReps = [...reps, { name: newRepName.trim(), commission: newRepCommission }];
    setReps(updatedReps);
    updateSettings.mutate({ sales_reps: updatedReps } as any);
    setNewRepName('');
    setNewRepCommission(5);
  };

  const removeRep = (index: number) => {
    const updatedReps = reps.filter((_, i) => i !== index);
    setReps(updatedReps);
    updateSettings.mutate({ sales_reps: updatedReps } as any);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-6 space-y-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Sales Representatives</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Add sales representatives and their commission percentages for deal finalization.
      </p>

      {/* Add New Rep */}
      <div className="flex items-end gap-4 p-4 bg-muted/30 rounded-lg">
        <div className="flex-1 space-y-2">
          <Label>Rep Name</Label>
          <Input
            placeholder="John Doe"
            value={newRepName}
            onChange={(e) => setNewRepName(e.target.value)}
          />
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
        <Button onClick={addRep} className="gap-2">
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </div>

      {/* Existing Reps */}
      {reps.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No sales representatives added yet.
        </p>
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeRep(index)}
                className="text-destructive hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

// Test Email Button Component
const TestEmailButton = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestEmail = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-finance-alert', {
        body: {
          applicationId: 'test-' + Date.now(),
          clientName: 'Test User',
          clientEmail: 'test@example.com', // Won't actually send - just tests the function
          netSalary: 25000,
          adminEmail: 'lumina.auto1@gmail.com',
        },
      });

      if (error) {
        console.error('Email test failed:', error);
        setTestResult({
          success: false,
          message: `Edge Function Error: ${error.message || JSON.stringify(error)}`,
        });
        toast.error(`Email test failed: ${error.message}`);
      } else {
        setTestResult({
          success: true,
          message: 'Email system is working! Check your inbox.',
        });
        toast.success('Email test successful!');
      }
    } catch (err: any) {
      console.error('Email test exception:', err);
      setTestResult({
        success: false,
        message: `Exception: ${err.message || 'Unknown error'}`,
      });
      toast.error(`Email test failed: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Test the email notification system. This will attempt to send a test email using your configured Resend API key.
      </p>
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleTestEmail}
          disabled={isTesting}
          className="gap-2"
        >
          {isTesting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Mail className="w-4 h-4" />
              Test Email System
            </>
          )}
        </Button>
      </div>
      {testResult && (
        <div
          className={`p-4 rounded-lg text-sm ${
            testResult.success
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-destructive/10 text-destructive border border-destructive/30'
          }`}
        >
          <p className="font-medium">{testResult.success ? '✓ Success' : '✗ Failed'}</p>
          <p className="mt-1 text-xs opacity-80 break-all">{testResult.message}</p>
        </div>
      )}
    </div>
  );
};

const AdminSettings = () => {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();

  const { register, handleSubmit, reset, watch, setValue } = useForm<SettingsFormData>({
    defaultValues: {
      default_interest_rate: 13.25,
      min_interest: 10.5,
      max_interest: 25.0,
      min_deposit_percent: 0,
      min_balloon_percent: 0,
      max_balloon_percent: 40,
      default_balloon_percent: 35,
      contact_phone: '',
      contact_email: '',
      whatsapp_number: '',
      facebook_url: '',
      instagram_url: '',
      tiktok_url: '',
      hero_headline: '',
      hero_subheadline: '',
      is_maintenance_mode: false,
      primary_phone: '',
      secondary_phone: '',
      primary_email: '',
      finance_email: '',
      show_physical_location: true,
      physical_address: '',
      show_finance_tab: true,
      monthly_sales_target: 10,
    },
  });

  // Reset form when settings load
  useEffect(() => {
    if (settings) {
      reset({
        default_interest_rate: settings.default_interest_rate || 13.25,
        min_interest: settings.min_interest || 10.5,
        max_interest: settings.max_interest || 25.0,
        min_deposit_percent: settings.min_deposit_percent || 0,
        min_balloon_percent: settings.min_balloon_percent,
        max_balloon_percent: settings.max_balloon_percent,
        default_balloon_percent: settings.default_balloon_percent || 35,
        contact_phone: settings.contact_phone,
        contact_email: settings.contact_email,
        whatsapp_number: settings.whatsapp_number,
        facebook_url: settings.facebook_url,
        instagram_url: settings.instagram_url,
        tiktok_url: settings.tiktok_url || '',
        hero_headline: settings.hero_headline,
        hero_subheadline: settings.hero_subheadline,
        is_maintenance_mode: settings.is_maintenance_mode,
        primary_phone: settings.primary_phone || '',
        secondary_phone: settings.secondary_phone || '',
        primary_email: settings.primary_email || '',
        finance_email: settings.finance_email || '',
        show_physical_location: settings.show_physical_location ?? true,
        physical_address: settings.physical_address || '',
        show_finance_tab: settings.show_finance_tab ?? true,
        monthly_sales_target: settings.monthly_sales_target || 10,
      });
    }
  }, [settings, reset]);

  const onSubmit = (data: SettingsFormData) => {
    updateSettings.mutate(data);
  };

  const isMaintenanceMode = watch('is_maintenance_mode');
  const showPhysicalLocation = watch('show_physical_location');
  const showFinanceTab = watch('show_finance_tab');

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Helmet>
        <title>Settings | Lumina Auto Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-semibold mb-2">Site Settings</h1>
          <p className="text-muted-foreground">Configure your dealership settings globally</p>
        </motion.div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Tabs defaultValue="finance" className="max-w-3xl">
            <TabsList className="grid w-full grid-cols-8 mb-6">
              <TabsTrigger value="finance" className="gap-2">
                <DollarSign className="w-4 h-4" />
                Finance
              </TabsTrigger>
              <TabsTrigger value="banks" className="gap-2">
                <Building2 className="w-4 h-4" />
                Banks
              </TabsTrigger>
              <TabsTrigger value="sales" className="gap-2">
                <Users className="w-4 h-4" />
                Sales
              </TabsTrigger>
              <TabsTrigger value="contact" className="gap-2">
                <Phone className="w-4 h-4" />
                Contact
              </TabsTrigger>
              <TabsTrigger value="location" className="gap-2">
                <MapPin className="w-4 h-4" />
                Location
              </TabsTrigger>
              <TabsTrigger value="branding" className="gap-2">
                <Palette className="w-4 h-4" />
                Branding
              </TabsTrigger>
              <TabsTrigger value="features" className="gap-2">
                <CreditCard className="w-4 h-4" />
                Features
              </TabsTrigger>
              <TabsTrigger value="emails" className="gap-2">
                <Mail className="w-4 h-4" />
                Emails
              </TabsTrigger>
            </TabsList>

            {/* Finance Configuration Tab */}
            <TabsContent value="finance">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl p-6 space-y-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">Finance Configuration</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  These values control the finance calculator across the site.
                </p>

                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="default_interest_rate">Default Interest Rate (%)</Label>
                    <Input
                      id="default_interest_rate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="50"
                      {...register('default_interest_rate', { valueAsNumber: true })}
                      className="max-w-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Default rate shown in calculators (typically Prime + margin)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="min_interest">Min Interest Rate (%)</Label>
                      <Input
                        id="min_interest"
                        type="number"
                        step="0.25"
                        min="0"
                        max="50"
                        {...register('min_interest', { valueAsNumber: true })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Slider minimum
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_interest">Max Interest Rate (%)</Label>
                      <Input
                        id="max_interest"
                        type="number"
                        step="0.25"
                        min="0"
                        max="50"
                        {...register('max_interest', { valueAsNumber: true })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Slider maximum
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="min_deposit_percent">Min Deposit (%)</Label>
                    <Input
                      id="min_deposit_percent"
                      type="number"
                      min="0"
                      max="100"
                      {...register('min_deposit_percent', { valueAsNumber: true })}
                      className="max-w-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum deposit percentage required
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="min_balloon_percent">Min Balloon (%)</Label>
                      <Input
                        id="min_balloon_percent"
                        type="number"
                        min="0"
                        max="100"
                        {...register('min_balloon_percent', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_balloon_percent">Max Balloon (%)</Label>
                      <Input
                        id="max_balloon_percent"
                        type="number"
                        min="0"
                        max="100"
                        {...register('max_balloon_percent', { valueAsNumber: true })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Controls slider limit on calculator
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="default_balloon_percent">Default Balloon (%) - For Sourcing Cards</Label>
                    <Input
                      id="default_balloon_percent"
                      type="number"
                      min="0"
                      max="50"
                      {...register('default_balloon_percent' as any, { valueAsNumber: true })}
                      className="max-w-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Default balloon percentage used for sourcing vehicle card calculations (makes payments look lower)
                    </p>
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            {/* Banks Tab */}
            <TabsContent value="banks">
              <BankIntegrationsTab />
            </TabsContent>

            {/* Sales Reps Tab */}
            <TabsContent value="sales">
              <div className="space-y-6">
                {/* Monthly Sales Target */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-xl p-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Target className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">Sales Target</h2>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthly_sales_target">Monthly Sales Target (Units)</Label>
                    <Input
                      id="monthly_sales_target"
                      type="number"
                      min="1"
                      max="100"
                      {...register('monthly_sales_target' as any, { valueAsNumber: true })}
                      className="max-w-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Target number of units to sell per month (used in dashboard velocity tracker)
                    </p>
                  </div>
                </motion.div>
                
                {/* Sales Reps */}
                <SalesRepsTab settings={settings} updateSettings={updateSettings} />
              </div>
            </TabsContent>

            {/* Contact Tab */}
            <TabsContent value="contact">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl p-6 space-y-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Phone className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">Contact Details & Social Links</h2>
                </div>

                <div className="grid gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primary_phone">Primary Phone *</Label>
                      <Input
                        id="primary_phone"
                        placeholder="+27 68 601 7462"
                        {...register('primary_phone')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondary_phone">Secondary Phone (Optional)</Label>
                      <Input
                        id="secondary_phone"
                        placeholder="+27 11 000 1234"
                        {...register('secondary_phone')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primary_email">Primary Email *</Label>
                      <Input
                        id="primary_email"
                        type="email"
                        placeholder="hello@luminaauto.co.za"
                        {...register('primary_email')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="finance_email">Finance Email *</Label>
                      <Input
                        id="finance_email"
                        type="email"
                        placeholder="finance@luminaauto.co.za"
                        {...register('finance_email')}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
                    <Input
                      id="whatsapp_number"
                      placeholder="27686017462"
                      {...register('whatsapp_number')}
                      className="max-w-md"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: Country code + number (no + or spaces)
                    </p>
                  </div>

                  <div className="border-t border-border pt-6">
                    <h3 className="font-medium mb-4">Social Media</h3>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="facebook_url">Facebook URL</Label>
                        <Input
                          id="facebook_url"
                          placeholder="https://www.facebook.com/..."
                          {...register('facebook_url')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="instagram_url">Instagram URL</Label>
                        <Input
                          id="instagram_url"
                          placeholder="https://www.instagram.com/..."
                          {...register('instagram_url')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tiktok_url">TikTok URL</Label>
                        <Input
                          id="tiktok_url"
                          placeholder="https://www.tiktok.com/@..."
                          {...register('tiktok_url')}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            {/* Location Tab */}
            <TabsContent value="location">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl p-6 space-y-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <MapPin className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">Physical Location</h2>
                </div>

                <div className="grid gap-6">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div>
                      <Label>Show Physical Location</Label>
                      <p className="text-sm text-muted-foreground">
                        Display address and map on Contact page
                      </p>
                    </div>
                    <Switch 
                      checked={showPhysicalLocation}
                      onCheckedChange={(checked) => setValue('show_physical_location', checked)}
                    />
                  </div>

                  {showPhysicalLocation && (
                    <div className="space-y-2">
                      <Label htmlFor="physical_address">Physical Address</Label>
                      <Textarea
                        id="physical_address"
                        placeholder="123 Automotive Drive, Sandton, Johannesburg, South Africa"
                        {...register('physical_address')}
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            </TabsContent>

            {/* Branding Tab */}
            <TabsContent value="branding">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="glass-card rounded-xl p-6 space-y-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Palette className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">Homepage Branding</h2>
                  </div>

                  <div className="grid gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="hero_headline">Hero Headline</Label>
                      <Input
                        id="hero_headline"
                        placeholder="Drive Your Aspirations"
                        {...register('hero_headline')}
                      />
                      <p className="text-xs text-muted-foreground">
                        Main text displayed on the homepage hero section
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hero_subheadline">Hero Subheadline</Label>
                      <Input
                        id="hero_subheadline"
                        placeholder="The New Era of Vehicle Sourcing"
                        {...register('hero_subheadline')}
                      />
                    </div>
                  </div>
                </div>

                {/* Site Control */}
                <div className="glass-card rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Settings className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">Site Control</h2>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Maintenance Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Temporarily disable the website for maintenance
                      </p>
                    </div>
                    <Switch 
                      checked={isMaintenanceMode}
                      onCheckedChange={(checked) => setValue('is_maintenance_mode', checked)}
                    />
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            {/* Features Tab */}
            <TabsContent value="features">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl p-6 space-y-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <CreditCard className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">Feature Toggles</h2>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <Label>Show "Apply for Finance" Tab</Label>
                    <p className="text-sm text-muted-foreground">
                      Display the finance application link in the navigation menu
                    </p>
                  </div>
                  <Switch 
                    checked={showFinanceTab}
                    onCheckedChange={(checked) => setValue('show_finance_tab', checked)}
                  />
                </div>

                {/* Email System Test */}
                <div className="border-t border-border pt-6 mt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <TestTube className="w-5 h-5 text-amber-500" />
                    <h3 className="text-lg font-semibold">System Diagnostics</h3>
                  </div>
                  <TestEmailButton />
                </div>
              </motion.div>
            </TabsContent>

            {/* Email Templates Tab */}
            <TabsContent value="emails">
              <EmailTemplateEditor />
            </TabsContent>
          </Tabs>

          {/* Save Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 max-w-3xl"
          >
            <Button 
              type="submit" 
              size="lg"
              disabled={updateSettings.isPending}
              className="w-full sm:w-auto"
            >
              {updateSettings.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save All Settings'
              )}
            </Button>
          </motion.div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
