import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { RangeKey } from '@/hooks/useAnalyticsDashboard';

// Port of ZTC's range-filter.tsx, re-skinned to Lumina's dark/platinum tokens.
const PRESETS: [RangeKey, string][] = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['month', 'This month'],
];

export function AnalyticsRangeFilter({
  value, onChange,
}: {
  value: { key: RangeKey; from?: string; to?: string };
  onChange: (v: { key: RangeKey; from?: string; to?: string }) => void;
}) {
  const [cf, setCf] = useState(value.from ?? '');
  const [ct, setCt] = useState(value.to ?? '');
  useEffect(() => { setCf(value.from ?? ''); setCt(value.to ?? ''); }, [value.from, value.to]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(([k, label]) => (
        <Button key={k} size="sm" variant={value.key === k ? 'default' : 'outline'}
          className="rounded-full h-8 px-3.5 text-xs"
          onClick={() => onChange({ key: k })}>
          {label}
        </Button>
      ))}
      <div className="ml-1 flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1">
        <Input type="date" value={cf} onChange={(e) => setCf(e.target.value)}
          className="h-7 w-[8.5rem] border-0 bg-transparent text-xs" aria-label="From date" />
        <span className="text-muted-foreground text-xs">→</span>
        <Input type="date" value={ct} onChange={(e) => setCt(e.target.value)}
          className="h-7 w-[8.5rem] border-0 bg-transparent text-xs" aria-label="To date" />
        <Button size="sm" variant={value.key === 'custom' ? 'default' : 'ghost'}
          disabled={!cf || !ct} className="h-7 rounded-full px-2.5 text-xs"
          onClick={() => cf && ct && onChange({ key: 'custom', from: cf, to: ct })}>
          Apply
        </Button>
      </div>
    </div>
  );
}
