import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Loader2, Mail, Shield, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AgentRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at?: string | null;
}

const TeamManagementTab = () => {
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAgents = async () => {
    setLoading(true);
    // Get all sales_agent roles, then join to profiles for display info
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'sales_agent' as any);
    const ids = (roleRows || []).map((r: any) => r.user_id);
    if (ids.length === 0) {
      setAgents([]);
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, created_at')
      .in('user_id', ids);
    setAgents((profs || []) as any);
    setLoading(false);
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-sales-agent', {
        body: { email: email.trim() },
      });
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error || 'Invite failed');
      toast.success(`Invitation sent to ${email}`);
      setEmail('');
      loadAgents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to invite agent');
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (userId: string, label: string) => {
    if (!confirm(`Revoke sales_agent access for ${label}?`)) return;
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', 'sales_agent' as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Access revoked');
    loadAgents();
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
          <p className="text-sm text-muted-foreground">Invite Sales Agents — they get CRM, Finance Apps, Inventory (read-only) and Quote Generator access. They cannot delete records or view financial reports.</p>
        </div>
      </div>

      <form onSubmit={handleInvite} className="flex items-end gap-3 p-4 bg-muted/30 rounded-lg">
        <div className="flex-1 space-y-2">
          <Label>Sales Agent Email</Label>
          <Input
            type="email"
            placeholder="agent@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={inviting} className="gap-2">
          {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Invite Agent
        </Button>
      </form>

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
