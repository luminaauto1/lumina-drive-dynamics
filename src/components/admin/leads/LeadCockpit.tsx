import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageCircle, Phone, Clock, CarFront, FileText,
  StickyNote, Bell, CheckCircle2, Calculator, ExternalLink,
  ArrowRight, Trash2, Edit3, ChevronDown, User, Search
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/formatters";
import { format, formatDistanceToNow, addDays, setHours, setMinutes, addHours } from "date-fns";

const calculatePMT = (principal: number, annualRate: number, months: number, balloonAmount: number = 0): number => {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate === 0) return (principal - balloonAmount) / months;
  const monthlyRate = annualRate / 100 / 12;
  const pvBalloon = balloonAmount / Math.pow(1 + monthlyRate, months);
  const adjusted = principal - pvBalloon;
  return Math.round(adjusted * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1));
};

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
  { value: 'lost', label: 'Lost / Dead' },
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
  if (s.includes('lost') || s.includes('dead')) return 'bg-zinc-900/50 text-zinc-500 border-zinc-700';
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
  if (['lost'].includes(status)) return 'lost';
  return 'new';
};

export const LeadCockpit = ({ leadId, isOpen, onClose, onUpdate }: LeadCockpitProps) => {
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Activity state
  const [noteText, setNoteText] = useState("");
  const [inputType, setInputType] = useState<'note' | 'call' | 'reminder'>('note');
  const [reminderPreset, setReminderPreset] = useState("tomorrow_9");
  const [headline, setHeadline] = useState("");

  // Calculator state
  const [calcPrice, setCalcPrice] = useState(0);
  const [calcDeposit, setCalcDeposit] = useState(0);
  const [calcDepositPct, setCalcDepositPct] = useState(0);
  const [calcRate, setCalcRate] = useState(13.25);
  const [calcTerm, setCalcTerm] = useState(72);
  const [calcBalloonPct, setCalcBalloonPct] = useState(0);
  const [calcInitiationFee, setCalcInitiationFee] = useState(1207.50);
  const [calcMonthlyFee, setCalcMonthlyFee] = useState(69);

  // Background extras toggles
  const [extras, setExtras] = useState({
    adminFee: { enabled: false, value: 4500 },
    license: { enabled: false, value: 2500 },
    warranty: { enabled: false, value: 8000 },
    bankFees: { enabled: true, value: 0 }, // "Std" means use initiation+monthly
  });

  // Derived calculation (instant)
  const bgExtrasTotal =
    (extras.adminFee.enabled ? extras.adminFee.value : 0) +
    (extras.license.enabled ? extras.license.value : 0) +
    (extras.warranty.enabled ? extras.warranty.value : 0);
  const effectiveInitiation = extras.bankFees.enabled ? calcInitiationFee : 0;
  const effectiveMonthly = extras.bankFees.enabled ? calcMonthlyFee : 0;
  const principal = Math.max(0, calcPrice + bgExtrasTotal + effectiveInitiation - calcDeposit);
  const balloonValue = Math.round(calcPrice * (calcBalloonPct / 100));
  const basePmt = calculatePMT(principal, calcRate, calcTerm, balloonValue);
  const finalInstallment = basePmt + effectiveMonthly;

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
          const fullLead = { ...leadData, id_number: leadData.id_number || appData?.id_number, linkedApp: appData };
          setLead(fullLead);
          setHeadline((fullLead as any).deal_headline || "");
          if (appData?.vehicles?.price) setCalcPrice(Number(appData.vehicles.price));
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
    await supabase.from('leads').update({ pipeline_stage: pipelineStage, status: newStatus, status_updated_at: new Date().toISOString() }).eq('id', leadId!);
    if (lead.linkedApp) await supabase.from('finance_applications').update({ status: newStatus }).eq('id', lead.linkedApp.id);
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
    const newLog = { id: Date.now().toString(), type: inputType, text: noteText, date: new Date().toISOString(), user: 'Admin', reminderDue: finalDate, isCompleted: false };
    const updatedLogs = [newLog, ...(lead.activity_log || [])];
    const { error } = await supabase.from('leads').update({ activity_log: updatedLogs, status_updated_at: new Date().toISOString() }).eq('id', leadId!);
    if (!error) { setLead((prev: any) => ({ ...prev, activity_log: updatedLogs })); setNoteText(""); toast.success("Activity logged"); }
  };

  const completeReminder = async (logId: string) => {
    const updatedLogs = (lead.activity_log || []).map((log: any) => log.id === logId ? { ...log, isCompleted: true } : log);
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
  const vehicle = lead.linkedApp?.vehicles;

  const getAutoTraderLink = () => {
    if (!vehicle) return "#";
    return `https://www.autotrader.co.za/cars-for-sale?year_min=2024&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}`;
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-[95vw] md:max-w-[1400px] p-0 bg-zinc-950 text-white border-zinc-800 overflow-hidden">
        <div className="flex flex-col h-full">

          {/* === HEADER BAR === */}
          <div className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur px-5 py-3 shrink-0">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Identity */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {lead.client_name?.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">{lead.client_name}</h2>
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

              <div className="w-px self-stretch bg-zinc-800 mx-1 shrink-0 hidden md:block" />

              {/* Headline */}
              <div className="relative flex-1 min-w-[200px]">
                <Edit3 className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
                <textarea
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  onBlur={saveHeadline}
                  rows={1}
                  className="pl-8 pr-3 py-2 min-h-[2.5rem] w-full text-xs font-medium bg-zinc-950/50 border border-zinc-800 rounded-md text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-800 resize-none leading-snug break-words"
                  placeholder="Deal context (e.g. Pre-approved R450k, wants M4 by Friday)"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" className="bg-emerald-700 hover:bg-emerald-600 text-white h-9 px-4 text-xs font-bold gap-1.5" onClick={() => openWhatsApp('intro')}>
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </Button>
                <Button variant="outline" size="sm" className="border-zinc-700 text-blue-400 hover:bg-blue-950/30 h-9 px-4 text-xs font-bold gap-1.5" onClick={() => window.open(`tel:${lead.client_phone}`)}>
                  <Phone className="w-4 h-4" /> Call
                </Button>
                <Button variant="outline" size="sm" className="border-zinc-700 h-9 text-xs gap-1.5" onClick={() => navigate(`/admin/clients/${lead.linkedApp?.user_id || leadId}`)} disabled={!lead.linkedApp}>
                  <User className="w-3.5 h-3.5" /> File
                </Button>
                <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-red-400 text-xs h-9" onClick={archiveLead}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* === SPLIT SCREEN BODY === */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">

            {/* ─── LEFT COLUMN: CLERK SIDE (35%) ─── */}
            <div className="md:col-span-5 lg:col-span-4 border-r border-zinc-800 flex flex-col overflow-hidden">
              {/* Live Notepad */}
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
                <div className="flex gap-1 mb-2">
                  <Button variant={inputType === 'note' ? 'default' : 'ghost'} size="sm" onClick={() => setInputType('note')} className="h-7 text-xs font-bold px-3">
                    <StickyNote className="w-3 h-3 mr-1" /> Note
                  </Button>
                  <Button variant={inputType === 'call' ? 'default' : 'ghost'} size="sm" onClick={() => setInputType('call')} className="h-7 text-xs font-bold px-3">
                    <Phone className="w-3 h-3 mr-1" /> Call
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
                    className="min-h-[120px] bg-zinc-950 border-zinc-800 text-sm resize-none focus-visible:ring-blue-600 p-4 pb-12"
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
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-500 h-7 text-xs font-bold" onClick={addActivity}>Save</Button>
                  </div>
                </div>
              </div>

              {/* Activity History */}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Activity Stream</h3>
                  {(lead.activity_log || []).map((log: any, idx: number) => {
                    const isCall = log.type === 'call';
                    const isReminder = log.type === 'reminder';
                    return (
                      <div key={log.id || idx} className="flex gap-3 group">
                        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isCall ? 'bg-green-500' : isReminder ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                        <div className="flex-1 pb-3 border-b border-zinc-900/50 last:border-0">
                          <div className="flex justify-between mb-0.5">
                            <span className={`text-[10px] font-bold uppercase ${isCall ? 'text-green-400' : isReminder ? 'text-yellow-400' : 'text-blue-400'}`}>{log.type}</span>
                            <span className="text-[10px] text-zinc-600 font-mono">{formatDistanceToNow(new Date(log.date), { addSuffix: true })}</span>
                          </div>
                          <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{log.text}</p>
                          {isReminder && log.reminderDue && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <Badge variant="outline" className={`border-zinc-700 text-[10px] ${log.isCompleted ? 'text-green-500 bg-green-950/20' : 'text-yellow-500 bg-yellow-950/20'}`}>
                                <Clock className="w-3 h-3 mr-1" />
                                {log.isCompleted ? "Done" : `Due: ${format(new Date(log.reminderDue), "EEE, d MMM @ HH:mm")}`}
                              </Badge>
                              {!log.isCompleted && (
                                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-green-400 hover:text-green-300 px-1" onClick={() => completeReminder(log.id)}>
                                  <CheckCircle2 className="w-3 h-3 mr-0.5" /> Done
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-center text-[10px] text-zinc-700 pt-4">
                    {lead.created_at ? `Lead created ${format(new Date(lead.created_at), "MMM d, yyyy")}` : 'Start of history'}
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* ─── RIGHT COLUMN: DEAL SIDE (65%) ─── */}
            <div className="md:col-span-7 lg:col-span-8 overflow-y-auto bg-zinc-950">
              <div className="p-6 space-y-6 max-w-3xl mx-auto">

                {/* === THE BIG BOARD: INSTALLMENT === */}
                <Card className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-black border-zinc-800 p-8 text-center relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-cyan-500" />
                  <p className="text-zinc-500 text-xs uppercase tracking-[0.2em] font-bold mb-2">Estimated Monthly Installment</p>
                  <div className="text-5xl md:text-6xl font-black text-white tracking-tighter font-mono">
                    R {Math.round(finalInstallment).toLocaleString()}
                    <span className="text-xl text-zinc-600 font-normal ml-1">/pm</span>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-zinc-500">
                    <span>Principal: {formatPrice(principal)}</span>
                    <span className="text-zinc-700">•</span>
                    <span>Balloon: {formatPrice(balloonValue)}</span>
                    {effectiveMonthly > 0 && (
                      <>
                        <span className="text-zinc-700">•</span>
                        <span>Incl. R{effectiveMonthly} service fee</span>
                      </>
                    )}
                  </div>
                </Card>

                {/* === MAIN INPUTS === */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Vehicle Price */}
                  <Card className="bg-zinc-900/50 border-zinc-800 p-4 space-y-2">
                    <Label className="text-xs text-zinc-400 font-semibold">Vehicle Price</Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-zinc-500 font-bold">R</span>
                      <Input type="number" value={calcPrice || ''} onChange={e => setCalcPrice(Number(e.target.value) || 0)} className="bg-zinc-950 border-zinc-800 h-11 text-lg font-mono font-bold" placeholder="0" />
                    </div>
                  </Card>

                  {/* Deposit */}
                  <Card className="bg-zinc-900/50 border-zinc-800 p-4 space-y-2">
                    <Label className="text-xs text-zinc-400 font-semibold">Deposit ({calcDepositPct}%)</Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-zinc-500 font-bold">R</span>
                      <Input type="number" value={calcDeposit || ''} onChange={e => { const v = Number(e.target.value) || 0; setCalcDeposit(v); if (calcPrice > 0) setCalcDepositPct(Math.round((v / calcPrice) * 100)); }} className="bg-zinc-950 border-zinc-800 h-11 text-lg font-mono font-bold" placeholder="0" />
                    </div>
                    <Slider value={[calcDepositPct]} onValueChange={v => { setCalcDepositPct(v[0]); setCalcDeposit(Math.round(calcPrice * (v[0] / 100))); }} min={0} max={50} step={5} />
                  </Card>
                </div>

                {/* Rate / Term / Balloon */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-zinc-900/50 border-zinc-800 p-4 space-y-2">
                    <Label className="text-xs text-zinc-400 font-semibold">Interest Rate (%)</Label>
                    <Input type="number" value={calcRate} onChange={e => setCalcRate(Number(e.target.value) || 0)} className="bg-zinc-950 border-zinc-800 h-11 text-lg font-mono font-bold" step={0.25} min={7} max={25} />
                    <Slider value={[calcRate]} onValueChange={v => setCalcRate(v[0])} min={7} max={25} step={0.25} />
                  </Card>
                  <Card className="bg-zinc-900/50 border-zinc-800 p-4 space-y-2">
                    <Label className="text-xs text-zinc-400 font-semibold">Term (Months)</Label>
                    <Input type="number" value={calcTerm} onChange={e => setCalcTerm(Number(e.target.value) || 72)} className="bg-zinc-950 border-zinc-800 h-11 text-lg font-mono font-bold" step={12} min={12} max={96} />
                    <Slider value={[calcTerm]} onValueChange={v => setCalcTerm(v[0])} min={12} max={96} step={12} />
                  </Card>
                  <Card className="bg-zinc-900/50 border-zinc-800 p-4 space-y-2">
                    <Label className="text-xs text-zinc-400 font-semibold">Balloon ({calcBalloonPct}%)</Label>
                    <Input type="number" value={calcBalloonPct} onChange={e => setCalcBalloonPct(Number(e.target.value) || 0)} className="bg-zinc-950 border-zinc-800 h-11 text-lg font-mono font-bold" min={0} max={50} />
                    <Slider value={[calcBalloonPct]} onValueChange={v => setCalcBalloonPct(v[0])} min={0} max={50} step={5} />
                    <p className="text-[10px] text-zinc-600">{formatPrice(balloonValue)} (on base price)</p>
                  </Card>
                </div>

                {/* === BACKGROUND FEE TOGGLES === */}
                <Card className="bg-zinc-900/30 border-zinc-800 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-zinc-500" />
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Background Fees (Hidden from Client)</h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Admin Fee */}
                    <div className={`rounded-lg border p-3 transition-colors ${extras.adminFee.enabled ? 'border-blue-700 bg-blue-950/20' : 'border-zinc-800 bg-zinc-950/50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-[11px] text-zinc-400 font-semibold">Admin Fee</Label>
                        <Switch checked={extras.adminFee.enabled} onCheckedChange={v => setExtras(p => ({ ...p, adminFee: { ...p.adminFee, enabled: v } }))} />
                      </div>
                      <Input type="number" value={extras.adminFee.value} onChange={e => setExtras(p => ({ ...p, adminFee: { ...p.adminFee, value: Number(e.target.value) || 0 } }))} className="bg-zinc-950 border-zinc-800 h-8 text-xs font-mono" disabled={!extras.adminFee.enabled} />
                    </div>

                    {/* License */}
                    <div className={`rounded-lg border p-3 transition-colors ${extras.license.enabled ? 'border-blue-700 bg-blue-950/20' : 'border-zinc-800 bg-zinc-950/50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-[11px] text-zinc-400 font-semibold">License</Label>
                        <Switch checked={extras.license.enabled} onCheckedChange={v => setExtras(p => ({ ...p, license: { ...p.license, enabled: v } }))} />
                      </div>
                      <Input type="number" value={extras.license.value} onChange={e => setExtras(p => ({ ...p, license: { ...p.license, value: Number(e.target.value) || 0 } }))} className="bg-zinc-950 border-zinc-800 h-8 text-xs font-mono" disabled={!extras.license.enabled} />
                    </div>

                    {/* Warranty */}
                    <div className={`rounded-lg border p-3 transition-colors ${extras.warranty.enabled ? 'border-blue-700 bg-blue-950/20' : 'border-zinc-800 bg-zinc-950/50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-[11px] text-zinc-400 font-semibold">Warranty</Label>
                        <Switch checked={extras.warranty.enabled} onCheckedChange={v => setExtras(p => ({ ...p, warranty: { ...p.warranty, enabled: v } }))} />
                      </div>
                      <Input type="number" value={extras.warranty.value} onChange={e => setExtras(p => ({ ...p, warranty: { ...p.warranty, value: Number(e.target.value) || 0 } }))} className="bg-zinc-950 border-zinc-800 h-8 text-xs font-mono" disabled={!extras.warranty.enabled} />
                    </div>

                    {/* Bank Fees (Std) */}
                    <div className={`rounded-lg border p-3 transition-colors ${extras.bankFees.enabled ? 'border-blue-700 bg-blue-950/20' : 'border-zinc-800 bg-zinc-950/50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-[11px] text-zinc-400 font-semibold">Bank Fees</Label>
                        <Switch checked={extras.bankFees.enabled} onCheckedChange={v => setExtras(p => ({ ...p, bankFees: { ...p.bankFees, enabled: v } }))} />
                      </div>
                      <p className="text-[10px] text-zinc-600">
                        Init: R{calcInitiationFee.toLocaleString()} + R{calcMonthlyFee}/pm
                      </p>
                    </div>
                  </div>

                  {bgExtrasTotal + effectiveInitiation > 0 && (
                    <p className="text-[10px] text-zinc-500 text-right">
                      Total added to principal: <span className="text-zinc-300 font-mono font-bold">{formatPrice(bgExtrasTotal + effectiveInitiation)}</span>
                    </p>
                  )}
                </Card>

                {/* === VEHICLE & MARKET CHECK === */}
                {vehicle && (
                  <Card className="bg-zinc-900/30 border-zinc-800 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <CarFront className="w-4 h-4 text-zinc-500" />
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Vehicle & Market</h3>
                    </div>
                    <div className="flex items-center gap-4 bg-black/40 rounded-lg p-3 border border-zinc-800">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                        {vehicle.variant && <p className="text-[10px] text-zinc-500">{vehicle.variant}</p>}
                        <div className="flex gap-4 mt-1 text-[10px] text-zinc-500">
                          <span>Price: {formatPrice(vehicle.price)}</span>
                          <span>{vehicle.mileage?.toLocaleString()} km</span>
                          <span>{vehicle.fuel_type}</span>
                        </div>
                      </div>
                      <Button className="bg-red-600 hover:bg-red-700 text-white font-bold h-10 px-5 text-xs gap-1.5 shrink-0" onClick={() => window.open(getAutoTraderLink(), '_blank')}>
                        <Search className="w-4 h-4" /> AutoTrader
                      </Button>
                    </div>
                    <p className="text-[10px] text-zinc-600 text-center">Opens AutoTrader filtered for 2024+ models</p>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
