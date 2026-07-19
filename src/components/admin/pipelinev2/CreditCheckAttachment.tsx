import { useState, useEffect } from 'react';
import { Loader2, Download, ExternalLink, FileText, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DocumentViewerDialog, PdfFirstPagePreview } from './DocumentViewerDialog';

export function CreditCheckAttachment({ app }: { app: any }) {
  const path: string | undefined | null = app?.status_screenshot_url;

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errored, setErrored] = useState<boolean>(false);
  const [viewerOpen, setViewerOpen] = useState<boolean>(false);
  // Bumped to mint a FRESH signed URL (the 1h signature can expire while the
  // drawer sits open) — wired to the viewer/preview Retry buttons.
  const [urlNonce, setUrlNonce] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setSignedUrl(null);
    setErrored(false);
    setLoading(true);
    supabase.storage
      .from('credit-check-screenshots')
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error || !data?.signedUrl) {
          setErrored(true);
          return;
        }
        setSignedUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path, urlNonce]);

  const refreshSignedUrl = () => setUrlNonce((n) => n + 1);

  if (!path) return null;

  const ext = (path.split('.').pop() || '').toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = /^(png|jpe?g|gif|webp)$/.test(ext);

  const clientName =
    `${app.first_name || ''} ${app.last_name || ''}`.trim() || app.full_name || 'Applicant';
  const score =
    app.credit_score !== null &&
    app.credit_score !== undefined &&
    String(app.credit_score).trim() !== ''
      ? String(app.credit_score)
      : 'No Score';
  const idn = app.id_number || 'No ID';

  const filename =
    `${clientName} - ${score} - ${idn}`
      .replace(/[\\/:*?"<>|\n\r]+/g, '')
      .replace(/\s+/g, ' ')
      .trim() +
    '.' +
    (ext || 'pdf');

  // res.ok is checked because an EXPIRED signed URL answers 400 with a JSON
  // error body — without the check that JSON used to be saved as a corrupt
  // "document" under a success toast. On failure we mint a fresh signed URL and
  // retry once (state is left alone so an open viewer isn't disturbed).
  const fetchBlob = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  };

  const handleDownload = async () => {
    if (!signedUrl || !path) return;
    try {
      let blob: Blob;
      try {
        blob = await fetchBlob(signedUrl);
      } catch {
        const { data, error } = await supabase.storage
          .from('credit-check-screenshots')
          .createSignedUrl(path, 3600);
        if (error || !data?.signedUrl) throw error ?? new Error('no signed url');
        blob = await fetchBlob(data.signedUrl);
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Downloaded');
    } catch {
      toast.error('Could not download the credit-check document.');
    }
  };

  const status: string | null | undefined = app.credit_check_status;

  return (
    <>
      <Separator className="my-4" />
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Credit Check Report
          </span>
          {status ? (
            <span
              className={
                'rounded border px-1.5 py-0.5 text-[10px] font-semibold ' +
                (status === 'passed'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                  : 'border-red-500/40 bg-red-500/10 text-red-500')
              }
            >
              {status === 'passed' ? 'Passed' : 'Failed'}
            </span>
          ) : null}
          {score !== 'No Score' ? (
            <span className="text-[11px] text-muted-foreground">· Score {score}</span>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : errored ? (
          <div className="text-sm text-muted-foreground">
            Couldn't load the credit-check document.
          </div>
        ) : signedUrl ? (
          <div className="space-y-2">
            {isPdf ? (
              // ENTIRE first page via pdf.js, rendered ~560px tall (capped to the
              // available width, nothing clipped) in a frame that hugs the page.
              // Click opens the paginated viewer.
              <PdfFirstPagePreview
                url={signedUrl}
                onExpand={() => setViewerOpen(true)}
                onRetry={refreshSignedUrl}
              />
            ) : isImage ? (
              <button
                type="button"
                onClick={() => setViewerOpen(true)}
                title="Open full size"
                className="block w-full cursor-zoom-in text-left"
              >
                {/* Border sits on the IMG so the frame shrinks to the picture —
                    a w-fit wrapper would size to the image's INTRINSIC width and
                    leave the same dead space we're removing. */}
                <img
                  src={signedUrl}
                  alt="Credit check"
                  className="mx-auto block max-h-[560px] w-auto max-w-full rounded-md border border-border bg-muted/30 object-contain p-1.5 shadow-sm"
                />
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate">{filename}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              {(isPdf || isImage) && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setViewerOpen(true)}>
                  <Maximize2 className="w-3.5 h-3.5" /> View full
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDownload}>
                <Download className="w-3.5 h-3.5" /> Download
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => window.open(signedUrl, '_blank')}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {(isPdf || isImage) && (
        <DocumentViewerDialog
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          url={signedUrl}
          kind={isPdf ? 'pdf' : 'image'}
          filename={filename}
          onDownload={handleDownload}
          onRetry={refreshSignedUrl}
        />
      )}
    </>
  );
}
