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
  ArrowRight, Trash2, Edit3, ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow, addDays, setHours, setMinutes, addHours } from "date-fns";

interface LeadCockpitProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New Lead' },
  { value: 'actioned', label: 'Actioned' },
  { value: 'docs_collected', label: 'Docs Collected' },
  { value: 'submitted_to_banks', label: 'Submitted to Banks' },
  { value: 'pre_approved', label: 'Pre-Approved' },
  { value: 'finance_approved', label: 'Finance Approved' },
  { value: 'validation_pending', label: 'Validations Pending' },
  { value: 'validated', label: 'Validated' },
  { value: 'contract_generated', label: 'Contract Generated' },
  { value: 'prepping_delivery', label: 'Prepping Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'declined', label: 'Declined' },
] as const;

const getStatusStyle = (status: string) => {
  const s = status?.toLowerCase() || 'new';
  if (s.includes('deliver') && !s.includes('prep')) return 'bg-green-600 text-white border-green-500';
  if (s.includes('prep')) return 'bg-green-900/30 text-green-400 border-green-800';
  if (s.includes('contract')) return 'bg-cyan-900/30 text-cyan-400 border-cyan-800';
  if (s.includes('validated') && !s.includes('pending')) return 'bg-emerald-900/30 text-emerald-400 border-emerald-800';
  if (s.includes('validation') || s.includes('pending')) return 'bg-orange-900/30 text-orange-400 border-orange-800';
  if (s.includes('approv')) return 'bg-yellow-900/30 text-yellow-400 border-yellow-800';
  if (s.includes('subm')) return 'bg-indigo-900/30 text-indigo-400 border-indigo-800';
  if (s.includes('doc')) return 'bg-purple-900/30 text-purple-400 border-purple-800';
  if (s.includes('actioned')) return 'bg-blue-900/30 text-blue-400 border-blue-800';
  if (s.includes('decline')) return 'bg-red-900/30 text-red-400 border-red-800';
  return 'bg-zinc-800 text-zinc-400 border-zinc-700';
};

const mapStatusToPipeline = (status: string) => {
  if (['submitted_to_banks'].includes(status)) return 'submitted';
  if (['pre_approved', 'finance_approved'].includes(status)) return 'approved';
  if (['validation_pending'].includes(status)) return 'validations';
  if (['validated'].includes(status)) return 'validated';
  if (['contract_generated', 'contract_signed'].includes(status)) return 'contract';
  if (['prepping_delivery', 'delivered'].includes(status)) return 'delivery';
  if (['docs_collected'].includes(status)) return 'finance';
  if (['actioned'].includes(status)) return 'contacted';
  if (['declined'].includes(status)) return 'cold';
  return 'new';
};

export const LeadCockpit = ({ leadId, isOpen, onClose, onUpdate }: LeadCockpitProps) => {
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [noteText, setNoteText] = useState("");
  const [inputType, setInputType] = useState<'note' | 'call' | 'reminder'>('note');
  const [reminderPreset, setReminderPreset] = useState("tomorrow_9");
  const [headline, setHeadline] = useState("");

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

          const fullLead = {
            ...leadData,
            id_number: leadData.id_number || appData?.id_number,
            linkedApp: appData,
          };
          setLead(fullLead);
          setHeadline((fullLead as any).deal_headline || "");
        }
        setLoading(false);
      };
      fetchLead();
    }
  }, [leadId, isOpen]);

  const saveHeadline = async () => {
    if (!lead) return;
    await supabase.from('leads').update({ deal_headline: headline } as any).eq('id', leadId!);
    toast.success("Context saved");
    onUpdate();
  };

  const updateStatus = async (newStatus: string) => {
    const pipelineStage = mapStatusToPipeline(newStatus);
    await supabase.from('leads').update({
      pipeline_stage: pipelineStage,
      status: newStatus,
      status_updated_at: new Date().toISOString(),
    }).eq('id', leadId!);

    if (lead.linkedApp) {
      await supabase.from('finance_applications').update({ status: newStatus }).eq('id', lead.linkedApp.id);
    }

    setLead((prev: any) => ({ ...prev, status: newStatus, pipeline_stage: pipelineStage }));
    toast.success(`Status → ${newStatus.replace(/_/g, ' ').toUpperCase()}`);
    onUpdate();
  };

  const updateField = async (field: string, value: any) => {
    const { error } = await supabase.from('leads').update({ [field]: value }).eq('id', leadId!);
    if (!error) setLead((prev: any) => ({ ...prev, [field]: value }));
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
    }).eq('id', leadId!);

    if (!error) {
      setLead((prev: any) => ({ ...prev, activity_log: updatedLogs }));
      setNoteText("");
      toast.success("Activity logged");
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
    await supabase.from('leads').update({ is_archived: true }).eq('id', leadId!);
    toast.success("Lead archived");
    onClose();
    onUpdate();
  };

  if (!lead) return null;

  const currentStatus = lead.linkedApp?.status || lead.status || 'new';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-[95vw] lg:max-w-[85vw] p-0 bg-zinc-950 text-white border-zinc-800 overflow-hidden">
        <div className="flex flex-col h-full">

          {/* --- HEADER --- */}
          <div className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur px-6 py-4">
            <div className="flex items-start gap-4">

              {/* LEFT: IDENTITY */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {lead.client_name?.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">{lead.client_name}</h2>
                    {/* STATUS DROPDOWN */}
                    <Select value={currentStatus} onValueChange={updateStatus}>
                      <SelectTrigger className={`h-6 text-[10px] font-bold uppercase border rounded-full px-2.5 py-0.5 w-auto gap-1 inline-flex items-center justify-center ${getStatusStyle(currentStatus)}`}>
                        <span className="leading-none">{currentStatus.replace(/_/g, ' ')}</span>
                        <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700 text-white z-[9999]">
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${getStatusStyle(opt.value).split(' ')[0]}`} />
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-zinc-500">{lead.client_phone}</span>
                    {lead.id_number && <span className="text-[10px] text-zinc-600">ID: {lead.id_number}</span>}
                  </div>
                </div>
              </div>

              {/* DIVIDER */}
              <div className="w-px self-stretch bg-zinc-800 mx-2 shrink-0" />

              {/* CENTER: WRAPPABLE TEXTAREA */}
              <div className="relative flex-1 min-w-0">
                <Edit3 className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
                <textarea
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  onBlur={saveHeadline}
                  rows={1}
                  className="pl-8 pr-3 py-2 min-h-[2.5rem] w-full text-xs font-medium bg-zinc-950/50 border border-zinc-800 rounded-md text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-800 resize-none leading-snug break-words"
                  placeholder="Add Context (e.g. Urgent - BMW M4 - Needs delivery by Friday)"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />
              </div>

              {/* RIGHT: ACTIONS */}
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-red-400 text-xs h-7" onClick={archiveLead}>
                  <Trash2 className="w-3 h-3 mr-1" /> Archive
                </Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-xs h-7 whitespace-nowrap">
                  Convert <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>

          {/* --- MAIN GRID --- */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">

            {/* COL 1: DATA (40%) */}
            <div className="md:col-span-5 border-r border-zinc-800 bg-zinc-900/10 overflow-y-auto">
              <div className="p-5 space-y-5">

                {/* Contact Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="justify-start border-zinc-800 text-emerald-400 hover:bg-emerald-950/30 text-xs h-8" onClick={() => openWhatsApp('intro')}>
                    <MessageCircle className="w-3.5 h-3.5 mr-2" /> WhatsApp
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start border-zinc-800 text-blue-400 hover:bg-blue-950/30 text-xs h-8" onClick={() => window.open(`tel:${lead.client_phone}`)}>
                    <Phone className="w-3.5 h-3.5 mr-2" /> Call
                  </Button>
                </div>

                <Separator className="bg-zinc-800" />

                {/* Vehicle Interest */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2 flex items-center gap-1.5">
                    <CarFront className="w-3.5 h-3.5" /> Vehicle Interest
                  </h3>
                  <div className="bg-black/40 p-3 rounded border border-zinc-800">
                    {lead.linkedApp?.vehicles ? (
                      <div>
                        <p className="text-sm font-bold text-white">{lead.linkedApp.vehicles.year} {lead.linkedApp.vehicles.make} {lead.linkedApp.vehicles.model}</p>
                        <p className="text-[10px] text-zinc-500 font-mono mt-1">{lead.linkedApp.vehicles.registration_number || 'No reg #'}</p>
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-600 italic">No vehicle linked</div>
                    )}
                  </div>
                </div>

                <Separator className="bg-zinc-800" />

                {/* Trade-In */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2">Trade-In</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase">Vehicle</label>
                      <Input value={lead.trade_in_make_model || ''} onBlur={(e) => updateField('trade_in_make_model', e.target.value)} onChange={(e) => setLead((p: any) => ({ ...p, trade_in_make_model: e.target.value }))} className="bg-zinc-950 border-zinc-800 h-8 text-xs" placeholder="e.g. 2015 VW Polo" />
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

                {/* Client Details */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2">Client Details</h3>
                  <Input value={lead.client_email || ''} onBlur={(e) => updateField('client_email', e.target.value)} onChange={(e) => setLead((p: any) => ({ ...p, client_email: e.target.value }))} placeholder="Email" className="bg-zinc-950 border-zinc-800 h-8 text-xs" />
                  <Input value={lead.id_number || ''} onBlur={(e) => updateField('id_number', e.target.value)} onChange={(e) => setLead((p: any) => ({ ...p, id_number: e.target.value }))} placeholder="ID Number" className="bg-zinc-950 border-zinc-800 h-8 text-xs" />
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase">Heat Level</label>
                    <Select value={lead.lead_temperature || 'warm'} onValueChange={(v) => updateField('lead_temperature', v)}>
                      <SelectTrigger className="bg-zinc-950 border-zinc-800 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white z-[9999]">
                        <SelectItem value="cold">❄️ Cold</SelectItem>
                        <SelectItem value="warm">🟠 Warm</SelectItem>
                        <SelectItem value="hot">🔥 Hot</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* COL 2: THE BRAIN (60%) */}
            <div className="md:col-span-7 flex flex-col bg-zinc-950">

              {/* Input Zone */}
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex gap-1 mb-3">
                  <Button variant={inputType === 'note' ? 'default' : 'ghost'} size="sm" onClick={() => setInputType('note')} className="h-7 text-xs font-bold px-3">
                    <StickyNote className="w-3 h-3 mr-1" /> Note
                  </Button>
                  <Button variant={inputType === 'call' ? 'default' : 'ghost'} size="sm" onClick={() => setInputType('call')} className="h-7 text-xs font-bold px-3">
                    <Phone className="w-3 h-3 mr-1" /> Log Call
                  </Button>
                  <Button variant={inputType === 'reminder' ? 'default' : 'ghost'} size="sm" onClick={() => setInputType('reminder')} className="h-7 text-xs font-bold px-3">
                    <Bell className="w-3 h-3 mr-1" /> Remind
                  </Button>
                </div>

                <div className="relative">
                  <Textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder={inputType === 'call' ? "Log call outcome..." : inputType === 'reminder' ? "What should I remind you about?" : "Add internal note..."}
                    className="min-h-[100px] bg-zinc-950 border-zinc-800 text-sm resize-none focus-visible:ring-blue-600 p-4 pb-12"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addActivity(); } }}
                  />
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    {inputType === 'reminder' && (
                      <Select value={reminderPreset} onValueChange={setReminderPreset}>
                        <SelectTrigger className="h-6 w-[120px] bg-zinc-900 border-zinc-700 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-white z-[9999]">
                          <SelectItem value="1hr">In 1 Hour</SelectItem>
                          <SelectItem value="3hr">In 3 Hours</SelectItem>
                          <SelectItem value="tomorrow_9">Tomorrow 09:00</SelectItem>
                          <SelectItem value="tomorrow_14">Tomorrow 14:00</SelectItem>
                          <SelectItem value="2days">In 2 Days</SelectItem>
                          <SelectItem value="next_week">Next Week</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-500 h-7 text-xs font-bold" onClick={addActivity}>
                      Save
                    </Button>
                  </div>
                </div>
              </div>

              {/* History Stream */}
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6 max-w-3xl mx-auto">
                  {(lead.activity_log || []).map((log: any, idx: number) => {
                    const isCall = log.type === 'call';
                    const isReminder = log.type === 'reminder';
                    return (
                      <div key={log.id || idx} className="flex gap-4 group">
                        <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${isCall ? 'bg-green-500' : isReminder ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                        <div className="flex-1 pb-4 border-b border-zinc-900 last:border-0">
                          <div className="flex justify-between mb-1">
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
                          <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{log.text}</p>
                          {isReminder && log.reminderDue && (
                            <div className="mt-2 flex items-center gap-3">
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
                  <div className="text-center text-xs text-zinc-700 pt-8">
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
