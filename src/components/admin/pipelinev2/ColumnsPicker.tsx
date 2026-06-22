import { Settings2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PIPELINE_TABS } from '@/lib/pipelinev2/tabs';
import { TABLE_COLUMNS, defaultConfig, saveConfig, saveConfigForTabs, type TableConfig } from '@/lib/pipelinev2/columns';

export function ColumnsPicker({
  tabKey, config, onChange,
}: {
  tabKey: string;
  config: TableConfig;
  onChange: (c: TableConfig) => void;
}) {
  const setVisible = (key: string, on: boolean) => {
    // Preserve registry order in the visible list.
    const next = TABLE_COLUMNS.filter((c) => (c.key === key ? on : config.visible.includes(c.key))).map((c) => c.key);
    const cfg = { ...config, visible: next };
    saveConfig(tabKey, cfg);
    onChange(cfg);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <Settings2 className="w-4 h-4" /> Columns <span className="text-muted-foreground">({config.visible.length})</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Columns</span>
          <button className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            onClick={() => { const d = defaultConfig(); saveConfig(tabKey, d); onChange(d); }}>
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {TABLE_COLUMNS.map((c) => (
            <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={config.visible.includes(c.key)} onCheckedChange={(v) => setVisible(c.key, v === true)} />
              {c.label}
            </label>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-muted-foreground"
          onClick={() => saveConfigForTabs(PIPELINE_TABS.map((t) => t.key), config)}>
          Apply to all tabs
        </Button>
      </PopoverContent>
    </Popover>
  );
}
