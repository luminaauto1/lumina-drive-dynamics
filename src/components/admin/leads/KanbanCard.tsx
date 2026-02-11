import { formatDistanceToNow, isToday, differenceInHours } from 'date-fns';
import { Phone, MessageCircle, Pencil, Calendar, Car } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Lead } from './types';

interface KanbanCardProps {
  lead: Lead;
  onEdit: (lead: Lead) => void;
}

const KanbanCard = ({ lead, onEdit }: KanbanCardProps) => {
  const hoursAgo = differenceInHours(new Date(), new Date(lead.created_at));
  const isUrgent = hoursAgo < 4;
  const nextActionIsToday = lead.next_action_date && isToday(new Date(lead.next_action_date));

  const openWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.client_phone) return;
    const clean = lead.client_phone.replace(/\D/g, '');
    window.open(`https://wa.me/${clean}`, '_blank');
  };

  const callPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.client_phone) return;
    window.open(`tel:${lead.client_phone}`);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-foreground truncate">
            {lead.client_name || 'Unknown'}
          </p>
          {lead.vehicle && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Car className="w-3 h-3 shrink-0" />
              {lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}
            </p>
          )}
        </div>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isUrgent ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'}`}>
          {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
        </span>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1 mb-2">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {lead.source}
        </Badge>
        {lead.lead_score > 0 && (
          <Badge className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">
            Score: {lead.lead_score}
          </Badge>
        )}
      </div>

      {/* Next Action */}
      {lead.next_action_date && (
        <div className={`text-xs rounded px-2 py-1 mb-2 flex items-center gap-1 ${nextActionIsToday ? 'bg-yellow-500/20 text-yellow-400' : 'bg-muted text-muted-foreground'}`}>
          <Calendar className="w-3 h-3" />
          {lead.next_action_note || 'Follow up'}: {new Date(lead.next_action_date).toLocaleDateString()}
        </div>
      )}

      {/* Notes preview */}
      {lead.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{lead.notes}</p>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-1 border-t border-border pt-2">
        {lead.client_phone && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400 hover:text-emerald-300" onClick={openWhatsApp} title="WhatsApp">
              <MessageCircle className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400 hover:text-blue-300" onClick={callPhone} title="Call">
              <Phone className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); onEdit(lead); }} title="Edit">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default KanbanCard;
