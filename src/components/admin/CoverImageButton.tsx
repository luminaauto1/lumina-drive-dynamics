import { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { processCoverImage, isPreparedCover } from '@/lib/processVehicleImage';

interface CoverImageButtonProps {
  images: string[];
  onChange: (next: string[]) => void;
}

const VEHICLE_BUCKET = 'vehicle-images';

// Best-effort: derive the in-bucket path from a public URL so we can delete the
// raw cover once it's been replaced by the prepared one (keeps storage tidy).
const pathFromPublicUrl = (url: string): string | null => {
  const marker = `/${VEHICLE_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
};

/**
 * Auto-prepares the cover (first) vehicle photo: removes the background and fits
 * the car into the website's preview frame, then swaps it in as the cover.
 * Runs automatically the first time photos are added, and can be re-run manually
 * (e.g. after dragging a different photo to the front).
 */
const CoverImageButton = ({ images, onChange }: CoverImageButtonProps) => {
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const processingRef = useRef(false);
  const attemptedRef = useRef<Set<string>>(new Set()); // covers we've already tried

  const cover = images[0];
  const coverPrepared = isPreparedCover(cover);

  const prepareCover = async () => {
    const current = images[0];
    if (!current || processingRef.current) return;
    processingRef.current = true;
    setBusy(true);
    attemptedRef.current.add(current);
    try {
      const blob = await processCoverImage(current);
      const path = `vehicles/${Date.now()}-${Math.random().toString(36).slice(2)}-cover.webp`;
      const { error: upErr } = await supabase.storage
        .from(VEHICLE_BUCKET)
        .upload(path, blob, { contentType: 'image/webp', upsert: false });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from(VEHICLE_BUCKET).getPublicUrl(path);

      // Swap the prepared cover into first position.
      const next = [...images];
      const oldUrl = next[0];
      next[0] = publicUrl;
      onChange(next);

      // Best-effort cleanup of the now-unused raw cover.
      if (oldUrl && !isPreparedCover(oldUrl)) {
        const oldPath = pathFromPublicUrl(oldUrl);
        if (oldPath) supabase.storage.from(VEHICLE_BUCKET).remove([oldPath]).catch(() => {});
      }

      toast.success('Cover photo prepared');
    } catch (err: any) {
      console.error('Cover preparation failed:', err);
      toast.error('Could not prepare cover photo. You can keep the original or try again.');
    } finally {
      processingRef.current = false;
      setBusy(false);
    }
  };

  // Auto-run once when a fresh, unprepared cover appears.
  useEffect(() => {
    if (!autoEnabled) return;
    if (!cover || coverPrepared) return;
    if (processingRef.current) return;
    if (attemptedRef.current.has(cover)) return;
    prepareCover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover, autoEnabled, coverPrepared]);

  if (!cover) return null;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="w-4 h-4 text-primary" />
          Auto cover photo
          {busy && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          {!busy && coverPrepared && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={prepareCover} disabled={busy}>
          {busy ? 'Preparing…' : coverPrepared ? 'Re-prepare cover' : 'Prepare cover now'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Removes the background and fits the car neatly into the website preview frame (transparent,
        fast-loading). Runs automatically on the first photo; the very first run downloads a one-time
        helper, so it may take a few extra seconds.
      </p>
      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={autoEnabled}
          onChange={(e) => setAutoEnabled(e.target.checked)}
          className="w-3.5 h-3.5"
        />
        Prepare the cover automatically when I add photos
      </label>
    </div>
  );
};

export default CoverImageButton;
