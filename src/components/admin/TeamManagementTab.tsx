import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Loader2, Mail, Shield, Trash2, Copy, Check, KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type StaffRoleKind = 'sales_agent' | 'f_and_i';
const ROLE_LABELS: Record<StaffRoleKind, string> = {
  sales_agent: 'Salesperson',
  f_and_i: 'F&I',
};

interface AgentRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at?: string | null;
  role: StaffRoleKind;
}

const TeamManagementTab = () => {
  const [mode, setMode] = useState<'invite' | 'manual'>('invite');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRoleKind>('sales_agent');
  const [inviting, setInviting] = useState(false);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCreds, setLastCreds] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadAgents = async () => {
    setLoading(true);
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['sales_agent', 'f_and_i'] as any);
    const rows = (roleRows || []) as Array<{ user_id: string; role: StaffRoleKind }>;
    const ids = rows.map(r => r.user_id);
    if (ids.length === 0) {
      setAgents([]);
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, created_at')
      .in('user_id', ids);
    const merged: AgentRow[] = rows.map(r => {
      const p = (profs || []).find((x: any) => x.user_id === r.user_id) as any;
      return {
        user_id: r.user_id,
        role: r.role,
        email: p?.email ?? null,
        full_name: p?.full_name ?? null,
        created_at: p?.created_at ?? null,
      };
    });
    setAgents(merged);
    setLoading(false);
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault?.();
    if (!email.trim()) return;
    setInviting(true);
    setLastCreds(null);
    try {
      const body: Record<string, any> = { email: email.trim(), mode, role };
      if (mode === 'manual') {
        if (password && password.length < 8) {
          toast.error('Password must be at least 8 characters');
          setInviting(false);
          return;
        }
        if (password) body.password = password;
        if (fullName.trim()) body.full_name = fullName.trim();
      }
      const { data, error } = await supabase.functions.invoke('invite-sales-agent', { body });
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error || 'Request failed');

      if (mode === 'manual' && (data as any)?.temp_password) {
        const agentEmail = (data as any).email;
        const tempPassword = (data as any).temp_password;
        setLastCreds({ email: agentEmail, password: tempPassword });

        // Fire credentials email via EmailJS (direct frontend dispatch — same pattern as status notifications)
        const loginUrl = `${window.location.origin}/auth`;
        const emailHtml = `
          <div style="font-family: system-ui, -apple-system, sans-serif; background-color: #09090b; color: #ffffff; padding: 40px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #27272a;">
            <h2 style="color: #ffffff; border-bottom: 1px solid #27272a; padding-bottom: 15px; font-weight: 500; letter-spacing: 1px;">LUMINA AUTO</h2>
            <div style="color: #a1a1aa; font-size: 15px; line-height: 1.6; padding-top: 10px;">
              <p style="color: #ffffff; font-size: 16px;">Welcome to the Team${fullName.trim() ? `, ${fullName.trim()}` : ''}.</p>
              <p>Your Sales Agent account has been provisioned. Use the credentials below to access the admin dashboard.</p>
              <div style="background:#18181b;border:1px solid #27272a;border-radius:6px;padding:16px;margin:20px 0;font-family:'Courier New',monospace;font-size:13px;">
                <div style="color:#71717a;">Email:</div>
                <div style="color:#fff;margin-bottom:10px;">${agentEmail}</div>
                <div style="color:#71717a;">Temporary Password:</div>
                <div style="color:#fff;margin-bottom:10px;">${tempPassword}</div>
                <div style="color:#71717a;">Login URL:</div>
                <div style="color:#fff;"><a href="${loginUrl}" style="color:#fff;text-decoration:underline;">${loginUrl}</a></div>
              </div>
              <p style="color:#a1a1aa;font-size:13px;">For security, please change your password after first login.</p>
            </div>
            <p style="color: #52525b; font-size: 12px; border-top: 1px solid #27272a; padding-top: 15px;">
              Pretoria, South Africa<br/>Premium Pre-Owned Vehicles & Finance
            </p>
          </div>
        `;

        fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id: "service_myacl2m",
            template_id: "template_b2igduv",
            user_id: "pWT3blntfZk-_syL4",
            template_params: {
              to_email: agentEmail,
              subject: "Your Lumina Auto Sales Agent Login",
              html_message: emailHtml,
            }
          }),
        })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            console.error("EmailJS rejected agent credentials email:", text);
            toast.success('Agent created — email failed, share credentials manually below');
          } else {
            toast.success(`Agent created — credentials emailed to ${agentEmail}`);
          }
        })
        .catch(err => {
          console.error("EmailJS unreachable for agent credentials:", err);
          toast.success('Agent created — share credentials manually below');
        });
      } else if ((data as any)?.email_delivery === 'not_sent_existing_user') {
        toast.success('Existing user updated as sales agent — use Manual Password to set shareable login details');
      } else {
        toast.success(`Invitation sent to ${email}`);
      }
      setEmail('');
      setFullName('');
      setPassword('');
      loadAgents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create agent');
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (userId: string, label: string, roleKind: StaffRoleKind) => {
    if (!confirm(`Revoke ${ROLE_LABELS[roleKind]} access for ${label}?`)) return;
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', roleKind as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Access revoked');
    loadAgents();
  };

  const copyCreds = async () => {
    if (!lastCreds) return;
    const txt = `Lumina Auto — Sales Agent Login\nEmail: ${lastCreds.email}\nTemp Password: ${lastCreds.password}\nLogin: ${window.location.origin}/auth`;
    await navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-6 space-y-6"
    >
      <div className="flex items-center gap-3">
        <Shield className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Team Management</h2>
          <p className="text-sm text-muted-foreground">
            Sales Agents get CRM, Finance Apps, Inventory (insert/edit) and Quote Generator access. They cannot delete records or view financial reports.
          </p>
        </div>
      </div>

      <div className="p-4 bg-muted/30 rounded-lg space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="invite" className="gap-2"><Mail className="w-4 h-4" /> Email Invite</TabsTrigger>
            <TabsTrigger value="manual" className="gap-2"><KeyRound className="w-4 h-4" /> Manual Password</TabsTrigger>
          </TabsList>

          <TabsContent value="invite" className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label>Sales Agent Email</Label>
              <Input
                type="email"
                placeholder="agent@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
              />
              <p className="text-xs text-muted-foreground">Sends an invitation email. Use Manual Password if email delivery is unreliable.</p>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="mt-4 space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="agent@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Full Name (optional)</Label>
                <Input
                  type="text"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Temporary Password (optional)</Label>
              <Input
                type="text"
                placeholder="Leave blank to auto-generate a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Account is created instantly. Share the credentials via WhatsApp; the agent can change the password after first login.</p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button type="button" onClick={handleSubmit} disabled={inviting || !email.trim()} className="gap-2">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {mode === 'manual' ? 'Create Agent' : 'Send Invite'}
          </Button>
        </div>

        {lastCreds && (
          <div className="border border-primary/40 bg-primary/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Share these credentials securely (WhatsApp recommended)</p>
              <Button type="button" size="sm" variant="ghost" onClick={copyCreds} className="gap-2">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="font-mono text-sm space-y-1">
              <div><span className="text-muted-foreground">Email:</span> {lastCreds.email}</div>
              <div><span className="text-muted-foreground">Password:</span> {lastCreds.password}</div>
              <div><span className="text-muted-foreground">Login URL:</span> {window.location.origin}/auth</div>
            </div>
            <p className="text-xs text-muted-foreground">This password will not be shown again. Copy it now.</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Sales Agents ({agents.length})</h3>
        {loading ? (
          <div className="text-center py-6 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline" /></div>
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No sales agents yet. Invite one above.</p>
        ) : (
          <div className="space-y-2">
            {agents.map((a) => (
              <div key={a.user_id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{a.full_name || a.email || 'Unnamed agent'}</p>
                    {a.full_name && a.email && (
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRevoke(a.user_id, a.email || 'this agent')}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TeamManagementTab;
