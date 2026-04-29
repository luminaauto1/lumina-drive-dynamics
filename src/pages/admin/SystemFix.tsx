import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";

const SystemFix = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleUnlockDatabase = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc("admin_unlock_tables" as any);
      if (error) throw error;
      toast.success("Database Unlocked: Public submissions are now fully open.");
    } catch (err: any) {
      toast.error(`Failed to unlock database: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-background text-foreground py-12 px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">System Diagnostics & Fixes</h1>
            <p className="text-muted-foreground">
              Manual overrides for database and security policies.
            </p>
          </div>

          <Card className="bg-card/40 backdrop-blur-xl border border-destructive/30 p-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <ShieldAlert className="w-6 h-6 text-destructive" />
              </div>
              <div className="flex-1 space-y-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">
                    Unlock Public Submissions (Fix RLS)
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    If mobile or public users are experiencing "Submission Failed" errors,
                    click this button. It executes a secure database function to forcefully
                    disable Row-Level Security blocks on the Finance and Leads tables.
                  </p>
                </div>

                <Button
                  onClick={handleUnlockDatabase}
                  disabled={isLoading}
                  variant="destructive"
                  className="w-full sm:w-auto"
                >
                  {isLoading ? "Executing Override..." : "Force Unlock Database"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SystemFix;
