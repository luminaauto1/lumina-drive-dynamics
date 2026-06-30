import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BrainCircuit } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import TaskOSPanel from './TaskOSPanel';

const db = supabase as any;

// Very small launcher for LuminaTaskOS, mounted globally in AdminLayout.
// Sits ABOVE the AIAssistantWidget Brain FAB (bottom-6 right-6) — do not collide.
const TaskOSButton = () => {
  const { isStaff } = useAuth();
  const [open, setOpen] = useState(false);

  // Count items the AI flagged for review (cheap head count; low frequency).
  const { data: attention = 0 } = useQuery({
    queryKey: ['taskos', 'attention'],
    queryFn: async () => {
      const { count } = await db.from('taskos_inbox_items')
        .select('id', { count: 'exact', head: true })
        .in('status', ['needs_review', 'failed']);
      return count ?? 0;
    },
    refetchInterval: 30000,
    enabled: isStaff,
  });

  if (!isStaff) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          title="LuminaTaskOS — your second brain (⌘ via Telegram too)"
          className="fixed bottom-[5.5rem] right-6 z-50 h-9 w-9 rounded-full bg-card/90 border border-border text-foreground shadow-lg flex items-center justify-center hover:bg-accent hover:border-primary/50 transition-all"
        >
          <BrainCircuit className="h-4 w-4 text-primary" />
          {attention > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center">
              {attention > 9 ? '9+' : attention}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="p-0 w-[92vw] sm:w-[440px] flex flex-col gap-0">
        <div className="px-3 py-2.5 border-b border-border flex items-center gap-2 shrink-0">
          <BrainCircuit className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">LuminaTaskOS</span>
          <span className="text-[10px] text-muted-foreground ml-auto">your second brain</span>
        </div>
        <div className="flex-1 overflow-hidden">
          {open && <TaskOSPanel />}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TaskOSButton;
