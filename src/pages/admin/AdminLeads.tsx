import { useEffect, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Archive, Eye, MessageCircle, Phone, RefreshCw, Inbox, AlertTriangle } from "lucide-react";
import { formatDistanceToNow, isToday } from "date-fns";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import LeadEditModal from "@/components/admin/leads/LeadEditModal";

// DEFINED COLUMNS
const COLUMNS = [
  { id: 'new', label: '📥 Inbox / New', color: 'border-t-red-500', headerBg: 'bg-red-500/10 text-red-400' },
  { id: 'actioned', label: '🗣️ Actioned', color: 'border-t-blue-500', headerBg: 'bg-blue-500/10 text-blue-400' },
  { id: 'app_received', label: '📝 App Received', color: 'border-t-purple-500', headerBg: 'bg-purple-500/10 text-purple-400' },
  { id: 'app_submitted', label: '📤 App Submitted', color: 'border-t-indigo-500', headerBg: 'bg-indigo-500/10 text-indigo-400' },
  { id: 'pre_approved', label: '✅ Pre-Approved', color: 'border-t-yellow-500', headerBg: 'bg-yellow-500/10 text-yellow-400' },
  { id: 'validation_pending', label: '⏳ Validations', color: 'border-t-orange-500', headerBg: 'bg-orange-500/10 text-orange-400' },
  { id: 'validated', label: '🏁 Validated', color: 'border-t-emerald-500', headerBg: 'bg-emerald-500/10 text-emerald-400' },
];

interface MergedLead {
  id: string;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  source: string;
  status: string;
  notes: string | null;
  pipeline_stage: string | null;
  lead_score: number | null;
  next_action_date: string | null;
  next_action_note: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  status_updated_at: string | null;
  admin_last_viewed_at: string | null;
  vehicle_id: string | null;
  vehicle?: { make: string; model: string; year: number } | null;
  displayStatus: string;
  appDetails?: {
    id: string;
    status: string;
    full_name: string;
    vehicles?: { make: string; model: string; year: number } | null;
  } | null;
}

const AdminLeads = () => {
  const [leads, setLeads] = useState<MergedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [editLead, setEditLead] = useState<MergedLead | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const fetchLeads = useCallback(async () => {
    // Fetch leads
    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .select('*, vehicle:vehicles(make, model, year)')
      .eq('is_archived', showArchived)
      .order('created_at', { ascending: false });

    if (leadError) {
      toast.error('Failed to load leads');
      setLoading(false);
      return;
    }

    // Fetch finance apps to auto-map status
    const { data: apps } = await supabase
      .from('finance_applications')
      .select('id, user_id, status, full_name, email, vehicle_id, selected_vehicle:vehicles!finance_applications_selected_vehicle_id_fkey(make, model, year)');

    // Merge: if a lead matches a finance app by email, auto-map status
    const merged: MergedLead[] = (leadData || []).map((lead: any) => {
      const app = apps?.find(a =>
        lead.client_email && a.email && lead.client_email.toLowerCase() === a.email.toLowerCase()
      );

      let displayStatus = lead.pipeline_stage || 'new';

      if (app) {
        if (app.status === 'validated') displayStatus = 'validated';
        else if (app.status === 'validations_pending') displayStatus = 'validation_pending';
        else if (app.status === 'approved') displayStatus = 'pre_approved';
        else if (app.status === 'submitted_to_banks') displayStatus = 'app_submitted';
        else displayStatus = 'app_received';
      }

      return {
        ...lead,
        displayStatus,
        appDetails: app ? {
          id: app.id,
          status: app.status,
          full_name: app.full_name,
          vehicles: app.selected_vehicle as any,
        } : null,
      };
    });

    setLeads(merged);
    setLoading(false);
  }, [showArchived]);

  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, 30_000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  // ACTIONS
  const markAsViewed = async (leadId: string) => {
    await supabase.from('leads').update({ admin_last_viewed_at: new Date().toISOString() }).eq('id', leadId);
    fetchLeads();
  };

  const archiveLead = async (leadId: string) => {
    await supabase.from('leads').update({ is_archived: true }).eq('id', leadId);
    toast.success('Lead archived');
    fetchLeads();
  };

  const moveStage = async (leadId: string, newStage: string) => {
    await supabase.from('leads').update({
      pipeline_stage: newStage,
      last_activity_at: new Date().toISOString(),
    }).eq('id', leadId);
    fetchLeads();
  };

  const handleEdit = (lead: MergedLead) => {
    setEditLead(lead);
    setEditOpen(true);
  };

  // Stats
  const todayLeads = leads.filter(l => isToday(new Date(l.created_at))).length;
  const needsAttentionCount = leads.filter(l => {
    const lastUpdate = new Date(l.status_updated_at || l.created_at).getTime();
    const lastView = new Date(l.admin_last_viewed_at || 0).getTime();
    return lastUpdate > lastView;
  }).length;

  return (
    <AdminLayout>
      <Helmet>
        <title>Pipeline Command | Lumina Auto</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
          <div>
            <h1 className="text-xl font-bold">Pipeline Command</h1>
            <p className="text-xs text-muted-foreground">Auto-syncs with Finance Apps • Refreshes every 30s</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 font-medium">
                <Inbox className="w-3.5 h-3.5" /> New Today: {todayLeads}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> Needs Attention: {needsAttentionCount}
              </span>
            </div>

            <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)}>
              <Archive className="w-4 h-4 mr-1" /> {showArchived ? 'Show Active' : 'Show Archived'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchLeads(); }}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* KANBAN BOARD */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
          <div className="flex gap-4 h-full min-w-max">
            {COLUMNS.map(col => {
              const columnLeads = leads.filter(l => l.displayStatus === col.id);
              return (
                <div key={col.id} className={`w-[280px] flex flex-col rounded-xl bg-muted/30 border border-border border-t-4 ${col.color}`}>
                  {/* Column Header */}
                  <div className={`flex items-center justify-between px-3 py-2 ${col.headerBg} rounded-t-lg`}>
                    <span className="text-sm font-bold">{col.label}</span>
                    <span className="text-xs font-medium bg-background/50 rounded-full px-2 py-0.5">
                      {columnLeads.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-2">
                      {columnLeads.map(lead => {
                        const lastUpdate = new Date(lead.status_updated_at || lead.created_at).getTime();
                        const lastView = new Date(lead.admin_last_viewed_at || 0).getTime();
                        const needsAttention = lastUpdate > lastView;

                        const vehicleLabel = lead.appDetails?.vehicles
                          ? `${lead.appDetails.vehicles.year} ${lead.appDetails.vehicles.make} ${lead.appDetails.vehicles.model}`
                          : lead.vehicle
                            ? `${lead.vehicle.year} ${lead.vehicle.make} ${lead.vehicle.model}`
                            : null;

                        return (
                          <Card
                            key={lead.id}
                            onClick={() => { markAsViewed(lead.id); handleEdit(lead); }}
                            className={`p-3 relative group transition-all cursor-pointer border-l-4 ${needsAttention ? 'border-l-red-500 bg-red-500/5 hover:bg-red-500/10' : 'border-l-blue-500 bg-card hover:bg-accent/50'}`}
                          >
                            {/* Attention dot */}
                            {needsAttention && (
                              <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                            )}

                            <div className="mb-1.5">
                              <p className="font-semibold text-sm truncate">{lead.client_name || 'Unknown Lead'}</p>
                              {vehicleLabel && (
                                <p className="text-xs text-muted-foreground mt-0.5">{vehicleLabel}</p>
                              )}
                            </div>

                            {/* Badges */}
                            <div className="flex flex-wrap gap-1 mb-2">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{lead.source}</Badge>
                              {lead.appDetails && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-purple-500/20 text-purple-400 border-purple-500/30">
                                  App: {lead.appDetails.status}
                                </Badge>
                              )}
                              {(lead.lead_score ?? 0) > 0 && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">
                                  Score: {lead.lead_score}
                                </Badge>
                              )}
                            </div>

                            {lead.notes && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{lead.notes}</p>
                            )}

                            <div className="flex items-center justify-between border-t border-border pt-2">
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(lead.status_updated_at || lead.created_at), { addSuffix: true })}
                              </span>

                              <div className="flex gap-0.5">
                                {lead.client_phone && (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-400 hover:text-emerald-300"
                                      onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${lead.client_phone?.replace(/\D/g, '')}`, '_blank'); }}>
                                      <MessageCircle className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-400 hover:text-blue-300"
                                      onClick={(e) => { e.stopPropagation(); window.open(`tel:${lead.client_phone}`); }}>
                                      <Phone className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  onClick={(e) => { e.stopPropagation(); archiveLead(lead.id); }} title="Archive">
                                  <Archive className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>

                            {/* Quick move buttons */}
                            {col.id === 'new' && (
                              <Button variant="outline" size="sm" className="w-full mt-2 text-xs h-7"
                                onClick={(e) => { e.stopPropagation(); moveStage(lead.id, 'actioned'); }}>
                                Mark Actioned
                              </Button>
                            )}
                          </Card>
                        );
                      })}
                      {columnLeads.length === 0 && (
                        <div className="text-center text-xs text-muted-foreground py-8 opacity-50">No leads</div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <LeadEditModal
        lead={editLead as any}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={fetchLeads}
      />
    </AdminLayout>
  );
};

export default AdminLeads;
