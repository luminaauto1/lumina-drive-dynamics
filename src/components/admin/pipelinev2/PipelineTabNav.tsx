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
              'flex items-center gap-2 rounded-t-md px-3 py-2 text-sm font-medium transition border-b-2 -mb-px',
              active
                ? `bg-muted/40 ${t.accent} border-current`
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            {t.label}
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
              active ? 'bg-background/60' : 'bg-muted text-muted-foreground')}>
              {count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
