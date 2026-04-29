import { Card } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";

const SystemFix = () => {
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

          <Card className="bg-card/40 backdrop-blur-xl border border-border p-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 space-y-2">
                <h2 className="text-xl font-semibold">Public Submission Pipeline</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Public finance applications and lead captures are now protected by
                  least-privilege Row-Level Security policies. The legacy "force unlock
                  database" override has been removed because it allowed any caller to
                  disable security on these tables. If you experience a submission issue,
                  raise it with engineering rather than disabling RLS.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SystemFix;
