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
import { Clock, Car, User, FileText, Calculator, Copy, Check, Plus, X, Eye } from 'lucide-react';
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
  const [financeApps, setFinanceApps] = useState<any[]>([]);
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
    setFinanceApps(fData || []);

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
                <div key={app.id} className={`p-2.5 rounded-md bg-muted/30 border ${getCardBorderClass(app.status)} space-y-1 hover:brightness-110 transition-all`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-foreground">{app.full_name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${['approved','finalized','delivered'].includes(app.status) ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : ['declined'].includes(app.status) ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-amber-500/20 text-amber-400 border-amber-500/50'}`}>{app.status}</span>
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
                <div key={lead.id} className={`p-2.5 rounded-md bg-muted/30 border ${getCardBorderClass(lead.status)} space-y-1 hover:brightness-110 transition-all`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-foreground">{lead.client_name || 'Lead'}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${['converted','qualified'].includes(lead.status) ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : ['lost'].includes(lead.status) ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-blue-500/20 text-blue-400 border-blue-500/50'}`}>{lead.status}</span>
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

            <LiveCallCopilot
              clientEmail={clientEmail}
              clientPhone={clientPhone}
              clientName={masterName}
              onCallEnd={fetchGlobalProfile}
            />

            <ScrollArea className="flex-1 mt-3">
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

        {/* Quick Quote Calculator Modal */}
        <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-400" /> Fast Finance Quote
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Vehicle Price</Label>
                  <Input type="number" value={calcPrice || ''} onChange={(e) => setCalcPrice(Number(e.target.value))} className="bg-muted/30 border-border h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Cash Deposit</Label>
                  <Input type="number" value={calcDeposit || ''} onChange={(e) => setCalcDeposit(Number(e.target.value))} className="bg-muted/30 border-border h-8 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Trade-In Offer</Label>
                  <Input type="number" value={calcTradeIn || ''} onChange={(e) => setCalcTradeIn(Number(e.target.value))} className="bg-muted/30 border-border h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Settlement (Owed)</Label>
                  <Input type="number" value={calcSettlement || ''} onChange={(e) => setCalcSettlement(Number(e.target.value))} className="bg-muted/30 border-border h-8 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Term (Months)</Label>
                  <Input type="number" value={calcTerm || ''} onChange={(e) => setCalcTerm(Number(e.target.value))} className="bg-muted/30 border-border h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Interest Rate (%)</Label>
                  <Input type="number" step="0.25" value={calcRate || ''} onChange={(e) => setCalcRate(Number(e.target.value))} className="bg-muted/30 border-border h-8 text-xs" />
                </div>
              </div>

              <div className="border-t border-border pt-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-md bg-muted/30 border border-border text-center">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Principal Financed</p>
                    <p className="text-sm font-bold text-foreground">R {principal.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-center">
                    <p className="text-[9px] text-emerald-400 uppercase tracking-wider">Est. Installment</p>
                    <p className="text-sm font-bold text-emerald-400">R {Math.round(pmt).toLocaleString()} /mo</p>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
