import { useState, useMemo } from 'react';
import { Phone, Copy, Check, Car, Wallet, CalendarClock, AlertOctagon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  application: any;
  onChange: (patch: Record<string, any>) => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ClientCockpit({ application, onChange }: Props) {
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const fullName = [application.first_name, application.last_name].filter(Boolean).join(' ') || application.full_name || 'Unnamed Client';

  const contactedToday = application.last_contacted_date === todayISO();
  const followUp: string | null = application.follow_up_time || null;

  // Annoy logic: if not contacted today AND now > follow_up_time
  const isOverdue = useMemo(() => {
    if (contactedToday) return false;
    if (!followUp) return false;
    const now = new Date();
    const [hh, mm] = followUp.split(':').map(Number);
    const target = new Date();
    target.setHours(hh, mm, 0, 0);
    return now.getTime() > target.getTime();
  }, [contactedToday, followUp]);

  const phone = application.phone || '';
  const copyPhone = async () => {
    if (!phone) return;
    await navigator.clipboard.writeText(phone);
    setCopied(true);
    toast.success('Phone number copied');
    setTimeout(() => setCopied(false), 1500);
  };

  const writeAudit = async (note: string, action_type: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    let authorName = 'Admin Staff';
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', user.id)
        .maybeSingle();
      authorName = profile?.full_name || profile?.email || user.email || 'Admin Staff';
    }
    await supabase.from('client_audit_logs').insert([{
      client_email: application.email || null,
      client_phone: application.phone || null,
      note: `«F&I» ${authorName} — ${note}`,
      author_id: user?.id || null,
      author_name: authorName,
      action_type,
    }]);
    queryClient.invalidateQueries({ queryKey: ['client-audit-logs'] });
  };

  const persist = async (patch: Record<string, any>, audit?: { note: string; action_type: string }) => {
    const { error } = await supabase.from('finance_applications').update(patch).eq('id', application.id);
    if (error) {
      toast.error('Failed to save: ' + error.message);
      return;
    }
    onChange(patch);
    queryClient.invalidateQueries({ queryKey: ['finance-applications'] });
    if (audit) await writeAudit(audit.note, audit.action_type);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* LEFT: Persistent profile card (1/3) */}
      <div className="glass-card rounded-xl p-6 bg-zinc-900/40 border border-zinc-800">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Applicant / Lead</p>
        <h2 className="text-2xl font-semibold text-foreground leading-tight">{fullName}</h2>
        <p className="text-xs text-muted-foreground mt-1">App ID · {application.id?.slice(0, 8)}</p>

        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Cell Number</p>
          <button
            onClick={copyPhone}
            className="group flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground hover:text-primary transition-colors"
            title="Click to copy"
          >
            <Phone className="w-6 h-6 text-primary" />
            <span>{phone || '—'}</span>
            {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity" />}
          </button>
        </div>

        {/* AI persistent memory block */}
        <div className="mt-6 rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">AI Client Profile (persistent)</p>
          <div className="flex items-start gap-2 text-sm">
            <Car className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <span className="text-muted-foreground">Vehicle interest: </span>
              <span className="text-foreground font-medium">{application.ai_vehicle_interest || '—'}</span>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <Wallet className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <span className="text-muted-foreground">Budget: </span>
              <span className="text-foreground font-medium">{application.ai_budget || '—'}</span>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <CalendarClock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <span className="text-muted-foreground">Timeline: </span>
              <span className="text-foreground font-medium">{application.ai_timeline || '—'}</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/70 italic">Auto-updated by AI Co-Pilot after each call.</p>
        </div>
      </div>

      {/* RIGHT: Daily action + email/contact (2/3) */}
      <div className={`glass-card rounded-xl p-6 lg:col-span-2 transition-all ${isOverdue ? 'border-red-500 border-2 animate-pulse' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Daily Action</p>
            <h3 className={`text-lg font-semibold ${isOverdue ? 'text-red-400' : 'text-foreground'}`}>
              {isOverdue ? 'OVERDUE — Contact this client now' : contactedToday ? 'Contacted today ✓' : 'Awaiting today\'s contact'}
            </h3>
          </div>
          {isOverdue && <AlertOctagon className="w-8 h-8 text-red-500 animate-pulse" />}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 p-4 rounded-lg bg-zinc-800/40 border border-zinc-700/50 cursor-pointer hover:bg-zinc-800/60 transition-colors">
            <Checkbox
              checked={contactedToday}
              onCheckedChange={(checked) => {
                persist({ last_contacted_date: checked ? todayISO() : null });
              }}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium text-foreground">Contacted Today</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {contactedToday ? `Marked for ${todayISO()}` : 'Auto-resets at midnight'}
              </p>
            </div>
          </label>

          <div className={`p-4 rounded-lg border transition-colors ${isOverdue ? 'bg-red-950/30 border-red-500/60' : 'bg-zinc-800/40 border-zinc-700/50'}`}>
            <Label htmlFor="follow_up_time" className={`text-xs ${isOverdue ? 'text-red-400 font-bold' : 'text-muted-foreground'}`}>
              Follow-up time today
            </Label>
            <Input
              id="follow_up_time"
              type="time"
              value={followUp || ''}
              onChange={(e) => persist({ follow_up_time: e.target.value || null })}
              className={`mt-1 ${isOverdue ? 'border-red-500 text-red-300 font-bold' : ''}`}
            />
            {isOverdue && (
              <p className="text-xs text-red-400 font-semibold mt-2">
                Past scheduled time — call the client.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
