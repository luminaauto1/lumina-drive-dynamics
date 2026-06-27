// Shared two-track status badge. Renders the finance status OR the deal stage with
// a track-specific icon + shape so the two are distinguishable without colour alone.
//
// Labels/colours come from the status config (statusConfig + status_overrides for
// the finance track; the deal-stage map for the deal track). Pass `overrides`
// (e.g. useStatusConfig().labels / .styles) to honour admin-customized finance
// labels/colours. If `onChange` is provided the badge becomes a click target.

import { cn } from '@/lib/utils';
import { TRACK_META, trackLabel, trackClass, type StatusTrack } from '@/lib/admin/statusTracks';

export function StatusBadge({
  track,
  value,
  onChange,
  labelOverrides,
  styleOverrides,
  title,
  className,
}: {
  track: StatusTrack;
  value: string | null | undefined;
  /** When provided, the badge is a button that calls back to open a status picker. */
  onChange?: () => void;
  /** Effective label overrides (finance track), e.g. useStatusConfig().labels. */
  labelOverrides?: Record<string, string>;
  /** Effective colour overrides (finance track), e.g. useStatusConfig().styles. */
  styleOverrides?: Record<string, string>;
  title?: string;
  className?: string;
}) {
  const { Icon, shapeClass } = TRACK_META[track];
  const label = trackLabel(track, value, labelOverrides);
  const cls = trackClass(track, value, styleOverrides);

  const base = cn(
    'inline-flex items-center gap-1 border px-1.5 py-0.5 text-xs font-semibold',
    shapeClass,
    cls,
    className,
  );

  if (onChange) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange(); }}
        title={title ?? 'Click to change status'}
        className={cn(base, 'transition hover:brightness-110')}
      >
        <Icon className="h-3 w-3 shrink-0 opacity-80" />
        {label}
      </button>
    );
  }

  return (
    <span className={base} title={title}>
      <Icon className="h-3 w-3 shrink-0 opacity-80" />
      {label}
    </span>
  );
}
