import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Deal } from '@/lib/dealdesk/types';
import { STAGE_STEPS, stepState } from '@/lib/dealdesk/stageFlow';

/**
 * Horizontal guided stage bar for the Deal Desk drawer:
 *   Contract signed → ① Stock the car → ② Finalize → ③ Delivery & NATIS → ④ Cleared
 *
 * Driven from deal_records.deal_stage + derived state (see stageFlow.ts). Read-only:
 * the actions that advance the stage live in the step panels below the bar.
 */
export function StageBar({ deal, className }: { deal: Deal; className?: string }) {
  return (
    <ol className={cn('flex items-stretch gap-1 overflow-x-auto', className)} aria-label="Deal stage">
      {STAGE_STEPS.map((step, idx) => {
        const state = stepState(deal, idx);
        const done = state === 'done';
        const current = state === 'current';
        return (
          <li key={step.key} className="flex min-w-0 flex-1 items-center gap-1">
            <div
              className={cn(
                'flex min-w-0 flex-1 items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs',
                done && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                current && 'border-primary/50 bg-primary/10 text-foreground font-semibold',
                !done && !current && 'border-border bg-muted/30 text-muted-foreground',
              )}
              title={step.label}
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  done && 'bg-emerald-500 text-white',
                  current && 'bg-primary text-primary-foreground',
                  !done && !current && 'bg-muted-foreground/20 text-muted-foreground',
                )}
              >
                {done ? <Check className="h-3 w-3" /> : step.index ?? '·'}
              </span>
              <span className="truncate">{step.label}</span>
            </div>
            {idx < STAGE_STEPS.length - 1 && (
              <span className={cn('h-px w-2 shrink-0', done ? 'bg-emerald-500/40' : 'bg-border')} aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
