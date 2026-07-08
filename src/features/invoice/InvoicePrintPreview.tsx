import { useEffect } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DocumentSettings } from '@/hooks/useDocumentSettings';
import { InvoiceDocument } from './InvoiceDocument';
import type { InvoicePayload } from './types';
import './invoicePrint.css';

/**
 * Full-screen invoice preview overlay — same UX as the Quote page: a scaled
 * on-screen A4 preview with a "Download PDF" button that calls window.print()
 * (the print CSS isolates the document to a clean single A4 page).
 */
export function InvoicePrintPreview({ payload, settings, onClose }: {
  payload: InvoicePayload;
  settings: DocumentSettings;
  onClose: () => void;
}) {
  // Esc closes the preview.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#2C2C2E] overflow-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-[#1C1C1E] border-b border-white/10 print:hidden">
        <Button variant="ghost" onClick={onClose} className="gap-2 text-white hover:text-white hover:bg-white/10">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <span className="text-sm text-white/60 font-mono">{payload.invoiceNumber}</span>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="w-4 h-4" /> Download PDF
        </Button>
      </div>

      <div className="flex justify-center py-6">
        <div
          className="invoice-print-root origin-top"
          style={{ transform: 'scale(0.85)', transformOrigin: 'top center', width: '210mm' }}
        >
          <InvoiceDocument payload={payload} settings={settings} />
        </div>
      </div>
    </div>
  );
}
