import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { normalizeEmail, normalizePhone } from '@/lib/normalizeContact';
import { User, Car, FileText, Loader2 } from 'lucide-react';

/** Event any component can dispatch to open the global search. */
export const OPEN_GLOBAL_SEARCH_EVENT = 'lumina:open-search';

// `search` carries every searchable field so cmdk's built-in fuzzy filter keeps
// the item regardless of which field the server matched (phone, VIN, email…).
interface AppResult { id: string; name: string; detail: string; search: string; }
interface VehicleResult { id: string; name: string; detail: string; search: string; }
interface LeadResult { id: string; name: string; detail: string; search: string; }

/**
 * Global command-palette search (Cmd/Ctrl+K). Mounted once in AdminLayout so it
 * is available on every admin page. Searches finance applications (clients),
 * vehicles and leads, and navigates to the relevant record.
 */
const GlobalSearch = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<AppResult[]>([]);
  const [vehicles, setVehicles] = useState<VehicleResult[]>([]);
  const [leads, setLeads] = useState<LeadResult[]>([]);

  // Open via Cmd/Ctrl+K or a dispatched event (e.g. the sidebar button).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_GLOBAL_SEARCH_EVENT, onOpen);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_GLOBAL_SEARCH_EVENT, onOpen);
    };
  }, []);

  // Reset results when the dialog closes.
  useEffect(() => {
    if (!open) { setQuery(''); setApps([]); setVehicles([]); setLeads([]); }
  }, [open]);

  const runSearch = useCallback(async (q: string) => {
    const term = q.trim();
    if (term.length < 2) { setApps([]); setVehicles([]); setLeads([]); setLoading(false); return; }
    setLoading(true);
    const like = `%${term}%`;
    try {
      const [appRes, vehRes, leadRes] = await Promise.all([
        supabase.from('finance_applications')
          .select('id, full_name, first_name, last_name, email, phone, status')
          .or(`full_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
          .limit(6),
        supabase.from('vehicles')
          .select('id, make, model, year, stock_number, vin, registration_number, status')
          .or(`make.ilike.${like},model.ilike.${like},stock_number.ilike.${like},vin.ilike.${like},registration_number.ilike.${like}`)
          .limit(6),
        supabase.from('leads')
          .select('id, client_name, client_email, client_phone, pipeline_stage')
          .or(`client_name.ilike.${like},client_email.ilike.${like},client_phone.ilike.${like}`)
          .limit(6),
      ]);

      // One person = one result. The same human can have several applications
      // (one per car) — group them by email (phone fallback) so the search shows
      // a single profile, not a row per car. We keep the most-advanced application
      // as the entry point; the profile page then aggregates them all.
      const STATUS_RANK: Record<string, number> = {
        finalized: 6, vehicle_delivered: 6, contract_signed: 5, approved: 4,
        pre_approved: 4, contract_sent: 3, pending: 1,
      };
      const rank = (s?: string) => STATUS_RANK[(s || '').toLowerCase()] ?? 2;
      const appMap = new Map<string, { app: any; count: number }>();
      for (const a of (appRes.data || []) as any[]) {
        const key = normalizeEmail(a.email) || normalizePhone(a.phone) || `id:${a.id}`;
        const existing = appMap.get(key);
        if (!existing) appMap.set(key, { app: a, count: 1 });
        else { existing.count += 1; if (rank(a.status) > rank(existing.app.status)) existing.app = a; }
      }
      setApps([...appMap.values()].map(({ app: a, count }) => ({
        id: a.id,
        name: a.full_name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Unnamed',
        detail: [a.email, a.phone, count > 1 ? `${count} cars` : a.status?.replace(/_/g, ' ')].filter(Boolean).join(' • '),
        search: [a.full_name, a.first_name, a.last_name, a.email, a.phone].filter(Boolean).join(' '),
      })));
      setVehicles((vehRes.data || []).map((v: any) => ({
        id: v.id,
        name: `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || 'Vehicle',
        detail: [v.stock_number, v.registration_number, v.status].filter(Boolean).join(' • '),
        search: [v.make, v.model, v.year, v.stock_number, v.vin, v.registration_number].filter(Boolean).join(' '),
      })));
      // Hide leads whose email/phone already appear in the application results (same person).
      const appKeys = new Set(
        (appRes.data || []).flatMap((a: any) => [a.email?.toLowerCase(), a.phone?.replace(/\D/g, '')].filter(Boolean))
      );
      setLeads((leadRes.data || [])
        .filter((l: any) => {
          const e = l.client_email?.toLowerCase();
          const p = l.client_phone?.replace(/\D/g, '');
          return !(e && appKeys.has(e)) && !(p && appKeys.has(p));
        })
        .map((l: any) => ({
          id: l.id,
          name: l.client_name || 'Unnamed lead',
          detail: [l.client_phone, l.client_email, l.pipeline_stage?.replace(/_/g, ' ')].filter(Boolean).join(' • '),
          search: [l.client_name, l.client_email, l.client_phone].filter(Boolean).join(' '),
        })));
    } catch (err) {
      console.error('[GlobalSearch] failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce the query.
  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const go = (path: string) => { setOpen(false); navigate(path); };

  const hasResults = apps.length + vehicles.length + leads.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      {/* shouldFilter=false: we filter server-side, render results as-is. */}
      <CommandInput
        placeholder="Search clients, applications, vehicles…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.trim().length < 2 ? (
          <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
        ) : loading && !hasResults ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching…
          </div>
        ) : !hasResults ? (
          <CommandEmpty>No matches found.</CommandEmpty>
        ) : null}

        {apps.length > 0 && (
          <CommandGroup heading="Clients & Applications">
            {apps.map((a) => (
              <CommandItem key={`app-${a.id}`} value={`${a.search} ${a.id}`} onSelect={() => go(`/admin/clients/${a.id}`)}>
                <User className="mr-2 h-4 w-4 text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-sm">{a.name}</span>
                  {a.detail && <span className="text-xs text-muted-foreground">{a.detail}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {vehicles.length > 0 && (
          <CommandGroup heading="Vehicles">
            {vehicles.map((v) => (
              <CommandItem key={`veh-${v.id}`} value={`${v.search} ${v.id}`} onSelect={() => go('/admin/inventory')}>
                <Car className="mr-2 h-4 w-4 text-emerald-400" />
                <div className="flex flex-col">
                  <span className="text-sm">{v.name}</span>
                  {v.detail && <span className="text-xs text-muted-foreground">{v.detail}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {leads.length > 0 && (
          <CommandGroup heading="Leads">
            {leads.map((l) => (
              <CommandItem key={`lead-${l.id}`} value={`${l.search} ${l.id}`} onSelect={() => go('/admin/leads')}>
                <FileText className="mr-2 h-4 w-4 text-amber-400" />
                <div className="flex flex-col">
                  <span className="text-sm">{l.name}</span>
                  {l.detail && <span className="text-xs text-muted-foreground">{l.detail}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default GlobalSearch;
