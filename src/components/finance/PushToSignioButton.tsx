// PushToSignioButton.tsx — Deal Room → Signio auto-fill (BOOKMARKLET delivery).
//
// Mirrors the proven "Load to Hatfield" flow: clicking the button opens a "Prepared
// for Signio" modal that (1) opens the Signio form in a new tab with the payload on
// window.name (no PII in the URL), and (2) gives the user a "⚡ Fill Signio" BOOKMARKLET
// to drag to their bookmarks bar ONCE. On the Signio tab they click that bookmark and the
// whole engine (public/signio-fill.js, inlined into the bookmarklet) reads window.name and
// fills steps 1–5, stopping at the Declaration (reCAPTCHA stays human).
//
// Why a bookmarklet (not a Tampermonkey userscript): no browser extension to install —
// the bookmarklet inlines the engine, so it also isn't affected by Signio's CSP.
// The fill logic is UNCHANGED (React native-setter technique); only delivery changed.

import { useEffect, useState } from 'react';
import { Send, ExternalLink, Loader2, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SIGNIO_URL =
  'https://goa.signio.co.za/ThirdPartyIntegration/?uuid=0000019d-8b14-51e0-a0c4-f22179bee56a';

const HANDOFF_PREFIX = 'LUMINA_SIGNIO:';

// Pass RAW fields — the engine handles all normalization (gender, bank→branch,
// employment_type, qualification, ID-Luhn, etc.) and flags anything it can't fill.
function buildSignioPayload(app: any) {
  const parts = String(app.street_address || '')
    .split(/[,\n]/)
    .map((s: string) => s.trim())
    .filter(Boolean);
  const suburb = app.suburb || (parts.length >= 2 ? parts[parts.length - 2] : '');
  const kinTokens = String(app.kin_name || '').trim().split(/\s+/).filter(Boolean);

  return {
    id_number: app.id_number,
    id_type: app.id_type,
    first_name: app.first_name,
    last_name: app.last_name,
    full_name: app.full_name || [app.first_name, app.last_name].filter(Boolean).join(' '),
    email: app.email,
    phone: app.phone,
    gender: app.gender,
    marital_status: app.marital_status,
    marriage_type: app.marriage_type,
    spouse_first_name: app.spouse_first_name,
    spouse_surname: app.spouse_surname,
    nationality: app.nationality,
    qualification: app.qualification,
    street_address: app.street_address,
    suburb,
    area_code: app.area_code,
    kin_relation: app.kin_relation,
    kin_first_name: app.kin_first_name || kinTokens[0],
    kin_surname: app.kin_surname || kinTokens.slice(1).join(' ') || undefined,
    kin_contact: app.kin_contact,
    employer_name: app.employer_name,
    job_title: app.job_title,
    employment_type: app.employment_type,
    employment_period: app.employment_period,
    employer_address: app.employer_address,
    employer_suburb: app.employer_suburb,
    bank_name: app.bank_name,
    account_type: app.account_type,
    account_number: app.account_number,
    gross_salary: app.gross_salary,
    net_salary: app.net_salary,
    additional_income: app.additional_income,
    total_expenses: app.expenses_summary,
  };
}

const luhnValid = (id?: string) => {
  if (!/^\d{13}$/.test(id || '')) return false;
  let sum = 0, alt = false;
  const s = id as string;
  for (let i = s.length - 1; i >= 0; i--) { let d = +s[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } sum += d; alt = !alt; }
  return sum % 10 === 0;
};
const KNOWN_BANKS = /capitec|fnb|first national|absa|standard|nedbank|discovery|tyme|african bank|bidvest|investec/i;

// Pre-fill "double-check" list shown in the modal (what a human must verify/complete).
function computeChecks(app: any, payload: any): string[] {
  const out: string[] = [];
  if (!luhnValid(app.id_number)) out.push('ID number missing or not a valid SA ID — fix before submit.');
  if (+app.gross_salary && +app.net_salary && +app.net_salary > +app.gross_salary) out.push('Net salary is higher than gross — likely swapped; verify.');
  if (!payload.suburb) out.push('No suburb on file — pick the suburb/town result on the form.');
  if (app.bank_name && !KNOWN_BANKS.test(String(app.bank_name))) out.push(`Bank "${app.bank_name}" isn't auto-mapped — pick the bank + branch code.`);
  if (!app.employment_period) out.push('Employer tenure unknown — defaults to 1 yr; verify the years/months.');
  if (!app.kin_relation) out.push('Next-of-kin relation not set — pick it on the form.');
  out.push('You still pick the salesperson on the form, and confirm the bank account number.');
  return out;
}

export function PushToSignioButton({ application }: { application: any }) {
  const [open, setOpen] = useState(false);
  const [bookmarklet, setBookmarklet] = useState<string | null>(null);
  const [bmError, setBmError] = useState(false);

  const payload = application ? buildSignioPayload(application) : null;
  const checks = application && payload ? computeChecks(application, payload) : [];

  // Build the bookmarklet by inlining the hosted engine (CSP-proof; single source).
  useEffect(() => {
    if (!open || bookmarklet || bmError) return;
    let cancelled = false;
    fetch('/signio-fill.js?v=' + Date.now())
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
      .then((src) => { if (!cancelled) setBookmarklet('javascript:' + encodeURIComponent(src + ';void 0;')); })
      .catch(() => { if (!cancelled) setBmError(true); });
    return () => { cancelled = true; };
  }, [open, bookmarklet, bmError]);

  const openSignio = () => {
    const win = window.open('about:blank', '_blank');
    if (!win) { alert('Allow pop-ups for Lumina so it can open Signio.'); return; }
    win.name = HANDOFF_PREFIX + JSON.stringify(payload);
    win.location.href = SIGNIO_URL;
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="default" className="gap-2">
        <Send className="h-4 w-4" />
        Push to Signio
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" /> Prepared for Signio
            </DialogTitle>
          </DialogHeader>

          {checks.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> Double-check on the form</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {checks.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {/* Step 1 — open the form (payload handed off via window.name). */}
          <div className="space-y-1">
            <Button onClick={openSignio} className="w-full gap-2">
              <ExternalLink className="h-4 w-4" /> 1 — Open Signio form
            </Button>
            <p className="text-[11px] text-muted-foreground">Opens Signio in a new tab. No personal data goes in the URL.</p>
          </div>

          {/* Step 2 — click the bookmark on that tab. */}
          <p className="text-xs text-muted-foreground">
            2 — On the opened Signio tab, click your <strong>⚡ Fill Signio</strong> bookmark to populate it, then review &amp; submit.
          </p>

          {/* First time only — install the bookmarklet by dragging it to the bookmarks bar. */}
          <div className="rounded-md border border-border bg-card p-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">First time only</p>
            <p className="text-xs text-muted-foreground">Drag this button up to your browser's bookmarks bar (then you never do it again):</p>
            {bmError ? (
              <p className="text-xs text-red-400">Couldn't build the auto-fill bookmark — refresh and try again.</p>
            ) : !bookmarklet ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing…</div>
            ) : (
              <a
                href={bookmarklet}
                draggable
                onClick={(e) => e.preventDefault()}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/uri-list', bookmarklet);
                  e.dataTransfer.setData('text/plain', bookmarklet);
                }}
                title="Drag me to your bookmarks bar (don't click here)"
                className="inline-flex items-center gap-1.5 rounded-md bg-yellow-400 px-3 py-1.5 text-sm font-semibold text-black no-underline cursor-grab active:cursor-grabbing"
              >
                ⚡ Fill Signio
              </a>
            )}
            <p className="text-[10px] text-muted-foreground">If your bookmarks bar is hidden, press Ctrl/⌘+Shift+B to show it first.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
