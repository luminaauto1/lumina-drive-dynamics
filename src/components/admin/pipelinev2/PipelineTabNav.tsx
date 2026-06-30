import { usePipelineLanes } from '@/hooks/usePipelineLanes';
import { cn } from '@/lib/utils';

export function PipelineTabNav({
  counts, activeKey, onChange,
}: {
  counts: Record<string, number>;
  activeKey: string;
  onChange: (key: string) => void;
}) {
  // Effective lanes = hardcoded PIPELINE_TABS (key + routing) with label/colour
  // overrides applied. key + statuses are unchanged, so counts (keyed by lane id)
  // stay correct; only the caption + accent colour reflect overrides. Empty/missing
  // overrides => byte-for-byte the previous behaviour (default label, gold accent).
  const lanes = usePipelineLanes();
  return (
    <div className="flex flex-wrap gap-1 border-b border-border">
      {lanes.map((t) => {
        const active = t.key === activeKey;
        const count = counts[t.key] ?? 0;
        // Override hex (inline) wins; otherwise the default gold desk-accent.
        const accent = t.color || 'hsl(var(--desk-accent))';
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              'flex items-center gap-2 rounded-t-md px-3 py-2 text-sm transition border-b-2 -mb-px',
              active
                // Active: bright full-foreground label + 2px accent underline.
                ? 'bg-muted/40 text-foreground font-semibold'
                // Inactive: muted label, transparent border.
                : 'text-muted-foreground hover:text-foreground border-transparent font-medium',
            )}
            style={active ? { borderBottomColor: accent } : undefined}
          >
            {t.label}
            {/* Active count chip = accent fill. A hex override is applied inline (text
                forced to the background colour for contrast); with no override we keep
                the original `desk-accent-fill` utility class (default gold). Inactive
                = quiet muted chip, unchanged. */}
            <span
              className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                active ? (t.color ? 'text-background' : 'desk-accent-fill') : 'bg-muted text-muted-foreground')}
              style={active && t.color ? { backgroundColor: t.color } : undefined}
            >
              {count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
