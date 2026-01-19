import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Wrench, CheckCircle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import KineticText from '@/components/KineticText';

const SQL_CODE = `-- ============================================
-- LUMINA DMS 3.0 - COMPLETE DATABASE REPAIR
-- ============================================

-- 1. REMOVE THE STATUS RESTRICTION (Fixes "Violates Check Constraint" errors)
ALTER TABLE finance_applications DROP CONSTRAINT IF EXISTS finance_applications_status_check;

-- 2. FIX VEHICLE STATUS CONSTRAINT (Allows ALL required statuses including 'hidden')
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_status_check 
  CHECK (status IN ('available', 'reserved', 'sold', 'incoming', 'sourcing', 'hidden'));

-- 3. ADD ANTI-TIME WASTING COLUMNS
ALTER TABLE finance_applications ADD COLUMN IF NOT EXISTS has_drivers_license BOOLEAN DEFAULT FALSE;
ALTER TABLE finance_applications ADD COLUMN IF NOT EXISTS credit_score_status TEXT DEFAULT 'unsure';

-- 4. ADD SETTINGS COLUMNS
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS min_interest NUMERIC DEFAULT 10.5;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS max_interest NUMERIC DEFAULT 25.0;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS min_deposit_percent NUMERIC DEFAULT 0;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS tiktok_url TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS default_balloon_percent NUMERIC DEFAULT 35;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS monthly_sales_target INTEGER DEFAULT 10;

-- 5. ADD VARIANTS TO VEHICLES (for sourcing specs)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

-- 6. ADD SALES REPS SETTINGS
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS sales_reps JSONB DEFAULT '[]'::jsonb;

-- 7. CREATE DEAL RECORDS TABLE
CREATE TABLE IF NOT EXISTS deal_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES finance_applications(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  sales_rep_name TEXT,
  sales_rep_commission NUMERIC,
  sold_price NUMERIC,
  sold_mileage INTEGER,
  next_service_date DATE,
  next_service_km INTEGER,
  delivery_address TEXT,
  delivery_date TIMESTAMP WITH TIME ZONE,
  aftersales_expenses JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE deal_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Admins Manage Deals" ON deal_records USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- LUMINA DMS - NEW TABLES
-- ============================================

-- 8. RECON TASKS (The Forge)
CREATE TABLE IF NOT EXISTS inventory_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  category TEXT CHECK (category IN ('mechanical', 'aesthetic', 'valet', 'admin')),
  cost NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE inventory_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Admins can manage inventory tasks" ON inventory_tasks FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 9. CLIENT ACTIVITY LOG (The Genome)
CREATE TABLE IF NOT EXISTS client_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  application_id UUID REFERENCES finance_applications(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE client_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Admins can manage client activities" ON client_activities FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 10. DEAL ADD-ONS (The Ledger)
CREATE TABLE IF NOT EXISTS deal_add_ons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES deal_records(id) ON DELETE CASCADE,
  application_id UUID REFERENCES finance_applications(id),
  item_name TEXT NOT NULL,
  cost_price NUMERIC DEFAULT 0,
  selling_price NUMERIC DEFAULT 0,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE deal_add_ons ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Admins can manage deal add-ons" ON deal_add_ons FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- SECURE STORAGE BUCKETS
-- ============================================

-- 11. SECURE CLIENT DOCUMENTS BUCKET
INSERT INTO storage.buckets (id, name, public) 
VALUES ('client-docs', 'client-docs', false) 
ON CONFLICT (id) DO NOTHING;`;

const SystemFix = () => {
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SQL_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <>
      <Helmet>
        <title>System Repair | Lumina Auto</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen pt-24 pb-20">
        <div className="container mx-auto px-6 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
              <Wrench className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              <KineticText>System Repair</KineticText>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              This page contains database repair SQL that fixes constraint issues and adds missing columns.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* Status Card */}
            {applied ? (
              <div className="glass-card rounded-xl p-6 border-2 border-green-500/30 bg-green-500/5">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <div>
                    <h3 className="font-semibold text-green-400">Database Repair Applied</h3>
                    <p className="text-sm text-muted-foreground">
                      The migration has been executed. Your admin buttons should now work correctly.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-card rounded-xl p-6 border-2 border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center gap-3">
                  <Wrench className="w-6 h-6 text-amber-500" />
                  <div>
                    <h3 className="font-semibold text-amber-400">Database Repair Available</h3>
                    <p className="text-sm text-muted-foreground">
                      Copy the SQL below and run it in your database, or the Lovable system will apply it automatically.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* SQL Code Block */}
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                <span className="text-sm font-medium">SQL Migration</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy SQL
                    </>
                  )}
                </Button>
              </div>
              <pre className="p-4 overflow-x-auto text-sm bg-black/30">
                <code className="text-green-400">{SQL_CODE}</code>
              </pre>
            </div>

            {/* Mark as Applied Button */}
            <div className="flex justify-center">
              <Button
                onClick={() => setApplied(true)}
                className={applied ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}
                size="lg"
              >
                {applied ? (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Migration Applied
                  </>
                ) : (
                  <>
                    <Wrench className="w-5 h-5 mr-2" />
                    Mark as Applied (After Running SQL)
                  </>
                )}
              </Button>
            </div>

            {/* Instructions */}
            <div className="glass-card rounded-xl p-6 space-y-4">
              <h3 className="font-semibold">What This Fixes:</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 text-sm">
                <li><strong>Status Constraint Error:</strong> Removes the restrictive check constraint that was blocking status updates like "Archive" and "Finalize"</li>
                <li><strong>Anti-Time Wasting Fields:</strong> Adds columns for driver's license status and credit score to help filter low-quality leads</li>
                <li><strong>Calculator Settings:</strong> Adds configurable interest rate range and deposit settings</li>
                <li><strong>TikTok URL:</strong> Adds TikTok social media link to site settings</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default SystemFix;