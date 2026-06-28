import { PIPELINE_TABS } from '@/lib/pipelinev2/tabs';
import { cn } from '@/lib/utils';

export function PipelineTabNav({
  counts, activeKey, onChange,
}: {
  counts: Record<string, number>;
  activeKey: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border">
      {PIPELINE_TABS.map((t) => {
        const active = t.key === activeKey;
        const count = counts[t.key] ?? 0;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              'flex items-center gap-2 rounded-t-md px-3 py-2 text-sm transition border-b-2 -mb-px',
              active
                // Active: bright full-foreground label + 2px gold accent underline.
                ? 'bg-muted/40 text-foreground font-semibold'
                // Inactive: muted label, transparent border.
                : 'text-muted-foreground hover:text-foreground border-transparent font-medium',
            )}
            style={active ? { borderBottomColor: 'hsl(var(--desk-accent))' } : undefined}
          >
            {t.label}
            {/* Active count = solid gold accent chip; inactive = quiet muted chip. */}
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
              active ? 'desk-accent-fill' : 'bg-muted text-muted-foreground')}>
              {count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
