// Shared client search-and-pick input (extracted from the Invoice Creator so
// the OTP Generator and any future document tool prefill clients the same way).
// Searches finance_applications by name/phone (debounced) and hands the picked
// client's contact block to the caller.
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

export interface ClientPick {
  name: string;
  idNumber: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
}

export const ClientSearchInput = ({ label, onPick }: { label: string; onPick: (c: ClientPick) => void }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let stale = false;
    const t = setTimeout(async () => {
      // PostgREST's .or() treats , ( ) as filter syntax — strip them so a
      // search like "Smith, John" or "ABC (Pty)" can't break the query.
      const term = q.trim().replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
      if (term.length < 3) { setResults([]); setOpen(false); return; }
      const { data, error } = await supabase
        .from('finance_applications')
        .select('id, full_name, first_name, last_name, id_number, phone, email, street_address, area_code')
        .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,last_name.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(8);
      if (stale) return; // a newer keystroke superseded this request
      if (error) { console.error('[client search]', error.message); setResults([]); setOpen(false); return; }
      setResults(data || []);
      setOpen((data || []).length > 0);
    }, 300);
    return () => { stale = true; clearTimeout(t); };
  }, [q]);

  return (
    <div className="space-y-2 relative">
      <Label>{label}</Label>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients by name or phone…" />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-64 overflow-auto">
          {results.map((r) => {
            const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || r.full_name || '—';
            return (
              <button
                key={r.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60"
                onClick={() => {
                  onPick({
                    name,
                    idNumber: r.id_number || '',
                    phone: r.phone || '',
                    email: r.email || '',
                    address: r.street_address || '',
                    postalCode: r.area_code || '',
                  });
                  setQ(''); setOpen(false);
                }}
              >
                <span className="font-medium">{name}</span>
                <span className="text-muted-foreground ml-2 text-xs">{r.phone || ''}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
