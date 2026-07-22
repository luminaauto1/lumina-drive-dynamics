// Shared two-track status <Select>. Reads options/labels from the status config
// and applies role filtering CONSISTENTLY via filterStatusOptionsForRole — so the
// dropdown never offers a finance status the current role isn't allowed to set.
// (Fixes the previous inconsistency where StatusChangeModal mapped STATUS_OPTIONS
// with no role filter.)

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { filterStatusOptionsForRole } from '@/lib/roleStatusFilter';
import { useMyAllowedStatuses } from '@/hooks/useAppVisibility';
import { TRACK_META, trackLabel, type StatusTrack } from '@/lib/admin/statusTracks';

export function StatusSelect({
  track,
  value,
  onChange,
  role,
  labelOverrides,
  options: optionsProp,
  disabled,
  className,
}: {
  track: StatusTrack;
  value: string;
  onChange: (value: string) => void;
  /** Staff role — finance options are filtered to what this role may set. */
  role?: string | null;
  /** Effective label overrides (finance/client track), e.g. useStatusConfig().labels. */
  labelOverrides?: Record<string, string>;
  /** DB-driven options for the client track (useStatusConfig().clientStatuses).
   *  Ignored for finance/deal, which carry their own option lists. */
  options?: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}) {
  // Role filtering only constrains the finance track today; the deal track has no
  // role-restricted statuses, so its options pass through unchanged. The client
  // track is fully DB-driven (no role filter). Either way we always keep the
  // current value selectable (the finance filter's read-only fallback).
  // Per-user allowlist (Settings → Status Permissions) narrows the role default.
  const perUser = useMyAllowedStatuses();
  const options = track === 'client'
    ? (optionsProp ?? [])
    : track === 'finance'
      ? filterStatusOptionsForRole(TRACK_META.finance.options, role, value, perUser)
      : TRACK_META.deal.options;

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {trackLabel(track, o.value, labelOverrides)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
