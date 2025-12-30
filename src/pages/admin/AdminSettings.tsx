import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Settings, DollarSign, Phone, Palette, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import AdminLayout from '@/components/admin/AdminLayout';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSiteSettings, useUpdateSiteSettings, SiteSettings } from '@/hooks/useSiteSettings';

type SettingsFormData = Omit<SiteSettings, 'id' | 'created_at' | 'updated_at'>;

const AdminSettings = () => {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();

  const { register, handleSubmit, reset, watch, setValue } = useForm<SettingsFormData>({
    defaultValues: {
      default_interest_rate: 13.75,
      min_balloon_percent: 0,
      max_balloon_percent: 40,
      contact_phone: '',
      contact_email: '',
      whatsapp_number: '',
      facebook_url: '',
      instagram_url: '',
      hero_headline: '',
      hero_subheadline: '',
      is_maintenance_mode: false,
    },
  });

  // Reset form when settings load
  useEffect(() => {
    if (settings) {
      reset({
        default_interest_rate: settings.default_interest_rate,
        min_balloon_percent: settings.min_balloon_percent,
        max_balloon_percent: settings.max_balloon_percent,
        contact_phone: settings.contact_phone,
        contact_email: settings.contact_email,
        whatsapp_number: settings.whatsapp_number,
        facebook_url: settings.facebook_url,
        instagram_url: settings.instagram_url,
        hero_headline: settings.hero_headline,
        hero_subheadline: settings.hero_subheadline,
        is_maintenance_mode: settings.is_maintenance_mode,
      });
    }
  }, [settings, reset]);

  const onSubmit = (data: SettingsFormData) => {
    updateSettings.mutate(data);
  };

  const isMaintenanceMode = watch('is_maintenance_mode');

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
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="finance" className="gap-2">
                <DollarSign className="w-4 h-4" />
                Finance
              </TabsTrigger>
              <TabsTrigger value="contact" className="gap-2">
                <Phone className="w-4 h-4" />
                Contact & Socials
              </TabsTrigger>
              <TabsTrigger value="branding" className="gap-2">
                <Palette className="w-4 h-4" />
                Branding
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
                    <Label htmlFor="default_interest_rate">Global Base Interest Rate (%)</Label>
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
                      Update this when the Prime Lending Rate changes
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
                </div>
              </motion.div>
            </TabsContent>

            {/* Contact & Socials Tab */}
            <TabsContent value="contact">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl p-6 space-y-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Phone className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">Contact & Social Links</h2>
                </div>

                <div className="grid gap-6">
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

                  <div className="space-y-2">
                    <Label htmlFor="contact_phone">Contact Phone</Label>
                    <Input
                      id="contact_phone"
                      placeholder="+27 68 601 7462"
                      {...register('contact_phone')}
                      className="max-w-md"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact_email">Contact Email</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      placeholder="lumina.auto1@gmail.com"
                      {...register('contact_email')}
                      className="max-w-md"
                    />
                  </div>

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
