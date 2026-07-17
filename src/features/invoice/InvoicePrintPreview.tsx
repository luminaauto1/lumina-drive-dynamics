import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { DocumentSettings } from '@/hooks/useDocumentSettings';
import { InvoiceDocument } from './InvoiceDocument';
import { downloadInvoicePdf, invoiceFilename } from './downloadInvoicePdf';
import type { InvoicePayload } from './types';
import './invoicePrint.css';

/**
 * Full-screen invoice preview overlay. "Download PDF" renders the document to
 * a REAL single-page A4 PDF and saves it straight to Downloads (owner rule
 * 2026-07-17 — no print dialog, no save-as prompt, no 5-page print quirks).
 * The printer icon remains for physical printing via the print CSS.
 */
export function InvoicePrintPreview({ payload, settings, onClose }: {
  payload: InvoicePayload;
  settings: DocumentSettings;
  onClose: () => void;
}) {
  const docRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // Esc closes the preview.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const download = async () => {
    if (!docRef.current) return;
    setDownloading(true);
    try {
      await downloadInvoicePdf(docRef.current, invoiceFilename(payload.invoiceNumber, payload.billTo?.name || ''));
    } catch (e: any) {
      toast.error('PDF download failed: ' + (e?.message || e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#2C2C2E] overflow-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-[#1C1C1E] border-b border-white/10 print:hidden">
        <Button variant="ghost" onClick={onClose} className="gap-2 text-white hover:text-white hover:bg-white/10">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <span className="text-sm text-white/60 font-mono">{payload.invoiceNumber}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.print()}
            title="Print (physical printer)"
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <Printer className="w-4 h-4" />
          </Button>
          <Button onClick={download} disabled={downloading} className="gap-2">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? 'Preparing…' : 'Download PDF'}
          </Button>
        </div>
      </div>

      <div className="flex justify-center py-6">
        <div
          className="invoice-print-root origin-top"
          style={{ transform: 'scale(0.85)', transformOrigin: 'top center', width: '210mm' }}
        >
          <div ref={docRef}>
            <InvoiceDocument payload={payload} settings={settings} />
          </div>
        </div>
      </div>
    </div>
  );
}
