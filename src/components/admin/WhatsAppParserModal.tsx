import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Sparkles, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
}

export default function WhatsAppParserModal({ open, onOpenChange }: WhatsAppParserModalProps) {
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<Record<string, string> | null>(null);
  const [addressMeta, setAddressMeta] = useState<AddressMeta | null>(null);
  const [workplaceMeta, setWorkplaceMeta] = useState<WorkplaceMeta | null>(null);

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    toast.info('AI is decoding WhatsApp message...');

    try {
      const { data, error } = await supabase.functions.invoke('parse-whatsapp', {
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

  const handleDownloadPDF = async () => {
    if (!parsedData) return;
    try {
      // Map AI keys to FinanceApplication shape expected by generateFinancePDF
      const applicationObj: any = {
        id: crypto.randomUUID(),
        first_name: parsedData.first_name || '',
        last_name: parsedData.last_name || '',
        full_name: `${parsedData.first_name || ''} ${parsedData.last_name || ''}`.trim() || 'Unknown',
        id_number: parsedData.id_number || '',
        email: parsedData.email || '',
        phone: parsedData.phone || '',
        marital_status: parsedData.marital_status || '',
        street_address: parsedData.physical_address || '',
        employer_name: parsedData.employer_name || '',
        job_title: parsedData.job_title || '',
        employment_period: parsedData.employment_start || '',
        gross_salary: Number(String(parsedData.gross_income || '').replace(/[^\d.]/g, '')) || null,
        net_salary: Number(String(parsedData.net_income || '').replace(/[^\d.]/g, '')) || null,
        expenses_summary: parsedData.living_expenses || '',
        bank_name: parsedData.bank_name || '',
        account_number: parsedData.account_number || '',
        kin_name: parsedData.kin_name || '',
        kin_contact: parsedData.kin_phone || '',
        status: 'pending',
        popia_consent: false,
        created_at: new Date().toISOString(),
      };

      // 1. Generate the PDF
      await generateFinancePDF(applicationObj);

      // 2. Create basic tracking shell in finance_applications (contact info only — no sensitive financials)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const fullName = `${parsedData.first_name || ''} ${parsedData.last_name || ''}`.trim() || 'WhatsApp Lead';
        const { error: insertError } = await supabase.from('finance_applications').insert([{
          user_id: user.id,
          first_name: parsedData.first_name || 'Unknown',
          last_name: parsedData.last_name || '',
          full_name: fullName,
          email: parsedData.email || `wa-${Date.now()}@lumina.local`,
          phone: parsedData.phone || 'N/A',
          status: 'pending',
          internal_status: 'new_lead',
          notes: `[WhatsApp Parser] Tracking shell created on PDF generation. Sensitive data intentionally omitted.`,
          // Intentionally omitting sensitive data (id_number, income, bank, kin) per admin instruction
        } as any]);
        if (insertError) console.warn('Tracking shell insert failed:', insertError);
      }

      toast.success('PDF Generated & Tracking Lead Created');
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
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-3xl bg-zinc-950 border-white/10 text-white">
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
            <div className="space-y-6">
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

              <ScrollArea className="h-[400px] pr-4">
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(parsedData).map(([key, value]) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-[10px] uppercase text-zinc-500 tracking-wider">
                        {key.replace(/_/g, ' ')}
                      </Label>
                      <Input
                        value={(value as string) ?? ''}
                        onChange={(e) => handleUpdateField(key, e.target.value)}
                        className="bg-black/50 border-white/5 h-8 text-xs focus:border-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-3 pt-4 border-t border-white/5">
                <Button variant="outline" onClick={reset} className="flex-1 bg-transparent border-white/10 hover:bg-white/5">
                  Start Over
                </Button>
                <Button onClick={handleDownloadPDF} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <FileText className="w-4 h-4 mr-2" /> Generate PDF
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
