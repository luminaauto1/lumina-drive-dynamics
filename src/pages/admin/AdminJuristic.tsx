import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import JuristicPanel from "@/components/admin/JuristicPanel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2 } from "lucide-react";

const AdminJuristic = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("juristic_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <AdminLayout>
      <Helmet>
        <title>Juristic Capture | Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Juristic / Commercial Asset Finance</h1>
            <p className="text-sm text-muted-foreground">
              Create a capture session, share the link, and auto-generate every bank's juristic + UBO PDFs.
            </p>
          </div>
        </div>

        {/* Create new (no application_id) */}
        <JuristicPanel />

        {/* Recent submissions */}
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold">Recent Capture Sessions</h3>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sessions yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map(r => (
                <div key={r.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.company_name || "Untitled session"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()} · {r.registration_number || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === "submitted" ? "default" : "outline"} className="text-[10px]">
                      {r.status}
                    </Badge>
                    <Link
                      to={`/juristic/${r.access_token}`}
                      target="_blank"
                      className="text-xs text-primary hover:underline"
                    >
                      Open link
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminJuristic;
