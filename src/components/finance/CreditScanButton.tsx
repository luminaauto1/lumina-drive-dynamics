// CreditScanButton.tsx — Finance summary → CarTrust (Kredo) Credit Report Scan.
//
// One SMALL per-row button (sits between the credit-check and notes dropdowns —
// no detail view needed). On the CarTrust tab the user clicks the SAME
// "⚡ Fill Signio" bookmark they already have: the engine (public/signio-fill.js)
// detects the Kredo host, opens the Credit Scan modal, fills ID / names / cell /
// email / gross income + a normalised total-expenses figure, ticks the consent
// and clicks Generate Report itself (owner asked for one-click submission).
//
// TAB REUSE (the login workaround): CarTrust keeps its login token in
// sessionStorage, which is PER-TAB — a brand-new tab is always logged out. So
// this button keeps ONE dedicated CarTrust tab (JS ref + named window
// 'luminaKredoScan', which the engine re-labels after each run so the tab stays
// findable even after Lumina reloads) and re-focuses it per scan. Log in once,
// scan all day.
//
// PAYLOAD: a reused cross-origin tab's window.name can't be rewritten from
// here, so the engine asks THIS page for the freshest applicant over
// postMessage (reply locked to the CarTrust origin). window.name still carries
// the payload on a first open — it survives the login redirect — but only as a
// fallback, stamped with ts so the engine refuses to auto-submit stale data.

import { ScanSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const KREDO_URL = 'https://clientzone.kredo.co.za/applicant-list/2bcd4553-b85d-4967-9a4b-0ab8fc2d367c';
const KREDO_ORIGIN = 'https://clientzone.kredo.co.za';
const KREDO_TAB_NAME = 'luminaKredoScan';
const HANDOFF_PREFIX = 'LUMINA_KREDO:';

// Raw fields only — the engine does all normalisation (phone 27→0, gross rounding,
// expenses itemised-parse + realistic floor/cap collapsed to ONE total).
function buildKredoPayload(app: any) {
  return {
    kredo: true,
    ts: Date.now(),
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

// Window-level (not module-level) so the relay survives Vite HMR without
// duplicate listeners answering with a stale closure, and every listener reads
// the CURRENT payload — the engine's postMessage request always gets the LAST
// clicked applicant, so a reused tab can never fill a previous person. The
// engine also refuses payloads older than 10 minutes (scans are billed).
let kredoWin: Window | null = null;

function ensureRelay() {
  const w = window as any;
  if (w.__luminaKredoRelay) return;
  w.__luminaKredoRelay = true;
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.origin !== KREDO_ORIGIN) return;
    const payload = (window as any).__luminaKredoPayload;
    if (e?.data?.type !== 'LUMINA_KREDO_REQ' || !payload || !e.source) return;
    (e.source as Window).postMessage({ type: 'LUMINA_KREDO_PAYLOAD', payload }, KREDO_ORIGIN);
  });
}

export function CreditScanButton({ application }: { application: any }) {
  const { toast } = useToast();

  const openKredo = () => {
    ensureRelay();
    const payload = buildKredoPayload(application);
    (window as any).__luminaKredoPayload = payload;

    // Reuse the dedicated CarTrust tab: live JS ref first, then the named
    // window (finds it even after a Lumina reload, once the engine has
    // restored the tab's name). Only when neither exists is a tab created.
    let win = kredoWin && !kredoWin.closed ? kredoWin : window.open('', KREDO_TAB_NAME);
    if (!win) {
      toast({ title: 'Pop-up blocked', description: 'Allow pop-ups for Lumina so it can open CarTrust.', variant: 'destructive' });
      return;
    }
    kredoWin = win;

    // Cross-origin access throws → the tab is already on CarTrust (logged in or
    // on its login page) → leave it be. Same-origin (fresh about:blank, or a tab
    // that wandered back to a Lumina URL) → hand off via window.name + navigate.
    let fresh = false;
    try { fresh = typeof win.location.href === 'string'; } catch { /* already on CarTrust */ }
    if (fresh) {
      win.name = HANDOFF_PREFIX + JSON.stringify(payload);
      win.location.href = KREDO_URL;
    }
    win.focus();

    toast({
      title: fresh ? 'CarTrust opened' : 'CarTrust tab focused',
      description: `${fresh ? 'Log in if asked, then click' : 'Click'} your ⚡ Fill Signio bookmark there — it fills and submits the credit scan for ${application.full_name || 'the applicant'}.`,
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
