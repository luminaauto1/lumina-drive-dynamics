import { cn } from '@/lib/utils';

/**
 * Small segmented pill (2+ fixed options) with a SLIDING gold highlight.
 *
 * Options render in equal grid columns; the highlight is one absolutely-
 * positioned div sized to exactly one column and moved with
 * `translateX(index * 100%)` — a pure transform, so the slide between options
 * is a cheap 200ms `transition-transform` (and snaps instantly under
 * prefers-reduced-motion via `motion-reduce:transition-none`).
 *
 * Colours deliberately reference the desk-accent CSS VARIABLES inline
 * (`bg-[hsl(var(--desk-accent))]`) rather than the `.desk-accent-fill`
 * utility: that utility is scoped `.desk-root …`, and this control also mounts
 * inside Radix portals (ApplicationDrawer's Sheet) which live OUTSIDE the
 * .desk-root wrapper — the raw variables still resolve there in both admin
 * themes via the html.desk-portal-light/dark token blocks in index.css.
 */
export function SegmentedToggle<T extends string>({
  options, value, onChange, className, buttonClassName, title, disabled,
}: {
  options: ReadonlyArray<readonly [T, string]>;
  /** `null` = nothing selected yet: the highlight is hidden until a choice is made. */
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
  /** Per-button padding/size overrides (default `px-2.5 py-1`). */
  buttonClassName?: string;
  title?: string;
  disabled?: boolean;
}) {
  const idx = options.findIndex(([v]) => v === value);
  const n = options.length;
  return (
    <div
      title={title}
      role="group"
      aria-label={title}
      className={cn('relative grid items-center rounded-md border border-border bg-background p-0.5', className)}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      {/* Sliding highlight: exactly one column wide (padding box minus the 2px
          p-0.5 on each side, split n ways), so translateX in own-width units
          lands dead on each column. Hidden while nothing is selected. */}
      {idx >= 0 && (
        <div
          aria-hidden
          className="absolute bottom-0.5 top-0.5 rounded bg-[hsl(var(--desk-accent))] shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ left: 2, width: `calc((100% - 4px) / ${n})`, transform: `translateX(${idx * 100}%)` }}
        />
      )}
      {options.map(([val, label]) => {
        const active = val === value;
        return (
          <button
            key={val}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(val)}
            disabled={disabled}
            className={cn(
              'relative z-[1] rounded px-2.5 py-1 text-center transition-colors duration-200 disabled:opacity-60',
              active
                ? 'font-semibold text-[hsl(var(--desk-accent-foreground))]'
                : 'font-medium text-muted-foreground hover:text-foreground',
              buttonClassName,
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
