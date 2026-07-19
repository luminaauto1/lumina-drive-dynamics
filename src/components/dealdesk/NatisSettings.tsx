import { useEffect, useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeskSettings, useSaveDeskSettings } from '@/hooks/dealdesk/useDealDesk';

export function NatisSettings({ canEdit }: { canEdit: boolean }) {
  const { data: settings, isLoading } = useDeskSettings();
  const save = useSaveDeskSettings();
  const [windowDays, setWindowDays] = useState(21);
  const [warnDays, setWarnDays] = useState(5);

  useEffect(() => {
    if (settings) { setWindowDays(settings.natis_window_days); setWarnDays(settings.natis_warn_days); }
  }, [settings]);

  if (isLoading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  return (
    <Card>
      <CardHeader className="py-3"><CardTitle className="text-base">Natis settings</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Natis window (days)</Label>
            <Input type="number" value={windowDays} disabled={!canEdit} onChange={(e) => setWindowDays(Number(e.target.value) || 0)} />
            <p className="text-[11px] text-muted-foreground">Days allowed from delivery before Natis is overdue. Default 21.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Warn within (days)</Label>
            <Input type="number" value={warnDays} disabled={!canEdit} onChange={(e) => setWarnDays(Number(e.target.value) || 0)} />
            <p className="text-[11px] text-muted-foreground">Flag a deal as urgent when this many days or fewer remain. Default 5.</p>
          </div>
        </div>
        {canEdit ? (
          <div className="flex justify-end border-t border-border pt-4">
            <Button onClick={() => save.mutate({ natis_window_days: windowDays, natis_warn_days: warnDays })} disabled={save.isPending} className="w-full gap-2 sm:w-auto">
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save settings
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Only an admin can change these.</p>
        )}
      </CardContent>
    </Card>
  );
}
