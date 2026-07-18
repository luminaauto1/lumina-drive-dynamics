// The ONE clickable KPI strip (redesign P2) — replaces both of the old counting
// systems (FNI_PIPELINE strip + 9 StatTiles). Click a tile to filter the table
// to that bucket; click again to clear. The ⚠ Stalled tile shows every active
// SLA breach. Declined keeps its 30-day window (declines auto-archive, so an
// active-only count would always read ~0).
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { KPI_BUCKETS, bucketOf, enteredStatusesToday } from '@/lib/finance/buckets';
import { isStalled } from '@/lib/finance/sla';

const THIRTY_D = 30 * 24 * 3600 * 1000;
const DECLINED_STATUSES = new Set(['declined', 'declined_conditional', 'blacklisted']);

export function KpiStrip({
  applications,
  activeApps,
  activeBucket,
  onBucketClick,
}: {
  /** full list — used only for the 30d Declined window */
  applications: any[];
  /** archive-rule-filtered list — drives every other count */
  activeApps: any[];
  activeBucket: string | null;
  onBucketClick: (key: string) => void;
}) {
  const { counts, today, stalledCount, stalledToday } = useMemo(() => {
    const counts: Record<string, number> = {};
    const today: Record<string, number> = {};
    for (const b of KPI_BUCKETS) { counts[b.key] = 0; today[b.key] = 0; }

    for (const a of activeApps) {
      const key = bucketOf(a);
      if (key && key !== 'declined' && counts[key] !== undefined) counts[key] += 1;
    }
    // Declined = 30-day window over ALL apps (they auto-archive out of active).
    counts.declined = applications.filter((a: any) => {
      if (!DECLINED_STATUSES.has(a.status)) return false;
      const t = a.status_updated_at || a.updated_at;
      return t && Date.now() - new Date(t).getTime() < THIRTY_D;
    }).length;

    for (const b of KPI_BUCKETS) {
      const pool = b.key === 'declined' ? applications : applications;
      today[b.key] = pool.filter((a: any) =>
        enteredStatusesToday(a, b.statuses, b.key === 'pending'),
      ).length;
    }

    const stalledApps = activeApps.filter((a: any) => isStalled(a));
    return { counts, today, stalledCount: stalledApps.length, stalledToday: 0 };
  }, [applications, activeApps]);

  const tile = (
    key: string,
    label: string,
    count: number,
    todayN: number,
    colorCls: string,
    isStalledTile = false,
  ) => {
    const active = activeBucket === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => onBucketClick(key)}
        title={active ? 'Click to clear this filter' : `Show only ${label}`}
        className={[
          'flex flex-col items-start px-3 py-2 rounded-md border bg-secondary text-left transition-all',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          colorCls,
          active
            ? 'ring-2 ring-ring/60 bg-muted/80'
            : 'hover:bg-muted/60',
        ].join(' ')}
      >
        <span className="text-[10px] uppercase tracking-wider truncate w-full flex items-center gap-1">
          {isStalledTile && <AlertTriangle className="w-3 h-3 shrink-0" />}
          {label}
        </span>
        <span className="text-lg font-semibold tabular-nums leading-tight">{count}</span>
        {!isStalledTile && (
          <span className={`text-[10px] ${todayN > 0 ? 'opacity-70' : 'text-muted-foreground'}`}>+{todayN} today</span>
        )}
      </button>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-card border border-border rounded-lg p-3 mb-4"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
          Pipeline Overview — click a tile to filter
        </p>
        <span className="text-[10px] text-muted-foreground">
          {activeApps.length} active app{activeApps.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2">
        {KPI_BUCKETS.map((b) => tile(b.key, b.label, counts[b.key], today[b.key], b.color))}
        {tile('stalled', 'Stalled', stalledCount, stalledToday, 'text-red-400 border-red-500/40', true)}
      </div>
    </motion.div>
  );
}
