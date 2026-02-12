import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageCircle, Phone, Clock, CarFront, Banknote,
  UserCheck, StickyNote, Bell, CheckCircle2,
  ArrowRight, Calendar, Archive, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

interface LeadCockpitProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export const LeadCockpit = ({ leadId, isOpen, onClose, onUpdate }: LeadCockpitProps) => {
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [inputType, setInputType] = useState<'note' | 'call' | 'reminder'>('note');
  const [reminderDate, setReminderDate] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // FETCH
  useEffect(() => {
    if (leadId && isOpen) {
      const fetchData = async () => {
        setLoading(true);
        const { data: leadData } = await supabase
          .from('leads')
          .select('*, vehicle:vehicles(make, model, year)')
          .eq('id', leadId)
          .single();

        if (leadData) {
          // Try to find linked finance application
          const filters: string[] = [];
          if (leadData.client_email) filters.push(`email.eq.${leadData.client_email}`);
          if (leadData.client_phone) filters.push(`phone.eq.${leadData.client_phone}`);

          let linkedApp = null;
          if (filters.length > 0) {
            const { data: appData } = await supabase
              .from('finance_applications')
              .select('*, selected_vehicle:vehicles!finance_applications_selected_vehicle_id_fkey(make, model, year, vin, registration_number, color, price)')
              .or(filters.join(','))
              .order('created_at', { ascending: false })
              .maybeSingle();
            linkedApp = appData;
          }

          setLead({
            ...leadData,
            id_number: leadData.id_number || linkedApp?.id_number,
            linkedApp,
          });

          // Mark as viewed
          await supabase.from('leads').update({ admin_last_viewed_at: new Date().toISOString() }).eq('id', leadId);
        }
        setLoading(false);
      };
      fetchData();
    } else {
      setLead(null);
    }
  }, [leadId, isOpen]);

  // SAVE GENERIC FIELD
  const updateField = async (field: string, value: any) => {
    if (!leadId) return;
    const { error } = await supabase.from('leads').update({ [field]: value }).eq('id', leadId);
    if (!error) setLead((prev: any) => ({ ...prev, [field]: value }));
  };

  // ADD ACTIVITY
  const addActivity = async () => {
    if (!noteText.trim()) return;
    const newLog = {
      id: Date.now().toString(),
      type: inputType,
      text: noteText,
      date: new Date().toISOString(),
      user: 'Admin',
      reminderDue: inputType === 'reminder' ? reminderDate : null,
      isCompleted: false,
    };
    const currentLogs = Array.isArray(lead?.activity_log) ? lead.activity_log : [];
    const updatedLogs = [newLog, ...currentLogs];
    const { error } = await supabase.from('leads').update({
      activity_log: updatedLogs,
      status_updated_at: new Date().toISOString(),
    }).eq('id', leadId);

    if (!error) {
      setLead((prev: any) => ({ ...prev, activity_log: updatedLogs }));
      setNoteText("");
      toast.success(`${inputType.toUpperCase()} added to history.`);
    }
  };

  const completeReminder = async (logId: string) => {
    const updatedLogs = (lead.activity_log || []).map((log: any) =>
      log.id === logId ? { ...log, isCompleted: true } : log
    );
    await updateField('activity_log', updatedLogs);
    toast.success("Reminder cleared");
  };

  // WHATSAPP
  const openWhatsApp = (template: string) => {
    if (!lead?.client_phone) return;
    const name = lead.client_name || "there";
    let msg = "";
    if (template === 'intro') msg = `Hi ${name}, Albert from Lumina here. I saw your inquiry about the ${lead.linkedApp?.selected_vehicle?.model || 'vehicle'}. Do you have a moment to chat?`;
    if (template === 'docs') msg = `Hi ${name}, to proceed with validation, please send your ID, License, and 3 months bank statements.`;
    window.open(`https://wa.me/${lead.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const archiveLead = async () => {
    if (!leadId) return;
    await supabase.from('leads').update({ is_archived: true }).eq('id', leadId);
    toast.success("Lead archived");
    onClose();
    onUpdate();
  };

  if (!isOpen) return null;

  const temperatureColors: Record<string, string> = {
    cold: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    warm: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    hot: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-[960px] p-0 overflow-hidden bg-zinc-950 border-zinc-800">
        {loading || !lead ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* --- HEADER (HUD) --- */}
            <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-950">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {lead.client_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-zinc-100">{lead.client_name || 'Unknown Lead'}</h2>
                      <Badge className={`text-[10px] ${temperatureColors[lead.lead_temperature] || temperatureColors.warm}`}>
                        {lead.lead_temperature || 'WARM'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                        {lead.pipeline_stage?.replace(/_/g, ' ')?.toUpperCase() || 'NEW LEAD'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-0.5">
                      {lead.client_phone && <span><Phone className="w-3 h-3 inline mr-1" />{lead.client_phone}</span>}
                      <span>ID: {lead.id_number || 'Missing'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs border-zinc-700 text-zinc-400 hover:text-zinc-200" onClick={archiveLead}>
                    <Archive className="w-3 h-3 mr-1" /> Archive
                  </Button>
                </div>
              </div>
            </div>

            {/* --- MAIN COCKPIT GRID --- */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-[240px_1fr_1fr] overflow-hidden">

              {/* COL 1: DRIVER (Identity) */}
              <div className="border-r border-zinc-800 overflow-y-auto">
                <div className="p-4 space-y-4">
                  {/* Quick Comms */}
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">One-Click Comms</p>
                    <div className="space-y-1.5">
                      <Button variant="outline" size="sm" className="w-full justify-start h-7 text-xs border-zinc-800 text-zinc-300 hover:bg-emerald-950 hover:text-emerald-400 hover:border-emerald-800" onClick={() => openWhatsApp('intro')}>
                        <MessageCircle className="w-3 h-3 mr-2 text-emerald-500" /> "Hi, Albert here..."
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start h-7 text-xs border-zinc-800 text-zinc-300 hover:bg-emerald-950 hover:text-emerald-400 hover:border-emerald-800" onClick={() => openWhatsApp('docs')}>
                        <MessageCircle className="w-3 h-3 mr-2 text-emerald-500" /> "Please send docs..."
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start h-7 text-xs border-zinc-800 text-zinc-300 hover:bg-blue-950 hover:text-blue-400 hover:border-blue-800" onClick={() => lead.client_phone && window.open(`tel:${lead.client_phone}`)}>
                        <Phone className="w-3 h-3 mr-2 text-blue-500" /> Call Now
                      </Button>
                    </div>
                  </div>

                  <Separator className="bg-zinc-800" />

                  {/* Identity Vault */}
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Identity Vault</p>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-zinc-600">Full Name</label>
                        <Input defaultValue={lead.client_name || ''} onBlur={e => updateField('client_name', e.target.value)} className="h-7 bg-zinc-900 border-zinc-800 text-xs text-zinc-200" />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-600">ID Number</label>
                        <Input defaultValue={lead.id_number || ''} onBlur={e => updateField('id_number', e.target.value)} className="h-7 bg-zinc-900 border-zinc-800 text-xs text-zinc-200" />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-600">Email</label>
                        <Input defaultValue={lead.client_email || ''} onBlur={e => updateField('client_email', e.target.value)} className="h-7 bg-zinc-900 border-zinc-800 text-xs text-zinc-200" />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-600">Heat Level</label>
                        <Select defaultValue={lead.lead_temperature || 'warm'} onValueChange={v => updateField('lead_temperature', v)}>
                          <SelectTrigger className="h-7 bg-zinc-900 border-zinc-800 text-xs text-zinc-200"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cold">❄️ Cold</SelectItem>
                            <SelectItem value="warm">🟠 Warm</SelectItem>
                            <SelectItem value="hot">🔥 Hot</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* COL 2: MACHINE (Deal Structure) */}
              <div className="border-r border-zinc-800 overflow-y-auto">
                <div className="p-4 space-y-4">
                  {/* Target Vehicle */}
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <CarFront className="w-3 h-3" /> Target Vehicle
                    </p>
                    {lead.linkedApp?.selected_vehicle ? (
                      <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-bold text-zinc-200">{lead.linkedApp.selected_vehicle.year} {lead.linkedApp.selected_vehicle.make}</p>
                            <p className="text-xs text-zinc-400">{lead.linkedApp.selected_vehicle.model}</p>
                            <p className="text-[10px] text-zinc-600 mt-1">{lead.linkedApp.selected_vehicle.registration_number || "Stock # Pending"}</p>
                          </div>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Linked</Badge>
                        </div>
                      </div>
                    ) : lead.vehicle ? (
                      <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                        <p className="text-sm font-medium text-zinc-200">{lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}</p>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-zinc-900/50 border border-dashed border-zinc-800 text-center">
                        <CarFront className="w-5 h-5 text-zinc-700 mx-auto mb-1" />
                        <p className="text-[10px] text-zinc-600">No vehicle linked yet.</p>
                      </div>
                    )}
                  </div>

                  <Separator className="bg-zinc-800" />

                  {/* Trade-In */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                        <CarFront className="w-3 h-3" /> Trade-In
                      </p>
                      <span className="text-[10px] text-emerald-400 font-mono">
                        Net: R {(Number(lead.trade_in_estimated_value || 0)).toLocaleString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input defaultValue={lead.trade_in_make_model || ''} onBlur={e => updateField('trade_in_make_model', e.target.value)} placeholder="Make & Model" className="col-span-2 h-7 bg-zinc-900 border-zinc-800 text-xs text-zinc-200" />
                      <Input type="number" defaultValue={lead.trade_in_year || ''} onBlur={e => updateField('trade_in_year', e.target.value ? Number(e.target.value) : null)} placeholder="Year" className="h-7 bg-zinc-900 border-zinc-800 text-xs text-zinc-200" />
                      <Input type="number" defaultValue={lead.trade_in_mileage || ''} onBlur={e => updateField('trade_in_mileage', e.target.value ? Number(e.target.value) : null)} placeholder="Mileage" className="h-7 bg-zinc-900 border-zinc-800 text-xs text-zinc-200" />
                      <Input type="number" defaultValue={lead.trade_in_estimated_value || ''} onBlur={e => updateField('trade_in_estimated_value', e.target.value ? Number(e.target.value) : null)} placeholder="Estimated Value (R)" className="col-span-2 h-7 bg-zinc-900 border-zinc-800 text-xs text-zinc-200" />
                    </div>
                  </div>

                  <Separator className="bg-zinc-800" />

                  {/* Finance Scratchpad */}
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Banknote className="w-3 h-3" /> Quick Quote
                    </p>
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                      <div>
                        <p className="text-[10px] text-zinc-600">Price</p>
                        <p className="text-sm font-bold text-zinc-200">R {(lead.linkedApp?.selected_vehicle?.price || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-600">Term</p>
                        <Select defaultValue={String(lead.desired_term || 72)} onValueChange={v => updateField('desired_term', Number(v))}>
                          <SelectTrigger className="h-7 bg-zinc-950 border-zinc-800 text-xs text-zinc-200"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="72">72 Months</SelectItem>
                            <SelectItem value="60">60 Months</SelectItem>
                            <SelectItem value="54">54 Months</SelectItem>
                            <SelectItem value="48">48 Months</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-600">Deposit</p>
                        <Input type="number" defaultValue={lead.desired_deposit || ''} onBlur={e => updateField('desired_deposit', e.target.value ? Number(e.target.value) : null)} placeholder="R 0" className="h-7 bg-zinc-950 border-zinc-800 text-xs text-zinc-200" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* COL 3: THE BRAIN (History & Input) */}
              <div className="flex flex-col overflow-hidden">
                {/* Input Zone */}
                <div className="p-4 border-b border-zinc-800 bg-zinc-950">
                  <div className="flex gap-1 mb-2">
                    <Button variant={inputType === 'note' ? 'default' : 'outline'} size="sm" onClick={() => setInputType('note')} className="flex-1 h-7 text-xs">
                      <StickyNote className="w-3 h-3 mr-1" /> Note
                    </Button>
                    <Button variant={inputType === 'call' ? 'default' : 'outline'} size="sm" onClick={() => setInputType('call')} className="flex-1 h-7 text-xs">
                      <Phone className="w-3 h-3 mr-1" /> Call
                    </Button>
                    <Button variant={inputType === 'reminder' ? 'default' : 'outline'} size="sm" onClick={() => setInputType('reminder')} className="flex-1 h-7 text-xs">
                      <Bell className="w-3 h-3 mr-1" /> Remind
                    </Button>
                  </div>

                  <div className="relative">
                    <Textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder={inputType === 'call' ? "Outcome of call..." : inputType === 'reminder' ? "Remind me to..." : "Add a note..."}
                      className="min-h-[80px] bg-zinc-900 border-zinc-800 text-sm resize-none text-zinc-200 placeholder:text-zinc-600"
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addActivity(); } }}
                    />
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                      {inputType === 'reminder' && (
                        <Input type="datetime-local" className="h-6 w-36 text-[10px] p-1 bg-zinc-900 border-zinc-700 text-zinc-300" onChange={(e) => setReminderDate(e.target.value)} />
                      )}
                      <Button size="icon" className="h-6 w-6 bg-blue-600 hover:bg-blue-500" onClick={addActivity}>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* History Stream */}
                <ScrollArea className="flex-1 p-4 bg-zinc-950" ref={scrollRef}>
                  <div className="space-y-4">
                    <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest text-center mb-4">History Stream</div>

                    {(Array.isArray(lead.activity_log) ? lead.activity_log : []).map((log: any, idx: number) => {
                      const isCall = log.type === 'call';
                      const isReminder = log.type === 'reminder';

                      return (
                        <div key={log.id || idx} className="relative pl-6 group">
                          {/* Timeline Line */}
                          <div className="absolute left-[7px] top-4 bottom-0 w-[1px] bg-zinc-800 group-last:hidden" />

                          {/* Icon Bubble */}
                          <div className={`absolute left-0 top-0 w-4 h-4 rounded-full border-2 border-zinc-950 flex items-center justify-center z-10 
                            ${isCall ? 'bg-green-600' : isReminder ? 'bg-yellow-600' : 'bg-blue-600'}`}>
                            {isCall && <Phone className="w-2 h-2 text-white" />}
                            {isReminder && <Bell className="w-2 h-2 text-white" />}
                            {!isCall && !isReminder && <StickyNote className="w-2 h-2 text-white" />}
                          </div>

                          {/* Content Bubble */}
                          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded p-3 hover:bg-zinc-900 hover:border-zinc-700 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                              <span className={`text-xs font-bold capitalize ${isCall ? 'text-green-400' : isReminder ? 'text-yellow-400' : 'text-blue-400'}`}>
                                {log.type}
                              </span>
                              <span className="text-[10px] text-zinc-500" title={log.date ? format(new Date(log.date), "PPP p") : ''}>
                                {log.date ? formatDistanceToNow(new Date(log.date), { addSuffix: true }) : ''}
                              </span>
                            </div>

                            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{log.text}</p>

                            {/* Reminder Actions */}
                            {isReminder && log.reminderDue && (
                              <div className={`mt-2 flex items-center gap-2 text-xs p-1.5 rounded ${log.isCompleted ? 'bg-green-900/20 text-green-500' : 'bg-yellow-900/20 text-yellow-500'}`}>
                                <Clock className="w-3 h-3" />
                                {log.isCompleted ? "Completed" : `Due: ${format(new Date(log.reminderDue), "MMM d, HH:mm")}`}
                                {!log.isCompleted && (
                                  <Button variant="ghost" size="sm" className="h-5 ml-auto text-[10px] hover:text-green-400 px-1" onClick={() => completeReminder(log.id)}>
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Done
                                  </Button>
                                )}
                              </div>
                            )}

                            <div className="mt-1 text-[10px] text-zinc-600 text-right">{log.user || 'Admin'}</div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Lead Created Marker */}
                    <div className="relative pl-6">
                      <div className="absolute left-0 top-0 w-4 h-4 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full" />
                      </div>
                      <div className="pb-4">
                        <div className="text-zinc-500 text-xs">Lead Created</div>
                        <div className="text-[10px] text-zinc-700">{format(new Date(lead.created_at), "MMM d, yyyy")}</div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
