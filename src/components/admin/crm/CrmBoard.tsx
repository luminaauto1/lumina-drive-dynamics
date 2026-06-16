import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { MessageCircle, GripVertical } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CRM_STAGES, CRM_PHASES } from '@/lib/crmStages';
import type { CrmRecord } from '@/hooks/useCrmData';

interface CrmBoardProps {
  records: CrmRecord[];
  onMove: (recordId: string, newStage: string) => void;
  onOpen: (record: CrmRecord) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  canSelect: boolean;
}

const phaseColor = (phaseId: string) => CRM_PHASES.find((p) => p.id === phaseId)?.color || 'text-muted-foreground';

const CrmBoard = ({ records, onMove, onOpen, selectedIds, onToggleSelect, canSelect }: CrmBoardProps) => {
  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    onMove(draggableId, destination.droppableId);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 h-full min-w-max pb-4">
          {CRM_STAGES.map((stage) => {
            const cards = records.filter((r) => r.displayStage === stage.id);
            return (
              <div
                key={stage.id}
                className={`flex-none w-[280px] flex flex-col h-full max-h-full overflow-hidden rounded-xl bg-muted/30 border border-border border-t-4 ${stage.color}`}
              >
                <div className="flex items-center justify-between px-3 py-2 shrink-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold leading-tight">{stage.label}</span>
                    <span className={`text-[10px] uppercase tracking-wide ${phaseColor(stage.phase)}`}>
                      {CRM_PHASES.find((p) => p.id === stage.phase)?.label}
                    </span>
                  </div>
                  <span className="text-xs font-medium bg-background/60 rounded-full px-2 py-0.5">{cards.length}</span>
                </div>

                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 min-h-0 overflow-y-auto p-2 space-y-2 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
                    >
                      {cards.map((rec, index) => {
                        const needsAttention = !rec.isVirtual &&
                          new Date(rec.status_updated_at || rec.created_at).getTime() > new Date(rec.admin_last_viewed_at || 0).getTime();
                        const vehicle = rec.appDetails?.vehicles
                          ? `${rec.appDetails.vehicles.year} ${rec.appDetails.vehicles.make} ${rec.appDetails.vehicles.model}`
                          : null;
                        return (
                          <Draggable key={rec.id} draggableId={rec.id} index={index}>
                            {(prov, snap) => (
                              <Card
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                onClick={() => onOpen(rec)}
                                className={`p-3 relative group transition-all cursor-pointer border-l-4 ${stage.color.replace('border-', 'border-l-')} bg-card hover:bg-accent/50 ${snap.isDragging ? 'shadow-lg ring-2 ring-primary/30' : ''}`}
                              >
                                <div {...prov.dragHandleProps} className="absolute top-2 left-1 opacity-0 group-hover:opacity-50 transition-opacity">
                                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                </div>

                                {canSelect && !rec.isVirtual && (
                                  <div
                                    className={`absolute top-2 right-2 transition-opacity ${selectedIds.has(rec.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                    onClick={(e) => { e.stopPropagation(); onToggleSelect(rec.id); }}
                                  >
                                    <Checkbox checked={selectedIds.has(rec.id)} onCheckedChange={() => onToggleSelect(rec.id)} className="h-4 w-4" />
                                  </div>
                                )}

                                {needsAttention && <span className="absolute top-2 right-7 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}

                                <div className="ml-3 mr-6">
                                  <p className="font-semibold text-sm truncate">{rec.client_name || 'Unknown'}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{vehicle || rec.notes || 'New inquiry'}</p>
                                </div>

                                <div className="flex items-center justify-between mt-2 ml-3">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground">
                                      {formatDistanceToNow(new Date(rec.status_updated_at || rec.created_at), { addSuffix: true })}
                                    </span>
                                    {rec.appDetails?.user_id && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary bg-primary/10">ACCOUNT</Badge>
                                    )}
                                  </div>
                                  {rec.client_phone && (
                                    <Button
                                      variant="ghost" size="icon" className="h-6 w-6 text-emerald-400"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const d = rec.client_phone!.replace(/\D/g, '');
                                        const intl = d.startsWith('0') ? `27${d.slice(1)}` : d;
                                        window.open(`https://wa.me/${intl}`, '_blank');
                                      }}
                                    >
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
                      {cards.length === 0 && (
                        <div className="text-center text-xs text-muted-foreground py-8 opacity-40">Drop here</div>
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
  );
};

export default CrmBoard;
