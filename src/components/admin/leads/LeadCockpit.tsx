import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Phone, Mail, Calendar, CarFront, Banknote, Clock, ArrowRight, UserCheck, Archive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface LeadCockpitProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

interface ActivityLogEntry {
  type: string;
  text: string;
  date: string;
  user: string;
}

export const LeadCockpit = ({ leadId, isOpen, onClose, onUpdate }: LeadCockpitProps) => {
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (leadId && isOpen) {
      setLoading(true);
      const fetchLead = async () => {
        const { data } = await supabase
          .from('leads')
          .select('*, vehicle:vehicles(make, model, year)')
          .eq('id', leadId)
          .maybeSingle();
        setLead(data);
        setLoading(false);
        // Mark as viewed
        if (data) {
          await supabase.from('leads').update({ admin_last_viewed_at: new Date().toISOString() }).eq('id', leadId);
        }
      };
      fetchLead();
    } else {
      setLead(null);
    }
  }, [leadId, isOpen]);

  const updateField = async (field: string, value: any) => {
    if (!leadId) return;
    setSaving(true);
    const { error } = await supabase.from('leads').update({ [field]: value }).eq('id', leadId);
    if (!error) {
      setLead((prev: any) => ({ ...prev, [field]: value }));
    } else {
      toast.error('Failed to update');
    }
    setSaving(false);
  };

  const addNote = async () => {
    if (!note.trim() || !leadId) return;
    const newLog: ActivityLogEntry = {
      type: 'note',
      text: note,
      date: new Date().toISOString(),
      user: 'Admin',
    };
    const currentLogs: ActivityLogEntry[] = Array.isArray(lead?.activity_log) ? lead.activity_log : [];
    const updatedLogs = [newLog, ...currentLogs];
    await updateField('activity_log', updatedLogs);
    setNote("");
    toast.success("Note added");
  };

  const openWhatsApp = (template: string) => {
    if (!lead?.client_phone) return;
    let msg = "";
    const name = lead.client_name || "there";
    if (template === 'intro') msg = `Hi ${name}, this is Albert from Lumina Auto. I received your inquiry about the vehicle. Do you have a moment to chat?`;
    if (template === 'docs') msg = `Hi ${name}, to proceed with your finance application, I need the following documents: ID, Driver's License, 3 Months Payslips, and 3 Months Bank Statements.`;
    window.open(`https://wa.me/${lead.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const archiveLead = async () => {
    if (!leadId) return;
    await supabase.from('leads').update({ is_archived: true }).eq('id', leadId);
    toast.success("Lead archived");
    onClose();
    onUpdate();
  };

  const temperatureColors: Record<string, string> = {
    cold: 'bg-blue-500/20 text-blue-400',
    warm: 'bg-orange-500/20 text-orange-400',
    hot: 'bg-red-500/20 text-red-400',
  };

  if (!isOpen) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-[720px] p-0 overflow-hidden">
        {loading || !lead ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* HEADER */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl shrink-0">
                  {lead.client_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold truncate">{lead.client_name || 'Unknown Lead'}</h2>
                    <Badge className={`text-[10px] ${temperatureColors[lead.lead_temperature] || temperatureColors.warm}`}>
                      {lead.lead_temperature || 'warm'}
                    </Badge>
                    {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {lead.client_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.client_phone}</span>}
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Added {new Date(lead.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={archiveLead}>
                  <Archive className="w-3 h-3 mr-1" /> Archive
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  if (lead.client_email) {
                    window.open(`mailto:${lead.client_email}`);
                  }
                }}>
                  <Mail className="w-3 h-3 mr-1" /> Email
                </Button>
              </div>
            </div>

            {/* SCROLLABLE BODY */}
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">

                {/* QUICK ACTIONS */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Quick Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openWhatsApp('intro')}>
                      <MessageCircle className="w-3 h-3 mr-1 text-emerald-400" /> Intro Message
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openWhatsApp('docs')}>
                      <ArrowRight className="w-3 h-3 mr-1" /> Request Docs
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => lead.client_phone && window.open(`tel:${lead.client_phone}`)}>
                      <Phone className="w-3 h-3 mr-1 text-blue-400" /> Call Client
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* CLIENT DETAILS */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><UserCheck className="w-4 h-4" /> Client Details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">ID Number</Label>
                      <Input
                        defaultValue={lead.id_number || ''}
                        onBlur={e => updateField('id_number', e.target.value)}
                        placeholder="SA ID Number"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <Input
                        defaultValue={lead.client_email || ''}
                        onBlur={e => updateField('client_email', e.target.value)}
                        placeholder="client@email.com"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Temperature</Label>
                      <Select defaultValue={lead.lead_temperature || 'warm'} onValueChange={v => updateField('lead_temperature', v)}>
                        <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cold">❄️ Cold</SelectItem>
                          <SelectItem value="warm">🟠 Warm</SelectItem>
                          <SelectItem value="hot">🔥 Hot</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Source</Label>
                      <Input value={lead.source || ''} readOnly className="mt-1 h-8 text-sm bg-muted/50" />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* VEHICLE INTEREST */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><CarFront className="w-4 h-4" /> Vehicle Interest</h3>
                  {lead.vehicle ? (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="font-medium text-sm">{lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No vehicle linked — {lead.notes || 'General inquiry'}</p>
                  )}
                </div>

                <Separator />

                {/* TRADE-IN */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><CarFront className="w-4 h-4" /> Trade-In Details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Make & Model</Label>
                      <Input
                        defaultValue={lead.trade_in_make_model || ''}
                        onBlur={e => updateField('trade_in_make_model', e.target.value)}
                        placeholder="e.g. VW Polo 1.4 TSI"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Year</Label>
                      <Input
                        type="number"
                        defaultValue={lead.trade_in_year || ''}
                        onBlur={e => updateField('trade_in_year', e.target.value ? Number(e.target.value) : null)}
                        placeholder="2019"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Mileage (km)</Label>
                      <Input
                        type="number"
                        defaultValue={lead.trade_in_mileage || ''}
                        onBlur={e => updateField('trade_in_mileage', e.target.value ? Number(e.target.value) : null)}
                        placeholder="85000"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Estimated Value (R)</Label>
                      <Input
                        type="number"
                        defaultValue={lead.trade_in_estimated_value || ''}
                        onBlur={e => updateField('trade_in_estimated_value', e.target.value ? Number(e.target.value) : null)}
                        placeholder="120000"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* FINANCE PREFERENCES */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Banknote className="w-4 h-4" /> Finance Preferences</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Deposit (R)</Label>
                      <Input
                        type="number"
                        defaultValue={lead.desired_deposit || ''}
                        onBlur={e => updateField('desired_deposit', e.target.value ? Number(e.target.value) : null)}
                        placeholder="20000"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Term (Months)</Label>
                      <Select defaultValue={String(lead.desired_term || 72)} onValueChange={v => updateField('desired_term', Number(v))}>
                        <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="72">72 Months</SelectItem>
                          <SelectItem value="60">60 Months</SelectItem>
                          <SelectItem value="54">54 Months</SelectItem>
                          <SelectItem value="48">48 Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* ACTIVITY LOG */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Clock className="w-4 h-4" /> Activity Log</h3>

                  <div>
                    <Textarea
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="Type a note (e.g. 'Waiting for payslip')..."
                      className="min-h-[70px] text-sm"
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); } }}
                    />
                    <div className="flex justify-between items-center mt-1.5">
                      <span className="text-[10px] text-muted-foreground">Press Enter to save</span>
                      <Button size="sm" onClick={addNote} className="h-7 text-xs">Add Note</Button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {(Array.isArray(lead.activity_log) ? lead.activity_log : []).map((log: ActivityLogEntry, idx: number) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        <div>
                          <p className="text-sm">{log.text}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {log.date ? format(new Date(log.date), "MMM d, HH:mm") : ''} • {log.user}
                          </p>
                        </div>
                      </div>
                    ))}
                    {(!lead.activity_log || (Array.isArray(lead.activity_log) && lead.activity_log.length === 0)) && (
                      <p className="text-xs text-muted-foreground text-center py-4">No activity yet</p>
                    )}
                  </div>
                </div>

              </div>
            </ScrollArea>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
