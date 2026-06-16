import { format } from 'date-fns';
import { TimelineItem, TimelineType } from '@/lib/clientTimeline';
import { StickyNote, Phone, Bell, ArrowRightLeft, Banknote, Car, Truck, FilePlus, Circle } from 'lucide-react';

const ICONS: Record<TimelineType, { icon: any; color: string }> = {
  note:     { icon: StickyNote,     color: 'text-blue-400' },
  call:     { icon: Phone,          color: 'text-green-400' },
  reminder: { icon: Bell,           color: 'text-yellow-400' },
  status:   { icon: ArrowRightLeft, color: 'text-cyan-400' },
  offer:    { icon: Banknote,       color: 'text-amber-400' },
  sale:     { icon: Car,            color: 'text-emerald-400' },
  delivery: { icon: Truck,          color: 'text-emerald-400' },
  created:  { icon: FilePlus,       color: 'text-muted-foreground' },
  system:   { icon: Circle,         color: 'text-muted-foreground' },
};

/** Unified, read-only client history timeline. */
const ClientTimeline = ({ items }: { items: TimelineItem[] }) => {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No history yet — log activity from the Pipeline (Lead Cockpit) or Client Hub.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const { icon: Icon, color } = ICONS[item.type] || ICONS.system;
        let when = item.timestamp;
        try { when = format(new Date(item.timestamp), 'dd MMM yyyy • HH:mm'); } catch { /* keep raw */ }
        return (
          <div key={item.id} className="flex gap-3">
            <div className="mt-0.5 shrink-0">
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="flex-1 min-w-0 border-b border-border/40 pb-3 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium capitalize truncate">{item.title}</span>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">{when}</span>
              </div>
              {item.body && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">{item.body}</p>
              )}
              {item.author && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">{item.author}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ClientTimeline;
