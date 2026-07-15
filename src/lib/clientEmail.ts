// ONE shared client-email dispatcher (redesign P4). Previously four call sites
// each hand-rolled the same EmailJS fetch with the same hardcoded ids; now the
// ids live here once and every CLIENT send is recorded in client_audit_logs so
// the per-client/per-application timeline shows exactly what was emailed.
//
// TRANSPORT UNCHANGED BY DESIGN: still the browser-side EmailJS dispatch the
// system has always used (same service/template/public key — byte-equal
// payload). Moving it server-side needs the owner's EmailJS private key
// ("Allow non-browser applications"), so that swap is parked until provided.
import { supabase } from '@/integrations/supabase/client';

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';
const EMAILJS_SERVICE_ID = 'service_myacl2m';
const EMAILJS_TEMPLATE_ID = 'template_b2igduv';
const EMAILJS_PUBLIC_KEY = 'pWT3blntfZk-_syL4'; // public by design (browser SDK key)

export async function sendClientEmail(opts: {
  to: string;
  subject: string;
  html: string;
  /** 'client' (default) logs to the comms timeline; 'staff' (e.g. credentials
   *  emails) sends identically but is not a client message, so no log. */
  audience?: 'client' | 'staff';
  applicationId?: string | null;
  clientPhone?: string | null;
}): Promise<boolean> {
  const { to, subject, html, audience = 'client' } = opts;
  let ok = false;
  let detail: string | null = null;
  try {
    const res = await fetch(EMAILJS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: { to_email: to, subject, html_message: html },
      }),
    });
    ok = res.ok;
    if (!res.ok) {
      detail = (await res.text()).slice(0, 180);
      console.error('EmailJS API Rejected the request:', detail);
    } else {
      console.log('EmailJS successfully received the payload.');
    }
  } catch (err) {
    detail = String(err);
    console.error('Frontend failed to reach EmailJS:', err);
  }
  // Comms log — what was emailed to the client (sent AND failed attempts).
  // Logging never blocks or alters the send outcome.
  if (audience === 'client') {
    try {
      await supabase.from('client_audit_logs').insert([{
        client_email: to,
        client_phone: opts.clientPhone ?? null,
        application_id: opts.applicationId ?? null,
        author_name: 'System',
        action_type: 'client_message',
        note: `Email ${ok ? 'sent' : 'send FAILED'} — ${subject}${detail ? ` (${detail})` : ''}`,
      } as any]);
    } catch { /* never block a send on logging */ }
  }
  return ok;
}
