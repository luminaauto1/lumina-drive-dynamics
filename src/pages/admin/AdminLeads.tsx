import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageCircle, Clock, UserPlus, Loader2, GripVertical, Search, AlertTriangle, RefreshCw, Archive } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { LeadCockpit } from "@/components/admin/leads/LeadCockpit";

const COLUMNS = [
  { id: 'new', label: 'Inbox', color: 'border-zinc-700' },
  { id: 'actioned', label: 'Actioned', color: 'border-blue-500' },
  { id: 'docs_processing', label: 'Docs / Processing', color: 'border-purple-500' },
  { id: 'submitted', label: 'Submitted to Banks', color: 'border-indigo-500' },
  { id: 'approved', label: 'Finance Approved', color: 'border-yellow-500' },
  { id: 'validations', label: 'Validations', color: 'border-orange-500' },
  { id: 'validated', label: 'Validated', color: 'border-emerald-500' },
  { id: 'contract', label: 'Contract / Closing', color: 'border-cyan-500' },
  { id: 'delivery', label: 'Delivery / Handover', color: 'border-green-600' },
];

const mapAppStatusToColumn = (status: string) => {
  switch (status) {
    case 'new': return 'docs_processing';
    case 'docs_collected': return 'docs_processing';
    case 'submitted_to_banks': return 'submitted';
    case 'pre_approved': return 'approved';
    case 'finance_approved': return 'approved';
    case 'validation_pending': return 'validations';
    case 'validated': return 'validated';
    case 'contract_generated': return 'contract';
    case 'contract_sent': return 'contract';
    case 'contract_signed': return 'contract';
    case 'prepping_delivery': return 'delivery';
    case 'delivered': return 'delivery';
    default: return 'docs_processing';
  }
};

const mapColumnToAppStatus = (colId: string): string | null => {
  switch (colId) {
    case 'docs_processing': return 'docs_collected';
    case 'submitted': return 'submitted_to_banks';
    case 'approved': return 'finance_approved';
    case 'validations': return 'validation_pending';
    case 'validated': return 'validated';
    case 'contract': return 'contract_generated';
    case 'delivery': return 'prepping_delivery';
    default: return null;
  }
};

interface MergedLead {
  id: string;
  isVirtual?: boolean;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  notes: string | null;
  source?: string;
  status?: string;
  pipeline_stage: string | null;
  created_at: string;
  status_updated_at: string | null;
  admin_last_viewed_at: string | null;
  is_archived?: boolean;
  displayStatus: string;
  appDetails?: any;
  [key: string]: any;
}

const AdminLeads = () => {
  const [leads, setLeads] = useState<MergedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", phone: "", notes: "" });
  const [adding, setAdding] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data: leadData } = await supabase
      .from('leads')
      .select('*')
      .eq('is_archived', showArchived)
      .order('created_at', { ascending: false });

    const { data: apps } = await supabase
      .from('finance_applications')
      .select('id, user_id, status, created_at, full_name, email, phone, selected_vehicle_id, vehicles:vehicles!finance_applications_selected_vehicle_id_fkey(make, model, year)');

    let combined: MergedLead[] = (leadData || []).map((l: any) => ({
      ...l,
      displayStatus: l.pipeline_stage || 'new',
    }));

    // Find orphan apps (no matching lead)
    apps?.forEach((app) => {
      const exists = combined.find((l) =>
        (l.client_email && app.email && l.client_email.toLowerCase() === app.email.toLowerCase()) ||
        (l.client_phone && app.phone && l.client_phone.replace(/\D/g, '') === app.phone.replace(/\D/g, ''))
      );
      if (!exists) {
        combined.push({
          id: `virtual-${app.id}`,
          isVirtual: true,
          client_name: app.full_name,
          client_phone: app.phone,
          client_email: app.email,
          notes: null,
          source: 'finance_app',
          pipeline_stage: mapAppStatusToColumn(app.status),
          created_at: app.created_at,
          status_updated_at: app.created_at,
          admin_last_viewed_at: null,
          displayStatus: mapAppStatusToColumn(app.status),
          appDetails: app,
        });
      }
    });

    // Link apps to existing leads
    const mapped = combined.map((lead) => {
      if (!lead.isVirtual && !lead.appDetails) {
        const app = apps?.find((a) =>
          (lead.client_email && a.email && lead.client_email.toLowerCase() === a.email.toLowerCase()) ||
          (lead.client_phone && a.phone && lead.client_phone.replace(/\D/g, '') === a.phone.replace(/\D/g, ''))
        );
        if (app) {
          lead.appDetails = app;
          lead.displayStatus = mapAppStatusToColumn(app.status);
        }
      }
      return lead;
    });

    setLeads(mapped);
    setLoading(false);
  }, [showArchived]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Horizontal scroll handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  const startDraggingScroll = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollContainerRef.current?.offsetLeft || 0));
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
  };

  const stopDraggingScroll = () => setIsDragging(false);

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 2;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  // DnD
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStage = destination.droppableId;
    const leadIndex = leads.findIndex((l) => l.id === draggableId);
    if (leadIndex === -1) return;
    const lead = leads[leadIndex];

    // Optimistic
    const updatedLeads = [...leads];
    updatedLeads[leadIndex] = { ...lead, displayStatus: newStage };
    setLeads(updatedLeads);

    try {
      if (lead.isVirtual) {
        const { data: newDbLead, error } = await supabase.from('leads').insert({
          client_name: lead.client_name,
          client_phone: lead.client_phone,
          client_email: lead.client_email,
          pipeline_stage: newStage,
          source: 'finance_app',
          status: 'new',
        }).select().single();

        if (!error && newDbLead) {
          updatedLeads[leadIndex] = { ...updatedLeads[leadIndex], id: newDbLead.id, isVirtual: false };
          setLeads(updatedLeads);
        }
      } else {
        await supabase.from('leads').update({
          pipeline_stage: newStage,
          status_updated_at: new Date().toISOString(),
        }).eq('id', lead.id);
      }

      const appStatus = mapColumnToAppStatus(newStage);
      if (lead.appDetails && appStatus) {
        await supabase.from('finance_applications').update({ status: appStatus }).eq('id', lead.appDetails.id);
        toast.success(`Moved to ${newStage.replace(/_/g, ' ')}`);
      } else {
        toast.success(`Lead moved`);
      }
    } catch {
      toast.error('Move failed — reverting');
      fetchLeads();
    }
  };

  const handleAddLead = async () => {
    if (!newLead.name || !newLead.phone) {
      toast.error('Name and Phone required');
      return;
    }
    setAdding(true);
    try {
      const { error } = await supabase.from('leads').insert({
        client_name: newLead.name,
        client_phone: newLead.phone,
        notes: newLead.notes || 'Manual Entry',
        pipeline_stage: 'new',
        source: 'manual',
        status: 'new',
      });
      if (error) throw error;
      toast.success('Lead added');
      setIsAddOpen(false);
      setNewLead({ name: "", phone: "", notes: "" });
      fetchLeads();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  const filteredLeads = leads.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.client_name?.toLowerCase().includes(q) ||
      l.client_phone?.includes(q) ||
      l.client_email?.toLowerCase().includes(q)
    );
  });

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0 flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold">Pipeline Command</h1>
            <p className="text-xs text-muted-foreground">Drag cards to move • Click to open cockpit • Scroll to navigate</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 w-40 text-sm" />
            </div>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm"><UserPlus className="w-4 h-4 mr-1" /> Add</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Manual Lead</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div><Label>Name *</Label><Input value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} /></div>
                  <div><Label>Phone *</Label><Input value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} /></div>
                  <div><Label>Notes</Label><Input value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} /></div>
                  <Button className="w-full" onClick={handleAddLead} disabled={adding}>
                    {adding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save Lead
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)}>
              <Archive className="w-4 h-4 mr-1" /> {showArchived ? 'Active' : 'Archived'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchLeads(); }}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* KANBAN BOARD */}
        <DragDropContext onDragEnd={onDragEnd}>
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-x-auto overflow-y-hidden p-4"
            onWheel={handleWheel}
            onMouseDown={startDraggingScroll}
            onMouseUp={stopDraggingScroll}
            onMouseLeave={stopDraggingScroll}
            onMouseMove={onMouseMove}
          >
            <div className="flex gap-4 h-full min-w-max">
              {COLUMNS.map((col) => {
                const columnLeads = filteredLeads.filter((l) => l.displayStatus === col.id);
                return (
                  <div key={col.id} className={`w-[260px] flex flex-col rounded-xl bg-muted/30 border border-border border-t-4 ${col.color}`} onMouseDown={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm font-bold">{col.label}</span>
                      <span className="text-xs font-medium bg-background/50 rounded-full px-2 py-0.5">{columnLeads.length}</span>
                    </div>

                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px] transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
                        >
                          {columnLeads.map((lead, index) => {
                            const needsAttention = !lead.isVirtual && (new Date(lead.status_updated_at || lead.created_at).getTime() > new Date(lead.admin_last_viewed_at || 0).getTime());
                            const vehicleLabel = lead.appDetails?.vehicles
                              ? `${lead.appDetails.vehicles.year} ${lead.appDetails.vehicles.make} ${lead.appDetails.vehicles.model}`
                              : null;

                            return (
                              <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                {(provided, snapshot) => (
                                  <Card
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    onClick={() => setSelectedLeadId(lead.id)}
                                    className={`p-3 relative group transition-all cursor-pointer border-l-4 ${col.color.replace('border-', 'border-l-')} bg-card hover:bg-accent/50 ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/30' : ''}`}
                                  >
                                    <div {...provided.dragHandleProps} className="absolute top-2 left-1 opacity-0 group-hover:opacity-50 transition-opacity">
                                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                    </div>

                                    {needsAttention && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}

                                    <div className="ml-3 mr-6">
                                      <p className="font-semibold text-sm truncate">{lead.client_name || 'Unknown'}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                        {vehicleLabel || lead.notes || 'New Inquiry'}
                                      </p>
                                      {lead.appDetails && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-1 bg-purple-500/10 text-purple-400 border-purple-500/30">
                                          {lead.appDetails.status.replace(/_/g, ' ')}
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between mt-2 ml-3">
                                      <span className="text-[10px] text-muted-foreground">
                                        {formatDistanceToNow(new Date(lead.status_updated_at || lead.created_at), { addSuffix: true })}
                                      </span>
                                      {lead.client_phone && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-400"
                                          onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${lead.client_phone?.replace(/\D/g, '')}`, '_blank'); }}>
                                          <MessageCircle className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </Card>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                          {columnLeads.length === 0 && (
                            <div className="text-center text-xs text-muted-foreground py-8 opacity-50">No leads</div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </div>
        </DragDropContext>
      </div>

      <LeadCockpit
        leadId={selectedLeadId}
        isOpen={!!selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onUpdate={fetchLeads}
      />
    </AdminLayout>
  );
};

export default AdminLeads;
