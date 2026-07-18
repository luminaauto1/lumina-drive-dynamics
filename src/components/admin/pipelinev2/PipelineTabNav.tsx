import { usePipelineLanes } from '@/hooks/usePipelineLanes';
import { hexTint, readableTextOn } from '@/lib/pipelinev2/color';
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
        // Translucent lane tint for the ACTIVE tab body. Hex override => 8-digit
        // hex inline (the JIT can't see runtime hexes); default => the accent-var
        // class below at the same ~12% alpha. Label stays text-foreground — the
        // tint is deliberately subtle in both admin themes.
        const tint = t.color ? hexTint(t.color) : null;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              'flex items-center gap-2 rounded-t-md px-3 py-2 text-sm transition border-b-2 -mb-px',
              active
                // Active: full-foreground label + lane tint + accent underline.
                ? cn('text-foreground font-semibold', !tint && 'bg-[hsl(var(--desk-accent)/0.12)]')
                // Inactive: muted label, transparent border.
                : 'text-muted-foreground hover:text-foreground border-transparent font-medium',
            )}
            style={active ? {
              borderBottomColor: accent,
              // +1px inset accent shadow under the 2px border => a slightly
              // stronger 3px-reading underline with zero layout shift (a real
              // 3px border would nudge the -mb-px alignment).
              boxShadow: `inset 0 -1px 0 ${accent}`,
              ...(tint ? { backgroundColor: tint } : null),
            } : undefined}
          >
            {t.label}
            {/* Active count chip = accent fill. A hex override is applied inline (text
                colour computed from the hex via luminance for contrast); with no override
                we keep the `desk-accent-fill` utility class (default gold + dark text,
                correct in both themes). Inactive = quiet muted chip, unchanged. */}
            <span
              className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                active ? (t.color ? '' : 'desk-accent-fill') : 'bg-muted text-muted-foreground')}
              style={active && t.color ? { backgroundColor: t.color, color: readableTextOn(t.color) } : undefined}
            >
              {count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
