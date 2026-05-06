import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Clock, Car, User, FileText, Calculator, Copy, Check, Plus, X, Eye, Trophy, Trash2 } from 'lucide-react';
import LiveCallCopilot from './LiveCallCopilot';

interface UniversalClientHubProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientEmail?: string;
  clientPhone?: string;
}

const getCardBorderClass = (status: string) => {
  const green = ['approved', 'delivered', 'finalized', 'qualified', 'converted'];
  const red = ['declined', 'lost'];
  const blue = ['pre_approved', 'vehicle_selected', 'validations_pending'];
  if (green.includes(status)) return 'border-emerald-500/30';
  if (red.includes(status)) return 'border-red-500/30';
  if (blue.includes(status)) return 'border-blue-500/30';
  return 'border-amber-500/30';
};

export default function UniversalClientHub({ open, onOpenChange, clientEmail, clientPhone }: UniversalClientHubProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [activeApps, setActiveApps] = useState<any[]>([]);
  const [pastDeals, setPastDeals] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');

  // Full Quote Calculator state (parity with AdminQuoteGenerator)
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcInputs, setCalcInputs] = useState({
    price: 300000, deposit: 0, rate: 13.25, term: 72, balloon: 35,
    initiationFee: 1207.50, monthlyFee: 69, licenseFee: 2500, adminFee: 4500, warranty: 0,
  });
  const [calcTradeIn, setCalcTradeIn] = useState(0);
  const [calcSettlement, setCalcSettlement] = useState(0);
  const [calcShow, setCalcShow] = useState({
    price: true, deposit: true, rate: true, term: true, balloon: true,
    initiationFee: false, monthlyFee: false, licenseFee: false, adminFee: false, warranty: false, totalFinanced: false,
  });
  const [scenarioTitle, setScenarioTitle] = useState('Option 1');
  const [quoteOptions, setQuoteOptions] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  const updateCalcInput = (field: string, val: number) => setCalcInputs(prev => ({ ...prev, [field]: val }));
  const updateCalcShow = (field: string, val: boolean) => setCalcShow(prev => ({ ...prev, [field]: val }));

  // Derived calculations (shortfall/equity engine)
  const shortfall = Math.max(0, calcSettlement - calcTradeIn);
  const tradeInEquity = Math.max(0, calcTradeIn - calcSettlement);
  const extras = calcInputs.licenseFee + calcInputs.adminFee + calcInputs.warranty + calcInputs.initiationFee;
  const effectiveDeposit = calcInputs.deposit + tradeInEquity;
  const totalFinanced = Math.max(0, calcInputs.price + extras + shortfall - effectiveDeposit);
  const balloonAmount = Math.round(calcInputs.price * (calcInputs.balloon / 100));
  const calcMonthlyRate = calcInputs.rate / 100 / 12;
  const basePmt = (() => {
    if (totalFinanced <= 0 || calcInputs.term <= 0) return 0;
    if (calcInputs.rate === 0) return (totalFinanced - balloonAmount) / calcInputs.term;
    const pvBalloon = balloonAmount / Math.pow(1 + calcMonthlyRate, calcInputs.term);
    const adjusted = totalFinanced - pvBalloon;
    return Math.round(adjusted * (calcMonthlyRate * Math.pow(1 + calcMonthlyRate, calcInputs.term)) / (Math.pow(1 + calcMonthlyRate, calcInputs.term) - 1));
  })();
  const installment = basePmt + calcInputs.monthlyFee;

  const handleAddQuoteOption = () => {
    if (!scenarioTitle.trim()) { toast.error('Enter a scenario title'); return; }
    setQuoteOptions(prev => [...prev, {
      id: crypto.randomUUID(), title: scenarioTitle,
      inputs: { ...calcInputs }, show: { ...calcShow },
      result: { installment, totalFinanced, balloonAmount, extrasTotal: extras },
    }]);
    const match = scenarioTitle.match(/Option (\d+)/);
    setScenarioTitle(match ? `Option ${parseInt(match[1]) + 1}` : '');
    toast.success('Option added');
  };

  const handleCopyWhatsApp = async () => {
    if (quoteOptions.length === 0) { toast.error('Add at least one option first'); return; }
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];
    let msg = `🚗 *Lumina Auto | Finance Options*\n\nHere are the payment plans we calculated for you:\n\n`;
    quoteOptions.forEach((opt, i) => {
      msg += `*${emojis[i] || `${i + 1}.`} ${opt.title}*\n`;
      if (opt.show.price) msg += `🚘 Vehicle Price: R ${opt.inputs.price.toLocaleString()}\n`;
      if (opt.show.adminFee && opt.inputs.adminFee > 0) msg += `📋 Admin Fee: R ${opt.inputs.adminFee.toLocaleString()}\n`;
      if (opt.show.licenseFee && opt.inputs.licenseFee > 0) msg += `📝 License/Reg: R ${opt.inputs.licenseFee.toLocaleString()}\n`;
      if (opt.show.warranty && opt.inputs.warranty > 0) msg += `🛡️ Warranty/VAPs: R ${opt.inputs.warranty.toLocaleString()}\n`;
      if (opt.show.initiationFee && opt.inputs.initiationFee > 0) msg += `🏦 Bank Initiation: R ${opt.inputs.initiationFee.toLocaleString()}\n`;
      if (opt.show.monthlyFee && opt.inputs.monthlyFee > 0) msg += `🔧 Service Fee: R ${opt.inputs.monthlyFee.toLocaleString()} pm\n`;
      if (opt.show.deposit && opt.inputs.deposit > 0) msg += `📉 Deposit: R ${opt.inputs.deposit.toLocaleString()}\n`;
      if (opt.show.totalFinanced) msg += `💰 Total Financed: R ${opt.result.totalFinanced.toLocaleString()}\n`;
      if (opt.show.term) msg += `📅 Term: ${opt.inputs.term} Months\n`;
      if (opt.show.rate) msg += `📊 Rate: ${opt.inputs.rate}%\n`;
      if (opt.show.balloon && opt.inputs.balloon > 0) msg += `🎈 Balloon: ${opt.inputs.balloon}%\n`;
      msg += `⚡ *Installment: R ${opt.result.installment.toLocaleString(undefined, { maximumFractionDigits: 0 })} p/m*\n\n`;
    });
    msg += `Let me know which option works best for your budget! 🤝`;
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true); toast.success('WhatsApp message copied!'); setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Failed to copy'); }
  };

  const fetchGlobalProfile = useCallback(async () => {
    if (!clientEmail && !clientPhone) return;

    let financeQuery = supabase.from('finance_applications').select('*');
    if (clientEmail && clientPhone) {
      financeQuery = financeQuery.or(`email.eq.${clientEmail},phone.eq.${clientPhone}`);
    } else if (clientEmail) {
      financeQuery = financeQuery.eq('email', clientEmail);
    } else if (clientPhone) {
      financeQuery = financeQuery.eq('phone', clientPhone);
    }
    const { data: fData } = await financeQuery;
    if (fData) {
      setPastDeals(fData.filter(app => {
        const s = app.status?.toLowerCase()?.trim() || '';
        return ['finalized', 'delivered'].includes(s);
      }));
      setActiveApps(fData.filter(app => {
        const s = app.status?.toLowerCase()?.trim() || '';
        return !['finalized', 'delivered', 'declined', 'lost'].includes(s);
      }));
    } else {
      setPastDeals([]);
      setActiveApps([]);
    }

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

    let logQuery = supabase.from('client_audit_logs').select('*').order('created_at', { ascending: false });
    if (clientEmail && clientPhone) {
      logQuery = logQuery.or(`client_email.eq.${clientEmail},client_phone.eq.${clientPhone}`);
    } else if (clientEmail) {
      logQuery = logQuery.eq('client_email', clientEmail);
    } else if (clientPhone) {
      logQuery = logQuery.eq('client_phone', clientPhone);
    }
    const { data: logData } = await logQuery;
    const rawLogs = (logData || []) as any[];
    const authorIds = Array.from(new Set(rawLogs.map(l => l.author_id).filter(Boolean) as string[]));
    if (authorIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', authorIds);
      const byId = new Map((profs || []).map((p: any) => [p.user_id, p]));
      rawLogs.forEach(l => {
        const p = l.author_id ? byId.get(l.author_id) : null;
        if (p) l.author_name = (p as any).full_name || (p as any).email || l.author_name;
      });
    }
    setLogs(rawLogs);
  }, [clientEmail, clientPhone]);

  useEffect(() => {
    if (open) fetchGlobalProfile();
  }, [open, fetchGlobalProfile]);

  const handleAddNote = async () => {
    if (!newNote.trim() || (!clientEmail && !clientPhone)) return;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    let authorName = 'Admin Staff';
    if (authUser?.id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', authUser.id)
        .maybeSingle();
      authorName = (prof as any)?.full_name || (prof as any)?.email || authUser.email || authorName;
    }

    const { error } = await supabase.from('client_audit_logs').insert([{
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
      note: newNote,
      action_type: 'Manual Note',
      author_id: authUser?.id || null,
      author_name: authorName,
    }]);

    if (error) {
      toast.error('Failed to save universal note');
      return;
    }

    setNewNote('');
    toast.success('Note added to universal timeline');
    fetchGlobalProfile();
  };

  const handleDeleteNote = async (id: string) => {
    const { error } = await supabase.from('client_audit_logs').delete().eq('id', id);
    if (error) {
      toast.error("Failed to delete note");
    } else {
      toast.success("Note permanently deleted");
      fetchGlobalProfile();
    }
  };

  const allApps = [...pastDeals, ...activeApps];
  const masterName = allApps[0]?.first_name
    ? `${allApps[0].first_name} ${allApps[0].last_name || ''}`.trim()
    : allApps[0]?.full_name || leads[0]?.client_name || 'Unknown Client';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 bg-card border-border flex flex-col h-[100dvh] overflow-y-auto md:overflow-hidden" aria-describedby={undefined}>
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-white/10 bg-gradient-to-r from-zinc-900 to-black shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                <SheetTitle className="text-sm">{masterName}</SheetTitle>
              </div>
              <p className="text-[10px] text-muted-foreground">{clientEmail || 'No Email'} | {clientPhone || 'No Phone'}</p>
            </div>
            <Button onClick={() => setCalcOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 text-xs">
              <Calculator className="w-3 h-3" /> Quick Quote
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden min-h-0">
          {/* LEFT: Data */}
          <div className="w-full md:w-1/2 md:border-r border-b md:border-b-0 border-white/10 p-6 flex flex-col gap-6 md:overflow-y-auto h-auto md:h-full">
            {/* 1. THE GARAGE (LIFETIME PURCHASES) */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-500 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4"/> The Garage (Purchase History)
              </h3>
              {pastDeals.length === 0 ? (
                <div className="bg-black/30 border border-white/5 p-3 rounded-md flex items-center gap-3 shadow-inner">
                  <div className="p-2 bg-zinc-900 border border-white/5 rounded-full"><Car className="w-4 h-4 text-zinc-600"/></div>
                  <div>
                    <p className="text-xs font-medium text-zinc-300">First-Time Buyer</p>
                    <p className="text-[10px] text-zinc-500">No finalized deliveries on record.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] text-amber-500/80 mb-2 font-mono uppercase tracking-wider">Total Vehicles Bought: {pastDeals.length}</div>
                  {pastDeals.map(deal => (
                    <div key={deal.id} className="bg-gradient-to-r from-amber-950/30 to-black border border-amber-500/20 p-3 rounded-md flex justify-between items-center shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                      <div>
                        <p className="text-sm font-bold text-amber-400">{deal.preferred_vehicle_text || deal.full_name || 'Unknown Vehicle'}</p>
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5">App ID: {deal.id.slice(0,8)}</p>
                      </div>
                      <span className="text-[9px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-wider font-bold">
                        {deal.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. ACTIVE FINANCE PIPELINE */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-500 mb-3 flex items-center gap-2">
                <Car className="w-4 h-4"/> Active Applications
              </h3>
              {activeApps.length === 0 ? <p className="text-xs text-zinc-600 italic">No active applications.</p> : activeApps.map(app => (
                <div key={app.id} className="bg-black/50 border border-emerald-500/20 p-3 rounded-md mb-2 shadow-[0_0_10px_rgba(16,185,129,0.05)]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-white">{app.preferred_vehicle_text || app.full_name || 'Vehicle Pending'}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase font-bold tracking-wider">{app.status?.replace('_', ' ')}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono">App ID: {app.id.slice(0,8)}</p>
                </div>
              ))}
            </div>

            {/* 3. CRM LEADS */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-500 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4"/> Active CRM Leads
              </h3>
              {leads.length === 0 ? <p className="text-xs text-zinc-600 italic">No active leads.</p> : leads.map(lead => (
                <div key={lead.id} className="bg-black/50 border border-blue-500/20 p-3 rounded-md mb-2 shadow-[0_0_10px_rgba(59,130,246,0.05)]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-white">{lead.client_name || 'Lead Profile'}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase font-bold tracking-wider">{lead.status?.replace('_', ' ')}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono">Created: {format(new Date(lead.created_at), 'dd MMM yyyy')}</p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Timeline */}
          <div className="w-full md:w-1/2 p-6 flex flex-col bg-black/20 h-auto md:h-full min-h-0 overflow-hidden">
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

            <LiveCallCopilot
              clientEmail={clientEmail}
              clientPhone={clientPhone}
              clientName={masterName}
              onCallEnd={fetchGlobalProfile}
            />

            <ScrollArea className="flex-1 min-h-0 mt-3 pr-4">
              <div className="space-y-3 pl-4 relative before:absolute before:left-1.5 before:top-0 before:h-full before:w-px before:bg-border">
                {logs.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic text-center py-4">No history recorded yet.</p>
                ) : logs.map(log => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[10.5px] top-1.5 flex items-center justify-center w-3 h-3 rounded-full border-2 border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.2)] z-10">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                    </div>
                    <div className="p-2.5 rounded-md bg-muted/20 border border-border hover:border-emerald-500/20 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-emerald-500">{log.author_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-muted-foreground font-mono">{format(new Date(log.created_at), 'dd MMM HH:mm')}</span>
                          <button onClick={() => handleDeleteNote(log.id)} className="text-zinc-600 hover:text-red-500 transition-colors" title="Delete Note">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{log.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Full Quote Calculator Modal */}
        <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-400" /> WhatsApp Quote Generator
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Scenario Title */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Scenario Title</Label>
                <Input value={scenarioTitle} onChange={e => setScenarioTitle(e.target.value)} placeholder="e.g., Option 1: No Deposit" className="h-8 text-xs" />
              </div>

              {/* Trade-In & Shortfall */}
              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Trade-In & Shortfall (Admin Only)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Trade-In Offer</Label>
                    <Input type="number" value={calcTradeIn || ''} onChange={e => setCalcTradeIn(Number(e.target.value))} className="bg-muted/30 border-border h-8 text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Settlement (Owed)</Label>
                    <Input type="number" value={calcSettlement || ''} onChange={e => setCalcSettlement(Number(e.target.value))} className="bg-muted/30 border-border h-8 text-xs font-mono" />
                  </div>
                </div>
                {shortfall > 0 && (
                  <p className="text-[10px] text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 font-mono">
                    Shortfall of R {shortfall.toLocaleString()} added to principal.
                  </p>
                )}
                {tradeInEquity > 0 && (
                  <p className="text-[10px] text-primary bg-primary/10 p-2 rounded border border-primary/20 font-mono">
                    Equity of R {tradeInEquity.toLocaleString()} added to deposit.
                  </p>
                )}
              </div>

              {/* Vehicle & Deal */}
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vehicle & Deal</p>
                {[
                  { label: 'Vehicle Price', field: 'price', prefix: 'R' },
                  { label: 'Deposit', field: 'deposit', prefix: 'R', slider: true, min: 0, max: calcInputs.price * 0.5, step: 5000 },
                  { label: 'Interest Rate', field: 'rate', suffix: '%', slider: true, min: 7, max: 25, step: 0.1 },
                  { label: 'Term (Months)', field: 'term', suffix: 'mo', slider: true, min: 12, max: 96, step: 12 },
                  { label: 'Balloon %', field: 'balloon', suffix: '%', slider: true, min: 0, max: 75, step: 5 },
                ].map(item => (
                  <div key={item.field} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={(calcShow as any)[item.field]} onCheckedChange={c => updateCalcShow(item.field, !!c)} className="h-3 w-3" />
                      <Eye className="h-3 w-3 text-muted-foreground" />
                      <Label className="text-[10px]">{item.label}</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.prefix && <span className="text-[10px] text-muted-foreground">{item.prefix}</span>}
                      <Input type="number" value={(calcInputs as any)[item.field] || ''} onChange={e => updateCalcInput(item.field, Number(e.target.value))} className="h-7 text-xs font-mono" step={item.step} />
                      {item.suffix && <span className="text-[10px] text-muted-foreground w-6 text-right">{item.suffix}</span>}
                    </div>
                    {item.slider && item.min !== undefined && item.max !== undefined && (
                      <Slider value={[(calcInputs as any)[item.field]]} onValueChange={v => updateCalcInput(item.field, v[0])} min={item.min} max={item.max} step={item.step} className="mt-1" />
                    )}
                  </div>
                ))}
              </div>

              {/* Fees & Extras */}
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Fees & Extras</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Admin Fee', field: 'adminFee' },
                    { label: 'License & Reg', field: 'licenseFee' },
                    { label: 'Warranty / VAPs', field: 'warranty' },
                    { label: 'Bank Initiation', field: 'initiationFee' },
                  ].map(item => (
                    <div key={item.field} className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Checkbox checked={(calcShow as any)[item.field]} onCheckedChange={c => updateCalcShow(item.field, !!c)} className="h-3 w-3" />
                        <Eye className="h-3 w-3 text-muted-foreground" />
                        <Label className="text-[10px]">{item.label}</Label>
                      </div>
                      <Input type="number" value={(calcInputs as any)[item.field] || ''} onChange={e => updateCalcInput(item.field, Number(e.target.value))} className="h-7 text-xs font-mono" prefix="R" />
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Checkbox checked={calcShow.monthlyFee} onCheckedChange={c => updateCalcShow('monthlyFee', !!c)} className="h-3 w-3" />
                    <Eye className="h-3 w-3 text-muted-foreground" />
                    <Label className="text-[10px]">Monthly Service Fee</Label>
                  </div>
                  <Input type="number" value={calcInputs.monthlyFee || ''} onChange={e => updateCalcInput('monthlyFee', Number(e.target.value))} className="h-7 text-xs font-mono" />
                </div>
                <Separator />
                <div className="flex items-center gap-2">
                  <Checkbox checked={calcShow.totalFinanced} onCheckedChange={c => updateCalcShow('totalFinanced', !!c)} className="h-3 w-3" />
                  <Eye className="h-3 w-3 text-muted-foreground" />
                  <Label className="text-[10px]">Show "Total Financed" line on quote</Label>
                </div>
              </div>

              {/* Results */}
              <div className="border-t border-border pt-3 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-md bg-muted/30 border border-border text-center">
                    <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Total Financed</p>
                    <p className="text-xs font-bold text-foreground font-mono">R {totalFinanced.toLocaleString()}</p>
                  </div>
                  <div className="p-2.5 rounded-md bg-muted/30 border border-border text-center">
                    <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Balloon</p>
                    <p className="text-xs font-bold text-foreground font-mono">R {balloonAmount.toLocaleString()}</p>
                  </div>
                  <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-center">
                    <p className="text-[8px] text-emerald-400 uppercase tracking-wider">Installment</p>
                    <p className="text-sm font-bold text-emerald-400 font-mono">R {installment.toLocaleString()}</p>
                  </div>
                </div>

                <Button onClick={handleAddQuoteOption} className="w-full" size="sm">
                  <Plus className="h-3 w-3 mr-1.5" /> Add Option: {scenarioTitle}
                </Button>
              </div>

              {/* Staged Options */}
              {quoteOptions.length > 0 && (
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Staged Options ({quoteOptions.length})
                  </p>
                  {quoteOptions.map((opt, i) => (
                    <div key={opt.id} className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border group">
                      <div>
                        <p className="text-[11px] font-medium">{i + 1}. {opt.title}</p>
                        <p className="text-[9px] text-muted-foreground font-mono">
                          R {opt.inputs.price.toLocaleString()} · {opt.inputs.term}mo · {opt.inputs.rate}% → R {opt.result.installment.toLocaleString()} pm
                        </p>
                      </div>
                      <button onClick={() => setQuoteOptions(prev => prev.filter(o => o.id !== opt.id))} className="p-1 rounded-full text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  <Button onClick={handleCopyWhatsApp} className="w-full bg-green-600 hover:bg-green-700 text-white" size="sm">
                    {copied ? <><Check className="h-3 w-3 mr-1.5" /> Copied!</> : <><Copy className="h-3 w-3 mr-1.5" /> Copy WhatsApp Message</>}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
