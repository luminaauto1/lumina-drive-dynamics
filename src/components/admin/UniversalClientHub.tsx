import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Clock, Car, User, FileText } from 'lucide-react';

interface UniversalClientHubProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientEmail?: string;
  clientPhone?: string;
}

export default function UniversalClientHub({ open, onOpenChange, clientEmail, clientPhone }: UniversalClientHubProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [financeApps, setFinanceApps] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');

  const fetchGlobalProfile = useCallback(async () => {
    if (!clientEmail && !clientPhone) return;

    // Fetch Finance Apps
    let financeQuery = supabase.from('finance_applications').select('*');
    if (clientEmail && clientPhone) {
      financeQuery = financeQuery.or(`email.eq.${clientEmail},phone.eq.${clientPhone}`);
    } else if (clientEmail) {
      financeQuery = financeQuery.eq('email', clientEmail);
    } else if (clientPhone) {
      financeQuery = financeQuery.eq('phone', clientPhone);
    }
    const { data: fData } = await financeQuery;
    setFinanceApps(fData || []);

    // Fetch Leads
    let leadQuery = supabase.from('leads').select('*');
    if (clientEmail && clientPhone) {
      leadQuery = leadQuery.or(`client_email.eq.${clientEmail},client_phone.eq.${clientPhone}`);
    } else if (clientEmail) {
      leadQuery = leadQuery.eq('client_email', clientEmail);
    } else if (clientPhone) {
      leadQuery = leadQuery.eq('client_phone', clientPhone);
    }
    const { data: lData } = await leadQuery;
    setLeads(lData || []);

    // Fetch Audit Logs
    let logQuery = supabase.from('client_audit_logs').select('*').order('created_at', { ascending: false });
    if (clientEmail && clientPhone) {
      logQuery = logQuery.or(`client_email.eq.${clientEmail},client_phone.eq.${clientPhone}`);
    } else if (clientEmail) {
      logQuery = logQuery.eq('client_email', clientEmail);
    } else if (clientPhone) {
      logQuery = logQuery.eq('client_phone', clientPhone);
    }
    const { data: logData } = await logQuery;
    setLogs(logData || []);
  }, [clientEmail, clientPhone]);

  useEffect(() => {
    if (open) fetchGlobalProfile();
  }, [open, fetchGlobalProfile]);

  const handleAddNote = async () => {
    if (!newNote.trim() || (!clientEmail && !clientPhone)) return;

    const { error } = await supabase.from('client_audit_logs').insert([{
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
      note: newNote,
      action_type: 'Manual Note',
    }]);

    if (error) {
      toast.error('Failed to save universal note');
      return;
    }

    setNewNote('');
    toast.success('Note added to universal timeline');
    fetchGlobalProfile();
  };

  const masterName = financeApps[0]?.first_name
    ? `${financeApps[0].first_name} ${financeApps[0].last_name || ''}`.trim()
    : financeApps[0]?.full_name || leads[0]?.client_name || 'Unknown Client';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 bg-card border-border overflow-hidden">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <SheetTitle className="text-sm">{masterName}</SheetTitle>
          </div>
          <p className="text-[10px] text-muted-foreground">{clientEmail || 'No Email'} | {clientPhone || 'No Phone'}</p>
        </SheetHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 h-[calc(100vh-5rem)] overflow-hidden">
          {/* LEFT: Data */}
          <div className="border-r border-border p-4 overflow-y-auto space-y-4">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Car className="w-3 h-3" /> Active Finance Apps
              </h3>
              {financeApps.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">No applications found.</p>
              ) : financeApps.map(app => (
                <div key={app.id} className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-foreground">{app.full_name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{app.status}</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground font-mono">ID: {app.id.slice(0, 8)}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> CRM Leads
              </h3>
              {leads.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">No active leads.</p>
              ) : leads.map(lead => (
                <div key={lead.id} className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-foreground">{lead.client_name || 'Lead'}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{lead.status}</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground">Created: {format(new Date(lead.created_at), 'dd MMM yyyy')}</p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Timeline */}
          <div className="p-4 flex flex-col overflow-hidden">
            <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-3">
              <Clock className="w-3 h-3" /> Universal Timeline
            </h3>

            <div className="space-y-2 mb-3">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a permanent note to this client's profile..."
                className="text-xs min-h-[80px] bg-muted/30 border-border focus:border-primary"
              />
              <Button onClick={handleAddNote} size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-xs">
                Save Note
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-3 pl-4 relative before:absolute before:left-1.5 before:top-0 before:h-full before:w-px before:bg-border">
                {logs.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic text-center py-4">No history recorded yet.</p>
                ) : logs.map(log => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[10.5px] top-1.5 w-2 h-2 rounded-full bg-emerald-500 border border-background" />
                    <div className="p-2.5 rounded-md bg-muted/20 border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-emerald-500">{log.author_name}</span>
                        <span className="text-[9px] text-muted-foreground font-mono">{format(new Date(log.created_at), 'dd MMM HH:mm')}</span>
                      </div>
                      <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{log.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
