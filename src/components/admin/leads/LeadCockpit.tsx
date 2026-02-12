import { useState, useEffect } from "react";
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
  MessageCircle, Phone, Clock, CarFront,
  StickyNote, Bell, CheckCircle2,
  ArrowRight, Trash2, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow, addDays, setHours, setMinutes, addHours } from "date-fns";

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
  const [reminderPreset, setReminderPreset] = useState("tomorrow_9");

  useEffect(() => {
    if (leadId && isOpen) {
      const fetchLead = async () => {
        setLoading(true);
        const { data: leadData } = await supabase.from('leads').select('*').eq('id', leadId).single();

        if (leadData) {
          const orFilters: string[] = [];
          if (leadData.client_email) orFilters.push(`email.eq.${leadData.client_email}`);
          if (leadData.client_phone) orFilters.push(`phone.eq.${leadData.client_phone}`);

          let appData = null;
          if (orFilters.length > 0) {
            const { data } = await supabase
              .from('finance_applications')
              .select('*, vehicles:vehicles!finance_applications_selected_vehicle_id_fkey(*)')
              .or(orFilters.join(','))
              .maybeSingle();
            appData = data;
          }

          setLead({
            ...leadData,
            id_number: leadData.id_number || appData?.id_number,
            linkedApp: appData,
          });
        }
        setLoading(false);
      };
      fetchLead();
    }
  }, [leadId, isOpen]);

  const getClientSummary = () => {
    if (!lead) return "Loading...";
    const parts: string[] = [];
    if (lead.linkedApp?.vehicles) {
      parts.push(`Wants a ${lead.linkedApp.vehicles.year} ${lead.linkedApp.vehicles.model}`);
    } else if (lead.notes) {
      parts.push(`Interested in: "${lead.notes.substring(0, 30)}..."`);
    } else {
      parts.push("Looking for a vehicle");
    }
    if (lead.desired_deposit > 0) {
      parts.push(`with a R${Number(lead.desired_deposit).toLocaleString()} deposit`);
    }
    if (lead.desired_term) {
      parts.push(`over ${lead.desired_term} months`);
    }
    if (lead.trade_in_make_model) {
      const equity = (lead.trade_in_estimated_value || 0);
      parts.push(`. Trading in ${lead.trade_in_make_model} (Est. R${Number(equity).toLocaleString()})`);
    }
    if (lead.pipeline_stage === 'approved') parts.push(". FINANCE APPROVED.");
    return parts.join(" ");
  };

  const calculateReminderDate = (preset: string) => {
    const now = new Date();
    switch (preset) {
      case '1hr': return addHours(now, 1).toISOString();
      case '3hr': return addHours(now, 3).toISOString();
      case 'tomorrow_9': return setMinutes(setHours(addDays(now, 1), 9), 0).toISOString();
      case 'tomorrow_14': return setMinutes(setHours(addDays(now, 1), 14), 0).toISOString();
      case '2days': return setMinutes(setHours(addDays(now, 2), 9), 0).toISOString();
      case 'next_week': return setMinutes(setHours(addDays(now, 7), 9), 0).toISOString();
      default: return new Date().toISOString();
    }
  };

  const updateField = async (field: string, value: any) => {
    const { error } = await supabase.from('leads').update({ [field]: value }).eq('id', leadId);
    if (!error) setLead((prev: any) => ({ ...prev, [field]: value }));
  };

  const addActivity = async () => {
    if (!noteText.trim()) return;
    const finalDate = inputType === 'reminder' ? calculateReminderDate(reminderPreset) : null;
    const newLog = {
      id: Date.now().toString(),
      type: inputType,
      text: noteText,
      date: new Date().toISOString(),
      user: 'Admin',
      reminderDue: finalDate,
      isCompleted: false,
    };
    const updatedLogs = [newLog, ...(lead.activity_log || [])];
    const { error } = await supabase.from('leads').update({
      activity_log: updatedLogs,
      status_updated_at: new Date().toISOString(),
    }).eq('id', leadId);

    if (!error) {
      setLead((prev: any) => ({ ...prev, activity_log: updatedLogs }));
      setNoteText("");
      toast.success(`${inputType.charAt(0).toUpperCase() + inputType.slice(1)} logged`);
    }
  };

  const completeReminder = async (logId: string) => {
    const updatedLogs = (lead.activity_log || []).map((log: any) =>
      log.id === logId ? { ...log, isCompleted: true } : log
    );
    await updateField('activity_log', updatedLogs);
    toast.success("Reminder cleared");
  };

  const openWhatsApp = (template: string) => {
    const phone = lead.client_phone?.replace(/\D/g, '');
    let msg = "";
    if (template === 'intro') msg = `Hi ${lead.client_name}, Albert from Lumina here. I saw your inquiry. Do you have a moment?`;
    if (template === 'docs') msg = `Hi ${lead.client_name}, please send ID, License, and 3 months bank statements.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const archiveLead = async () => {
    await supabase.from('leads').update({ is_archived: true }).eq('id', leadId);
    toast.success("Lead archived");
    onClose();
    onUpdate();
  };

  if (!lead) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-[95vw] lg:max-w-[85vw] p-0 bg-zinc-950 text-white border-zinc-800 overflow-hidden">
        <div className="flex flex-col h-full">

          {/* --- 1. AI HEADER --- */}
          <div className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-lg font-bold shrink-0">
                  {lead.client_name?.charAt(0) || '?'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold truncate">{lead.client_name || 'Unknown'}</h2>
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400 shrink-0">
                      {lead.pipeline_stage?.replace(/_/g, ' ') || 'New Lead'}
                    </Badge>
                  </div>
                  <div className="flex items-start gap-1.5 text-xs text-zinc-400">
                    <Sparkles className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
                    <span className="text-zinc-300 leading-relaxed">{getClientSummary()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-red-400 text-xs h-7" onClick={archiveLead}>
                  <Trash2 className="w-3 h-3 mr-1" /> Archive
                </Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-xs h-7">
                  Convert to Application <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>

          {/* --- 2. MAIN GRID --- */}
          <div className="flex-1 flex overflow-hidden">

            {/* COL 1: DATA (40%) */}
            <div className="w-[40%] border-r border-zinc-800 overflow-y-auto">
              <div className="p-5 space-y-5">

                {/* Contact Buttons */}
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" className="justify-start border-zinc-800 text-emerald-400 hover:bg-emerald-950/30 text-xs h-8" onClick={() => openWhatsApp('intro')}>
                    <MessageCircle className="w-3.5 h-3.5 mr-2" /> Intro Message
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start border-zinc-800 text-emerald-400 hover:bg-emerald-950/30 text-xs h-8" onClick={() => openWhatsApp('docs')}>
                    <MessageCircle className="w-3.5 h-3.5 mr-2" /> Request Docs
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start border-zinc-800 text-blue-400 hover:bg-blue-950/30 text-xs h-8" onClick={() => window.open(`tel:${lead.client_phone}`)}>
                    <Phone className="w-3.5 h-3.5 mr-2" /> Call {lead.client_phone}
                  </Button>
                </div>

                <Separator className="bg-zinc-800" />

                {/* Deal Structure */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CarFront className="w-3.5 h-3.5" /> Deal Structure
                  </h3>

                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase">Interested In</label>
                    {lead.linkedApp?.vehicles ? (
                      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                        <p className="text-sm font-bold">{lead.linkedApp.vehicles.year} {lead.linkedApp.vehicles.make} {lead.linkedApp.vehicles.model}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{lead.linkedApp.vehicles.registration_number || 'No reg #'}</p>
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-600 italic">No vehicle linked</div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase">Trade-In Vehicle</label>
                      <Input value={lead.trade_in_make_model || ''} onBlur={(e) => updateField('trade_in_make_model', e.target.value)} onChange={(e) => setLead((p: any) => ({ ...p, trade_in_make_model: e.target.value }))} className="bg-zinc-950 border-zinc-800 h-8 text-xs" placeholder="e.g. 2018 VW Polo" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase">Est. Value (R)</label>
                        <Input value={lead.trade_in_estimated_value || ''} onBlur={(e) => updateField('trade_in_estimated_value', e.target.value)} onChange={(e) => setLead((p: any) => ({ ...p, trade_in_estimated_value: e.target.value }))} className="bg-zinc-950 border-zinc-800 h-8 text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase">Mileage</label>
                        <Input value={lead.trade_in_mileage || ''} onBlur={(e) => updateField('trade_in_mileage', e.target.value)} onChange={(e) => setLead((p: any) => ({ ...p, trade_in_mileage: e.target.value }))} className="bg-zinc-950 border-zinc-800 h-8 text-xs" />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="bg-zinc-800" />

                {/* Identity */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Identity</h3>
                  <Input value={lead.client_email || ''} onBlur={(e) => updateField('client_email', e.target.value)} onChange={(e) => setLead((p: any) => ({ ...p, client_email: e.target.value }))} placeholder="Email Address" className="bg-zinc-950 border-zinc-800 h-9 text-xs" />
                  <Input value={lead.id_number || ''} onBlur={(e) => updateField('id_number', e.target.value)} onChange={(e) => setLead((p: any) => ({ ...p, id_number: e.target.value }))} placeholder="ID Number" className="bg-zinc-950 border-zinc-800 h-9 text-xs" />
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase">Heat Level</label>
                    <Select value={lead.lead_temperature || 'warm'} onValueChange={(v) => updateField('lead_temperature', v)}>
                      <SelectTrigger className="bg-zinc-950 border-zinc-800 h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                        <SelectItem value="cold">❄️ Cold</SelectItem>
                        <SelectItem value="warm">🟠 Warm</SelectItem>
                        <SelectItem value="hot">🔥 Hot</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* COL 2: BRAIN (60%) */}
            <div className="flex-1 flex flex-col bg-zinc-950">

              {/* Input Zone */}
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex gap-1 mb-3">
                  <Button variant={inputType === 'note' ? 'default' : 'ghost'} size="sm" onClick={() => setInputType('note')} className="h-7 text-xs px-4">
                    <StickyNote className="w-3 h-3 mr-1" /> Note
                  </Button>
                  <Button variant={inputType === 'call' ? 'default' : 'ghost'} size="sm" onClick={() => setInputType('call')} className="h-7 text-xs px-4">
                    <Phone className="w-3 h-3 mr-1" /> Call
                  </Button>
                  <Button variant={inputType === 'reminder' ? 'default' : 'ghost'} size="sm" onClick={() => setInputType('reminder')} className="h-7 text-xs px-4">
                    <Bell className="w-3 h-3 mr-1" /> Remind
                  </Button>
                </div>

                <div className="relative">
                  <Textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder={inputType === 'call' ? "Log call outcome..." : inputType === 'reminder' ? "What should I remind you about?" : "Add an internal note..."}
                    className="min-h-[100px] bg-zinc-950 border-zinc-800 text-sm resize-none focus-visible:ring-blue-600 p-4 pb-14"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addActivity(); } }}
                  />
                  <div className="absolute bottom-3 right-3 flex items-center gap-3">
                    {inputType === 'reminder' && (
                      <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded border border-zinc-700">
                        <Clock className="w-3 h-3 text-yellow-500 ml-1" />
                        <Select value={reminderPreset} onValueChange={setReminderPreset}>
                          <SelectTrigger className="h-6 w-[140px] border-0 bg-transparent text-[10px] focus:ring-0 p-0 px-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                            <SelectItem value="1hr">In 1 Hour</SelectItem>
                            <SelectItem value="3hr">In 3 Hours</SelectItem>
                            <SelectItem value="tomorrow_9">Tomorrow Morning (09:00)</SelectItem>
                            <SelectItem value="tomorrow_14">Tomorrow Afternoon (14:00)</SelectItem>
                            <SelectItem value="2days">In 2 Days</SelectItem>
                            <SelectItem value="next_week">Next Week</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-500 h-8 px-4 font-bold" onClick={addActivity}>
                      Save {inputType}
                    </Button>
                  </div>
                </div>
              </div>

              {/* History Stream */}
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-8 max-w-3xl mx-auto">
                  {(lead.activity_log || []).map((log: any, idx: number) => {
                    const isCall = log.type === 'call';
                    const isReminder = log.type === 'reminder';
                    return (
                      <div key={log.id || idx} className="relative pl-8 group">
                        <div className="absolute left-[11px] top-6 bottom-[-32px] w-[2px] bg-zinc-800 group-last:hidden" />
                        <div className={`absolute left-0 top-0 w-6 h-6 rounded-full border-4 border-zinc-950 flex items-center justify-center z-10 shadow-lg
                          ${isCall ? 'bg-green-600' : isReminder ? 'bg-yellow-600' : 'bg-blue-600'}`}>
                          {isCall ? <Phone className="w-3 h-3 text-white" /> : isReminder ? <Bell className="w-3 h-3 text-white" /> : <StickyNote className="w-3 h-3 text-white" />}
                        </div>
                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-lg p-4 hover:bg-zinc-900 hover:border-zinc-700 transition-all">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold uppercase ${isCall ? 'text-green-400' : isReminder ? 'text-yellow-400' : 'text-blue-400'}`}>
                                {log.type}
                              </span>
                              <span className="text-[10px] text-zinc-500">• {log.user || 'Admin'}</span>
                            </div>
                            <span className="text-[10px] text-zinc-600 font-mono">
                              {formatDistanceToNow(new Date(log.date), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{log.text}</p>
                          {isReminder && log.reminderDue && (
                            <div className="mt-3 flex items-center gap-3">
                              <Badge variant="outline" className={`border-zinc-700 ${log.isCompleted ? 'text-green-500 bg-green-950/20' : 'text-yellow-500 bg-yellow-950/20'}`}>
                                <Clock className="w-3 h-3 mr-1" />
                                {log.isCompleted ? "Done" : `Due: ${format(new Date(log.reminderDue), "EEE, d MMM @ HH:mm")}`}
                              </Badge>
                              {!log.isCompleted && (
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-green-400 hover:text-green-300" onClick={() => completeReminder(log.id)}>
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Done
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-center text-xs text-zinc-600 italic pt-10">
                    {lead.created_at ? `Lead created ${format(new Date(lead.created_at), "MMM d, yyyy")}` : 'Start of history'}
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
