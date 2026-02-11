import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Plus, RefreshCw, Inbox, AlertTriangle, FileText } from 'lucide-react';
import { isToday } from 'date-fns';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import KanbanCard from '@/components/admin/leads/KanbanCard';
import LeadEditModal from '@/components/admin/leads/LeadEditModal';
import { PIPELINE_COLUMNS, type Lead } from '@/components/admin/leads/types';

const AdminLeads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const fetchLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*, vehicle:vehicles(make, model, year)')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load leads');
      return;
    }
    setLeads((data as Lead[]) || []);
    setLoading(false);
  }, []);

  // Initial fetch + auto-refresh every 60s
  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, 60_000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  // Drag handler
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const leadId = result.draggableId;
    const newStage = result.destination.droppableId;

    // Optimistic update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, pipeline_stage: newStage } : l));

    const { error } = await supabase
      .from('leads')
      .update({ pipeline_stage: newStage, last_activity_at: new Date().toISOString() })
      .eq('id', leadId);

    if (error) {
      toast.error('Failed to move lead');
      fetchLeads(); // Revert
    }
  };

  const handleEdit = (lead: Lead) => {
    setEditLead(lead);
    setEditOpen(true);
  };

  // Stats
  const todayLeads = leads.filter(l => isToday(new Date(l.created_at))).length;
  const urgentFollowups = leads.filter(l => l.next_action_date && isToday(new Date(l.next_action_date))).length;
  const newCount = leads.filter(l => (l.pipeline_stage || 'new') === 'new').length;

  const getColumnLeads = (stageId: string) =>
    leads.filter(l => (l.pipeline_stage || 'new') === stageId);

  return (
    <AdminLayout>
      <Helmet>
        <title>Sales Mission Control | Lumina Auto</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
          <div>
            <h1 className="text-xl font-bold">Sales Mission Control</h1>
            <p className="text-xs text-muted-foreground">Drag leads across stages • Auto-refreshes every 60s</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Metrics */}
            <div className="hidden md:flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 font-medium">
                <Inbox className="w-3.5 h-3.5" /> New Today: {todayLeads}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> Urgent: {urgentFollowups}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 font-medium">
                <FileText className="w-3.5 h-3.5" /> Inbox: {newCount}
              </span>
            </div>

            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchLeads(); }}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 h-full min-w-max">
              {PIPELINE_COLUMNS.map(column => {
                const columnLeads = getColumnLeads(column.id);
                return (
                  <div key={column.id} className={`w-[300px] flex flex-col rounded-xl bg-muted/30 border border-border border-t-4 ${column.color}`}>
                    {/* Column Header */}
                    <div className={`flex items-center justify-between px-3 py-2 ${column.headerBg} rounded-t-lg`}>
                      <span className="text-sm font-bold">{column.title}</span>
                      <span className="text-xs font-medium bg-background/50 rounded-full px-2 py-0.5">
                        {columnLeads.length}
                      </span>
                    </div>

                    {/* Droppable Area */}
                    <Droppable droppableId={column.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 overflow-y-auto p-2 space-y-2 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
                        >
                          {columnLeads.map((lead, index) => (
                            <Draggable key={lead.id} draggableId={lead.id} index={index}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                >
                                  <KanbanCard lead={lead} onEdit={handleEdit} />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {columnLeads.length === 0 && (
                            <div className="text-center text-xs text-muted-foreground py-8 opacity-50">
                              No leads
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        </div>
      </div>

      <LeadEditModal
        lead={editLead}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={fetchLeads}
      />
    </AdminLayout>
  );
};

export default AdminLeads;
