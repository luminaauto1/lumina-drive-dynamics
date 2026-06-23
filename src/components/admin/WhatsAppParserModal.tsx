import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Sparkles, FileText, Loader2, AlertTriangle, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { publicApiHeaders } from '@/lib/publicApi';
import { toast } from 'sonner';
import { generateFinancePDF } from '@/lib/generateFinancePDF';

interface WhatsAppParserModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface AddressMeta {
  formatted_address: string;
  street: string;
  suburb: string;
  city: string;
  province: string;
  postal_code: string;
  requiresManualVerification: boolean;
  raw: string;
}

interface WorkplaceMeta {
  formatted_address: string;
  source: "google_places" | "client_provided" | "none";
  requiresManualInput: boolean;
  query: string;
  match_name: string;
  api_status?: string;
  api_error?: string;
}

export default function WhatsAppParserModal({ open, onOpenChange }: WhatsAppParserModalProps) {
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<Record<string, string> | null>(null);
  const [addressMeta, setAddressMeta] = useState<AddressMeta | null>(null);
  const [workplaceMeta, setWorkplaceMeta] = useState<WorkplaceMeta | null>(null);

  // Bulletproof self-healing alternating-line parser.
  // Forward-scans line-by-line, skips anomalies (e.g. "Source Id..."), and
  // protects against blank values that would otherwise cause index drift.
  // Returns null if format is not recognised so we fall back to the AI parser.
  const parseAlternatingFormat = (text: string): Record<string, string> | null => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Canonical key map (lowercased label -> internal payload field).
    // Internal field names match downstream consumers (PDF + insert payload).
    const KEY_MAP: Record<string, string> = {
      'bank': 'bank_name',
      'bank name': 'bank_name',
      'city': '__city',
      'name': 'first_name',
      'first name': 'first_name',
      'email': 'email',
      'email address': 'email',
      'gender': 'gender',
      'surname': 'last_name',
      'last name': 'last_name',
      'whatsapp name': 'whatsapp_name',
      'province': '__province',
      'area code': '__area_code',
      'postal code': '__area_code',
      'id number': 'id_number',
      'id no': 'id_number',
      'job title': 'job_title',
      'occupation': 'job_title',
      'net income': 'net_income',
      'net salary': 'net_income',
      'company name': 'employer_name',
      'employer': 'employer_name',
      'employer name': 'employer_name',
      'gross salary': 'gross_income',
      'gross income': 'gross_income',
      'account number': 'account_number',
      'contact number': 'phone',
      'cell number': 'phone',
      'phone': 'phone',
      'phone number': 'phone',
      'marital status': 'marital_status',
      'street address': '__street',
      'physical address': '__street',
      'type of account': 'account_type',
      'account type': 'account_type',
      'workplace address': 'workplace_address',
      'work address': 'workplace_address',
      'employer address': 'workplace_address',
      'next of kin number': 'kin_phone',
      'next of kin contact': 'kin_phone',
      'next of kin name and surname': 'kin_name',
      'next of kin name': 'kin_name',
      'next of kin': 'kin_name',
      'duration at address': 'duration_at_address',
      'summary of expenses': 'living_expenses',
      'expenses': 'living_expenses',
      'living expenses': 'living_expenses',
      'duration at employer': 'employment_start',
      'employment start': 'employment_start',
      'employment period': 'employment_start',
      'employment type': 'employment_type',
      'employment status': 'employment_type',
      'credit profile status': 'credit_status',
      'highest qualification': 'highest_qualification',
      'spouse name and surname': 'spouse_name',
      'spouse id': 'spouse_id',
      'spouse cell number': 'spouse_phone',
    };

    const normalize = (s: string) =>
      s.replace(/[:\-•]+\s*$/, '').toLowerCase().trim();

    const out: Record<string, string> = {};
    let matches = 0;

    let i = 0;
    while (i < lines.length) {
      const currentLine = normalize(lines[i]);

      // Anomaly skip — e.g. "Source Id120242531770620172" (merged garbage line).
      if (currentLine.startsWith('source id') || currentLine.startsWith('source_id')) {
        i += 1;
        continue;
      }

      const target = KEY_MAP[currentLine];
      if (!target) {
        // Unknown line — realign by advancing one step instead of two.
        i += 1;
        continue;
      }

      const rawNext = lines[i + 1] !== undefined ? lines[i + 1].trim() : '';
      const nextIsKey = rawNext.length > 0 && !!KEY_MAP[normalize(rawNext)];

      let value = '';
      if (nextIsKey || rawNext.length === 0) {
        // Field was left blank — do NOT consume the next key line.
        value = '';
        i += 1;
      } else {
        value = rawNext;
        i += 2;
      }

      // ENFORCE STRING — never let JS coerce IDs / account numbers to Number
      // (would drop leading zeros and lose precision past 2^53).
      out[target] = String(value);
      if (value) matches++;
    }

    if (matches < 3) return null; // not this format

    // Merge split address fields into a single home/physical address string.
    const addrParts = [out.__street, out.__city, out.__province, out.__area_code]
      .filter(Boolean);
    if (addrParts.length) out.physical_address = addrParts.join(', ');
    // Keep the postal/area code as a standalone field — Signio needs the residential
    // area_code for its address lookup, so it must survive to the DB (city already folds
    // into physical_address above).
    if (out.__area_code) out.area_code = out.__area_code;
    delete out.__street; delete out.__city; delete out.__province; delete out.__area_code;

    // Ensure all expected keys exist (default empty string)
    const EXPECTED = [
      'first_name','last_name','email','id_number','phone','gender','marital_status',
      'employer_name','job_title','gross_income','net_income','physical_address',
      'workplace_address','bank_name','account_number','account_type','living_expenses',
      'kin_name','kin_phone','employment_start','employment_type','area_code','highest_qualification','credit_status',
    ];
    EXPECTED.forEach((k) => { if (!(k in out)) out[k] = ''; });

    return out;
  };

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);

    // Try local alternating-line parser first
    const local = parseAlternatingFormat(rawText);
    if (local) {
      setParsedData(local);
      setAddressMeta(null);
      setWorkplaceMeta(null);
      setIsParsing(false);
      toast.success('Extraction complete (alternating-line format). Please review.');
      return;
    }

    toast.info('AI is decoding WhatsApp message...');

    try {
      const { data, error } = await supabase.functions.invoke('parse-whatsapp', {
        headers: publicApiHeaders(),
        body: { rawText },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.data) {
        setParsedData(data.data);
        setAddressMeta(data.address || null);
        setWorkplaceMeta(data.workplace || null);
        toast.success('Extraction complete. Please review.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to parse message.');
      console.error(err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpdateField = (key: string, value: string) => {
    setParsedData((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const ensureGoogleMaps = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).google?.maps?.places) return resolve(true);
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) return resolve(false);
      const existing = document.querySelector<HTMLScriptElement>('script[data-gmaps-loader="1"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(!!(window as any).google?.maps?.places));
        existing.addEventListener('error', () => resolve(false));
        return;
      }
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      s.async = true;
      s.defer = true;
      s.dataset.gmapsLoader = '1';
      s.onload = () => resolve(!!(window as any).google?.maps?.places);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
      setTimeout(() => resolve(!!(window as any).google?.maps?.places), 5000);
    });
  };

  const lookupBusinessAddress = async (businessName: string): Promise<string | null> => {
    try {
      const ready = await ensureGoogleMaps();
      if (!ready) return null;
      const g = (window as any).google;
      const service = new g.maps.places.PlacesService(document.createElement('div'));
      return await new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 4000);
        service.findPlaceFromQuery(
          { query: `${businessName} South Africa`, fields: ['formatted_address', 'name'] },
          (results: any[], status: string) => {
            clearTimeout(timer);
            if (status === 'OK' && results?.[0]?.formatted_address) {
              resolve(results[0].formatted_address);
            } else {
              resolve(null);
            }
          }
        );
      });
    } catch {
      return null;
    }
  };

  const handleDownloadPDF = async () => {
    if (!parsedData) return;
    try {
      // === ASYNC RACE CONDITION PATCH ===
      // 1. Build the base payload from the freshest parsed data (NOT React state).
      const parsedWhatsAppPayload: Record<string, any> = { ...parsedData };

      // 2. STRICTLY await Google Places resolution before touching the PDF.
      //    Always attempt when we have a business name — relying on a "looks weak"
      //    heuristic was masking races where a short raw string blocked enrichment.
      const businessName = String(parsedWhatsAppPayload.employer_name || '').trim();
      let fetchedAddress: string | null = null;
      if (businessName) {
        toast.info('Resolving workplace address via Google Places...');
        fetchedAddress = await lookupBusinessAddress(businessName);
        if (fetchedAddress) toast.success('Workplace address auto-resolved.');
      }

      // 3. Direct payload mutation — bypass React state entirely so the PDF
      //    generator receives the guaranteed-complete dataset on this tick.
      const finalPdfData: Record<string, any> = { ...parsedWhatsAppPayload };
      if (fetchedAddress) {
        finalPdfData.business_address = fetchedAddress;
        finalPdfData.business_address_auto = fetchedAddress;
        finalPdfData.workplace_address = fetchedAddress;
        finalPdfData.employer_address = fetchedAddress;
      }
      const resolvedWorkplace =
        finalPdfData.workplace_address || parsedWhatsAppPayload.workplace_address || '';

      // Map AI keys to FinanceApplication shape expected by generateFinancePDF
      const applicationObj: any = {
        id: crypto.randomUUID(),
        first_name: finalPdfData.first_name || '',
        last_name: finalPdfData.last_name || '',
        full_name: `${finalPdfData.first_name || ''} ${finalPdfData.last_name || ''}`.trim() || 'Unknown',
        id_number: finalPdfData.id_number || '',
        email: finalPdfData.email || '',
        phone: finalPdfData.phone || '',
        gender: finalPdfData.gender || '',
        marital_status: finalPdfData.marital_status || '',
        street_address: finalPdfData.physical_address || '',
        employer_name: finalPdfData.employer_name || '',
        workplace_address: resolvedWorkplace,
        employer_address: resolvedWorkplace,
        business_address_auto: resolvedWorkplace,
        job_title: finalPdfData.job_title || '',
        employment_period: finalPdfData.employment_start || '',
        gross_salary: Number(String(finalPdfData.gross_income || '').replace(/[^\d.]/g, '')) || null,
        net_salary: Number(String(finalPdfData.net_income || '').replace(/[^\d.]/g, '')) || null,
        expenses_summary: finalPdfData.living_expenses || '',
        bank_name: finalPdfData.bank_name || '',
        account_number: finalPdfData.account_number || '',
        kin_name: finalPdfData.kin_name || '',
        kin_contact: finalPdfData.kin_phone || '',
        status: 'pending',
        popia_consent: false,
        created_at: new Date().toISOString(),
      };

      // 4. Diagnostic — verify the address is in the payload BEFORE the PDF builds.
      console.log('PDF Payload injected:', applicationObj.business_address_auto);

      // 5. Generate the PDF synchronously off the mutated payload.
      await generateFinancePDF(applicationObj);

      // 2. Save FULL application to finance_applications (tagged as whatsapp_parser source)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const fullName = `${parsedData.first_name || ''} ${parsedData.last_name || ''}`.trim() || 'WhatsApp Lead';
        const grossNum = Number(String(parsedData.gross_income || '').replace(/[^\d.]/g, '')) || null;
        const netNum = Number(String(parsedData.net_income || '').replace(/[^\d.]/g, '')) || null;
        const insertPayload = {
          user_id: user.id,
          first_name: parsedData.first_name || 'Unknown',
          last_name: parsedData.last_name || '',
          full_name: fullName,
          email: parsedData.email || `wa-${Date.now()}@lumina.local`,
          phone: parsedData.phone || 'N/A',
          id_number: parsedData.id_number || null,
          gender: parsedData.gender || null,
          marital_status: parsedData.marital_status || null,
          street_address: parsedData.physical_address || null,
          area_code: parsedData.area_code || null,
          employer_name: parsedData.employer_name || null,
          employer_address: resolvedWorkplace || parsedData.workplace_address || null,
          business_address_auto: resolvedWorkplace || null,
          job_title: parsedData.job_title || null,
          employment_period: parsedData.employment_start || null,
          employment_type: parsedData.employment_type || null,
          account_type: parsedData.account_type || null,
          gross_salary: grossNum,
          net_salary: netNum,
          expenses_summary: parsedData.living_expenses || null,
          bank_name: parsedData.bank_name || null,
          account_number: parsedData.account_number || null,
          qualification: parsedData.highest_qualification || null,
          credit_score_status: parsedData.credit_status || null,
          kin_name: parsedData.kin_name || null,
          kin_contact: parsedData.kin_phone || null,
          status: 'pending',
          internal_status: 'new_lead',
          submission_source: 'whatsapp_parser',
          notes: `[WhatsApp Parser] Full application saved from parsed WhatsApp message.`,
        } as any;
        console.log('Inserting Finance App with payload:', insertPayload);
        const { error: insertError } = await supabase.from('finance_applications').insert([insertPayload]);
        if (insertError) console.warn('Application insert failed:', insertError);
      }

      toast.success('PDF Generated & Application Saved');
      setRawText('');
      setParsedData(null);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to process application');
    }
  };

  const reset = () => {
    setRawText('');
    setParsedData(null);
    setAddressMeta(null);
    setWorkplaceMeta(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto bg-zinc-950 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            WhatsApp to PDF Converter
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Paste the raw client reply below. AI will structure it and generate a finance PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {!parsedData ? (
            <div className="space-y-3">
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste the WhatsApp message here..."
                className="h-[300px] bg-black/50 border-white/10 text-xs font-mono"
              />
              <Button
                onClick={handleParse}
                disabled={isParsing || !rawText}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-10"
              >
                {isParsing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {isParsing ? 'Decoding Message...' : 'Decode with AI'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6 pb-10">
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded text-xs text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Review the extracted data below. You can correct any mistakes before generating the PDF.
              </div>

              {addressMeta?.requiresManualVerification && (
                <div className="bg-red-500/10 border border-red-500/40 p-3 rounded text-xs text-red-300 space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Address requires manual verification
                  </div>
                  <p className="text-red-300/80">
                    Google could not confidently match this address within South Africa. Please confirm the street, suburb, city and postal code below before generating the PDF.
                  </p>
                  {addressMeta.raw && (
                    <p className="text-red-300/60">
                      <span className="uppercase tracking-wider text-[10px]">Raw input:</span> {addressMeta.raw}
                    </p>
                  )}
                </div>
              )}

              {addressMeta && !addressMeta.requiresManualVerification && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded text-xs text-emerald-300 space-y-1">
                  <div className="font-semibold">Address normalized (ZA-bound)</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-emerald-300/80">
                    {addressMeta.street && <div><span className="text-emerald-500/60">Street:</span> {addressMeta.street}</div>}
                    {addressMeta.suburb && <div><span className="text-emerald-500/60">Suburb:</span> {addressMeta.suburb}</div>}
                    {addressMeta.city && <div><span className="text-emerald-500/60">City:</span> {addressMeta.city}</div>}
                    {addressMeta.province && <div><span className="text-emerald-500/60">Province:</span> {addressMeta.province}</div>}
                    {addressMeta.postal_code && <div><span className="text-emerald-500/60">Postal:</span> {addressMeta.postal_code}</div>}
                  </div>
                </div>
              )}

              {workplaceMeta && workplaceMeta.source === "google_places" && !workplaceMeta.requiresManualInput && (
                <div className="bg-sky-500/10 border border-sky-500/30 p-3 rounded text-xs text-sky-300 space-y-1">
                  <div className="font-semibold">Workplace auto-resolved via Google Places</div>
                  {workplaceMeta.match_name && (
                    <div className="text-sky-300/80"><span className="text-sky-500/60">Match:</span> {workplaceMeta.match_name}</div>
                  )}
                  <div className="text-sky-300/80"><span className="text-sky-500/60">Address:</span> {workplaceMeta.formatted_address}</div>
                </div>
              )}

              {workplaceMeta && workplaceMeta.requiresManualInput && (parsedData?.employer_name || '').trim() && (
                <div className="bg-red-500/10 border border-red-500/40 p-3 rounded text-xs text-red-300 space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Workplace address requires manual input
                  </div>
                  <p className="text-red-300/80">
                    Google Places could not confidently locate "{parsedData?.employer_name}" in South Africa. Please enter the workplace address manually below.
                  </p>
                  {workplaceMeta.query && (
                    <p className="text-red-300/60"><span className="uppercase tracking-wider text-[10px]">Query:</span> {workplaceMeta.query}</p>
                  )}
                  {(workplaceMeta.api_status || workplaceMeta.api_error) && (
                    <p className="text-red-300/60">
                      <span className="uppercase tracking-wider text-[10px]">Google API:</span>{' '}
                      {workplaceMeta.api_status || ''}{workplaceMeta.api_error ? ` — ${workplaceMeta.api_error}` : ''}
                    </p>
                  )}
                </div>
              )}

              <div className="shrink-0 flex gap-3 pt-2 pb-4 border-b border-white/5">
                <Button variant="outline" onClick={reset} className="flex-1 bg-transparent border-white/10 hover:bg-white/5">
                  Start Over
                </Button>
                <Button onClick={handleDownloadPDF} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <FileText className="w-4 h-4 mr-2" /> Generate PDF
                </Button>
              </div>

              <div>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(parsedData).map(([key, value]) => (
                      <div key={key} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] uppercase text-zinc-500 tracking-wider">
                            {key.replace(/_/g, ' ')}
                          </Label>
                          {key === 'workplace_address' && workplaceMeta && (
                            <Badge
                              variant="outline"
                              className={
                                workplaceMeta.source === 'google_places'
                                  ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px]'
                                  : workplaceMeta.source === 'client_provided'
                                  ? 'border-amber-500/40 text-amber-400 bg-amber-500/10 text-[10px]'
                                  : 'border-zinc-500/40 text-zinc-400 bg-zinc-500/10 text-[10px]'
                              }
                            >
                              <MapPin className="w-3 h-3 mr-1" />
                              {workplaceMeta.source === 'google_places'
                                ? 'Google Resolved'
                                : workplaceMeta.source === 'client_provided'
                                ? 'Client Provided'
                                : 'Raw Text'}
                            </Badge>
                          )}
                        </div>
                        <Input
                          value={(value as string) ?? ''}
                          onChange={(e) => handleUpdateField(key, e.target.value)}
                          className="bg-black/50 border-white/5 h-8 text-xs focus:border-emerald-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
