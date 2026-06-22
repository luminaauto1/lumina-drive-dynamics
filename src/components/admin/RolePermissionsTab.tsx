import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Loader2, Save, Lock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  APP_SECTIONS, DEFAULT_ROLE_SECTIONS, ROLE_LABELS, ConfigurableRole,
} from '@/lib/permissions';
import { useRoleSectionAccess, useUpdateRoleSections } from '@/hooks/useRolePermissions';

const ROLES: ConfigurableRole[] = ['sales_agent', 'f_and_i', 'senior_f_and_i', 'accountant'];

const setsEqual = (a: Set<string>, b: Set<string>) => {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
};

const RolePermissionsTab = () => {
  const { data, isLoading } = useRoleSectionAccess();
  const update = useUpdateRoleSections();
  const [draft, setDraft] = useState<Record<ConfigurableRole, Set<string>>>();

  useEffect(() => {
    if (data) {
      setDraft({
        sales_agent: new Set(data.sales_agent),
        f_and_i: new Set(data.f_and_i),
        senior_f_and_i: new Set(data.senior_f_and_i),
        accountant: new Set(data.accountant),
      });
    }
  }, [data]);

  const toggle = (role: ConfigurableRole, key: string) =>
    setDraft((prev) => {
      if (!prev) return prev;
      const next = new Set(prev[role]);
      if (next.has(key)) next.delete(key); else next.add(key);
      return { ...prev, [role]: next };
    });

  const resetDefaults = (role: ConfigurableRole) =>
    setDraft((prev) => (prev ? { ...prev, [role]: new Set(DEFAULT_ROLE_SECTIONS[role]) } : prev));

  const isDirty = (role: ConfigurableRole) =>
    !!draft && !!data && !setsEqual(draft[role], new Set(data[role]));

  const save = (role: ConfigurableRole) =>
    draft && update.mutate({ role, sections: [...draft[role]] });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-6 space-y-6"
    >
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Roles &amp; Permissions</h2>
          <p className="text-sm text-muted-foreground">
            Control which areas of the system each role can open. Changes apply to everyone with that role
            (sidebar + page access). Data is always additionally protected at the database level, so a role
            never sees records it isn't entitled to even if granted a section.
          </p>
        </div>
      </div>

      {/* Admin = always full */}
      <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="flex items-center gap-2 text-sm">
          <Lock className="w-4 h-4 text-amber-400" />
          <span className="font-medium">Admin</span>
          <span className="text-muted-foreground">— full access to everything (not editable)</span>
        </div>
        <Badge variant="outline" className="border-amber-500/40 text-amber-400">All areas</Badge>
      </div>

      {isLoading || !draft ? (
        <div className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : (
        <div className="space-y-5">
          {ROLES.map((role) => (
            <div key={role} className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{ROLE_LABELS[role]}</span>
                  <Badge variant="secondary" className="text-[10px]">{draft[role].size} area{draft[role].size === 1 ? '' : 's'}</Badge>
                  {isDirty(role) && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">unsaved</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground"
                    onClick={() => resetDefaults(role)}>
                    <RotateCcw className="w-3.5 h-3.5" /> Defaults
                  </Button>
                  <Button type="button" size="sm" className="h-8 gap-1.5"
                    disabled={!isDirty(role) || update.isPending}
                    onClick={() => save(role)}>
                    {update.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                {APP_SECTIONS.map((s) => (
                  <label key={s.key} className="flex items-start gap-2 cursor-pointer py-0.5">
                    <Checkbox
                      className="mt-0.5"
                      checked={draft[role].has(s.key)}
                      onCheckedChange={() => toggle(role, s.key)}
                    />
                    <span className="text-sm leading-tight">
                      {s.label}
                      <span className="block text-[11px] text-muted-foreground">{s.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default RolePermissionsTab;
