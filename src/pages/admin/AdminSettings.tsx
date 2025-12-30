import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Settings, Globe, Palette, Bell } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const AdminSettings = () => {
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
          <h1 className="text-3xl font-semibold mb-2">Settings</h1>
          <p className="text-muted-foreground">Configure your dealership settings</p>
        </motion.div>

        <div className="max-w-2xl space-y-6">
          {/* Site Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <Globe className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Site Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">Temporarily disable the website for maintenance</p>
                </div>
                <Switch />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Finance Calculator</Label>
                  <p className="text-sm text-muted-foreground">Display finance calculator on vehicle pages</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show WhatsApp Button</Label>
                  <p className="text-sm text-muted-foreground">Display floating WhatsApp button</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Notifications</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive email when new leads come in</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Finance Application Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified for new finance applications</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </motion.div>

          {/* Coming Soon */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card rounded-xl p-6 opacity-60"
          >
            <div className="flex items-center gap-3 mb-6">
              <Palette className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Theme & Branding</h2>
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Coming Soon</span>
            </div>
            
            <p className="text-muted-foreground text-sm">
              Customize colors, logo, and branding options for your dealership website.
            </p>
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;