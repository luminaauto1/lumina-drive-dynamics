import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, RotateCcw, ListChecks } from 'lucide-react';
import { STATUS_OPTIONS } from '@/lib/statusConfig';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { useAppVisibilityRules, useUpsertAppVisibility } from '@/hooks/useAppVisibility';
import { F_AND_I_ALLOWED_STATUSES, SENIOR_F_AND_I_ALLOWED_STATUSES } from '@/lib/roleStatusFilter';
import type { AppVisibilityRule } from '@/lib/finance/shared';

interface StaffRow {
  user_id: string;
  role: string;
  name: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  sales_agent: 'Sales',
  f_and_i: 'F&I',
  senior_f_and_i: 'Senior F&I',
  accountant: 'Accountant',
};

/** What this user gets when no per-user list is saved — mirrors roleStatusFilter. */
const roleDefaultFor = (role: string): string[] | 'all' => {
  if (role === 'f_and_i') return F_AND_I_ALLOWED_STATUSES;
  if (role === 'senior_f_and_i') return SENIOR_F_AND_I_ALLOWED_STATUSES;
  return 'all';
};

/**
 * Settings → Status Permissions. Picks, per staff member, exactly which finance
 * statuses they may SET. Empty selection = fall back to the role default, so an
 * untouched user behaves precisely as before.
 *
 * Stored in app_visibility_rules.allowed_statuses beside the per-user
 * visibility/archive rules, so a user has one row governing all of it.
 */
const StatusPermissionsTab = () => {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { labels } = useStatusConfig();
  const { data: rules = [] } = useAppVisibilityRules();
  const upsert = useUpsertAppVisibility();

  const ruleFor = useMemo(
    () => (userId: string): AppVisibilityRule | undefined => rules.find((r) => r.user_id === userId),
    [rules],
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: roleRows } = await (supabase as any)
        .from('user_roles').select('user_id, role');
      const ids = Array.from(new Set((roleRows || []).map((r: any) => r.user_id)));
      if (ids.length === 0) { setStaff([]); setLoading(false); return; }
      const { data: profs } = await (supabase as any)
        .from('profiles').select('user_id, full_name, email').in('user_id', ids);
      // Highest-privilege role wins for display, matching AuthContext's resolution.
      const RANK = ['admin', 'senior_f_and_i', 'accountant', 'f_and_i', 'sales_agent'];
      const rows: StaffRow[] = ids.map((id) => {
        const roles = (roleRows || []).filter((r: any) => r.user_id === id).map((r: any) => r.role);
        const role = RANK.find((r) => roles.includes(r)) || roles[0] || 'user';
        const p = (profs || []).find((x: any) => x.user_id === id);
        return { user_id: id as string, role, name: p?.full_name || p?.email || 'Unknown user' };
      }).sort((a, b) => a.name.localeCompare(b.name));
      setStaff(rows);
      setLoading(false);
    })();
  }, []);

  // Seed each row's draft from the saved list (blank = role default).
  useEffect(() => {
    if (staff.length === 0) return;
    setDraft((prev) => {
      const next = { ...prev };
      staff.forEach((s) => {
        if (next[s.user_id] === undefined) next[s.user_id] = ruleFor(s.user_id)?.allowed_statuses ?? [];
      });
      return next;
    });
  }, [staff, rules, ruleFor]);

  const toggle = (userId: string, value: string) => {
    setDraft((prev) => {
      const cur = prev[userId] ?? [];
      return { ...prev, [userId]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
  };

  const save = async (row: StaffRow) => {
    const existing = ruleFor(row.user_id);
    const picked = draft[row.user_id] ?? [];
    setSavingId(row.user_id);
    try {
      await upsert.mutateAsync({
        user_id: row.user_id,
        // Preserve the visibility half of the row — this tab only edits statuses.
        mode: existing?.mode ?? 'default',
        visible_user_ids: existing?.visible_user_ids ?? [],
        can_archive: existing?.can_archive ?? null,
        allowed_statuses: picked.length ? picked : null,
      } as AppVisibilityRule);
      toast.success(picked.length
        ? `${row.name}: ${picked.length} status${picked.length === 1 ? '' : 'es'} allowed`
        : `${row.name}: reset to the ${ROLE_LABEL[row.role] || row.role} default`);
    } catch (e: any) {
      toast.error('Could not save: ' + (e?.message || e));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Choose exactly which finance statuses each person may set. Leave every box unticked to use their
        role's default. A user always keeps the status a file is already on, so nothing becomes unreadable.
      </p>

      {staff.map((row) => {
        const picked = draft[row.user_id] ?? [];
        const def = roleDefaultFor(row.role);
        const usingDefault = picked.length === 0;
        const dirty = JSON.stringify([...picked].sort())
          !== JSON.stringify([...(ruleFor(row.user_id)?.allowed_statuses ?? [])].sort());

        return (
          <div key={row.user_id} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <ListChecks className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-medium truncate">{row.name}</span>
                <Badge variant="outline" className="text-[10px]">{ROLE_LABEL[row.role] || row.role}</Badge>
                {usingDefault ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Role default{def === 'all' ? ' — all statuses' : ` — ${def.length} statuses`}
                  </Badge>
                ) : (
                  <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    Custom — {picked.length} selected
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!usingDefault && (
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5"
                    onClick={() => setDraft((p) => ({ ...p, [row.user_id]: [] }))}>
                    <RotateCcw className="w-3.5 h-3.5" /> Use role default
                  </Button>
                )}
                <Button size="sm" className="h-8" disabled={!dirty || savingId === row.user_id}
                  onClick={() => save(row)}>
                  {savingId === row.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
              {STATUS_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={picked.includes(o.value)} onCheckedChange={() => toggle(row.user_id, o.value)} />
                  <span className="truncate">{labels?.[o.value] || o.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatusPermissionsTab;
