// Age-in-status chip: quiet while comfortably within SLA, amber when >75% of
// the SLA is used, red once breached (with how far over). No SLA → neutral age.
import { ageInStatusMs, slaHoursFor, formatAge } from '@/lib/finance/sla';

export function AgeChip({ app }: { app: any }) {
  const ageMs = ageInStatusMs(app);
  const slaH = slaHoursFor(app?.status);
  const slaMs = slaH != null ? slaH * 3600_000 : null;

  let cls = 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60';
  let label = formatAge(ageMs);
  if (slaMs != null) {
    if (ageMs > slaMs) {
      cls = 'bg-red-500/10 text-red-400 border-red-500/40';
      label = `${formatAge(ageMs)} · ${formatAge(ageMs - slaMs)} over`;
    } else if (ageMs > slaMs * 0.75) {
      cls = 'bg-amber-500/10 text-amber-400 border-amber-500/40';
    }
  }

  return (
    <span
      className={`text-[10px] tabular-nums whitespace-nowrap px-1.5 py-0.5 rounded border ${cls}`}
      title={slaH != null ? `In status ${formatAge(ageMs)} — SLA ${slaH}h` : `In status ${formatAge(ageMs)}`}
    >
      {label}
    </span>
  );
}
