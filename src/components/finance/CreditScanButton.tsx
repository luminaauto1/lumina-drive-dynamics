// CreditScanButton.tsx — Finance summary → CarTrust (Kredo) Credit Report Scan.
//
// One SMALL per-row button (sits between the credit-check and notes dropdowns —
// no detail view needed). Clicking it opens clientzone.kredo.co.za in a new tab
// with the applicant payload on window.name (no PII in the URL — the exact
// handoff Push-to-Signio uses). On that tab the user clicks the SAME
// "⚡ Fill Signio" bookmark they already have: the engine (public/signio-fill.js)
// detects the Kredo host, opens the Credit Scan modal, fills ID / names / cell /
// email / gross income + a normalised total-expenses figure, ticks the consent
// and clicks Generate Report itself (owner asked for one-click submission).
//
// window.name survives the CarTrust login redirect, so an expired session just
// means: log in, then click the bookmark — the payload is still there.

import { ScanSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const KREDO_URL = 'https://clientzone.kredo.co.za/applicant-list/2bcd4553-b85d-4967-9a4b-0ab8fc2d367c';
const HANDOFF_PREFIX = 'LUMINA_KREDO:';

// Raw fields only — the engine does all normalisation (phone 27→0, gross rounding,
// expenses itemised-parse + realistic floor/cap collapsed to ONE total).
function buildKredoPayload(app: any) {
  return {
    kredo: true,
    id_number: app.id_number,
    first_name: app.first_name,
    last_name: app.last_name,
    full_name: app.full_name || [app.first_name, app.last_name].filter(Boolean).join(' '),
    phone: app.phone,
    email: app.email,
    gross_salary: app.gross_salary,
    net_salary: app.net_salary,
    total_expenses: app.expenses_summary,
  };
}

export function CreditScanButton({ application }: { application: any }) {
  const { toast } = useToast();

  const openKredo = () => {
    const win = window.open('about:blank', '_blank');
    if (!win) {
      toast({ title: 'Pop-up blocked', description: 'Allow pop-ups for Lumina so it can open CarTrust.', variant: 'destructive' });
      return;
    }
    win.name = HANDOFF_PREFIX + JSON.stringify(buildKredoPayload(application));
    win.location.href = KREDO_URL;
    toast({
      title: 'CarTrust opened',
      description: `On that tab, click your ⚡ Fill Signio bookmark — it fills and submits the credit scan for ${application.full_name || 'the applicant'}.`,
    });
  };

  return (
    <Button
      variant="outline"
      size="icon"
      title="Credit Report Scan (CarTrust)"
      className="h-7 w-7 shrink-0 border-sky-500/30 text-sky-400 hover:bg-sky-500/10 hover:text-sky-300"
      onClick={(e) => { e.stopPropagation(); openKredo(); }}
    >
      <ScanSearch className="h-3.5 w-3.5" />
    </Button>
  );
}
