import { useEffect, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, MessageCircle, RefreshCw, Inbox, Phone, Mail, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import AdminLayout from "@/components/admin/AdminLayout";
import { Link } from "react-router-dom";

interface NewLead {
  id: string;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  notes: string | null;
  source: string;
  platform: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  lead_temperature: string | null;
  created_at: string;
  status: string;
  pipeline_stage: string | null;
}

const SOURCE_TONE: Record<string, string> = {
  tiktok: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  facebook: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  instagram: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  whatsapp: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  website: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  manual: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

const AdminNewLeads = () => {
  const [leads, setLeads] = useState<NewLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select(
        "id, client_name, client_phone, client_email, notes, source, platform, utm_source, utm_campaign, lead_temperature, created_at, status, pipeline_stage"
      )
      .or("pipeline_stage.eq.new,status.eq.new")
      .neq("is_archived", true)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      toast.error("Failed to load new leads");
    } else {
      setLeads((data || []) as NewLead[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeads();
    const channel = supabase
      .channel("admin-new-leads")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => fetchLeads()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeads]);

  const markActioned = async (id: string) => {
    setActingId(id);
    const { error } = await supabase
      .from("leads")
      .update({ pipeline_stage: "actioned", status: "actioned" })
      .eq("id", id);
    if (error) toast.error("Could not update lead");
    else {
      toast.success("Lead moved to Actioned");
      setLeads((prev) => prev.filter((l) => l.id !== id));
    }
    setActingId(null);
  };

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.client_name?.toLowerCase().includes(q) ||
      l.client_phone?.includes(q) ||
      l.client_email?.toLowerCase().includes(q) ||
      l.notes?.toLowerCase().includes(q) ||
      l.source?.toLowerCase().includes(q)
    );
  });

  return (
    <AdminLayout>
      <Helmet>
        <title>New Leads | Lumina Auto</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Inbox className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold">New Leads</h1>
              <Badge variant="outline" className="ml-1">
                {filtered.length}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Inbox of all uncontacted enquiries across TikTok, Facebook, WhatsApp and the website.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, email, notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 w-72"
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchLeads}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-xl p-16 text-center">
            <Inbox className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Inbox zero — no fresh leads waiting.</p>
          </div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => {
                  const phoneDigits = l.client_phone?.replace(/\D/g, "") || "";
                  const wa = phoneDigits.startsWith("0") ? `27${phoneDigits.slice(1)}` : phoneDigits;
                  const tone =
                    SOURCE_TONE[l.source?.toLowerCase()] || "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.client_name || "Unnamed lead"}</div>
                        {l.lead_temperature && (
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            {l.lead_temperature}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                          {l.client_phone && (
                            <a href={`tel:${l.client_phone}`} className="flex items-center gap-1 hover:text-primary">
                              <Phone className="w-3 h-3" /> {l.client_phone}
                            </a>
                          )}
                          {l.client_email && (
                            <a
                              href={`mailto:${l.client_email}`}
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              <Mail className="w-3 h-3" /> {l.client_email}
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${tone}`}>
                          {l.source || "unknown"}
                        </Badge>
                        {l.platform && (
                          <div className="text-[10px] text-muted-foreground mt-1">{l.platform}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.utm_campaign || l.utm_source || "—"}
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="text-xs text-muted-foreground line-clamp-2">{l.notes || "—"}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {wa && (
                            <a
                              href={`https://wa.me/${wa}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-green-500 hover:bg-green-500/10"
                              title="Open WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => markActioned(l.id)}
                            disabled={actingId === l.id}
                          >
                            {actingId === l.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                Actioned <ArrowRight className="w-3 h-3 ml-1" />
                              </>
                            )}
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <Link to={`/admin/leads?focus=${l.id}`}>Open</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminNewLeads;
