import { useState } from 'react';
import { Settings2, RotateCcw, GripVertical, Plus, Copy, Check } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PIPELINE_TABS } from '@/lib/pipelinev2/tabs';
import {
  TABLE_COLUMNS, defaultConfig, saveConfig, saveConfigForTabs,
  type ColumnWidth, type TableConfig,
} from '@/lib/pipelinev2/columns';

type SaveScope = 'tab' | 'all';

const WIDTHS: ColumnWidth[] = ['narrow', 'normal', 'wide', 'xwide'];
const WIDTH_LABEL: Record<ColumnWidth, string> = { narrow: 'S', normal: 'M', wide: 'L', xwide: 'XL' };
const colByKey = new Map(TABLE_COLUMNS.map((c) => [c.key, c]));

function SortableColumnRow({
  colKey, width, onToggle, onCycleWidth,
}: {
  colKey: string;
  width: ColumnWidth;
  onToggle: (on: boolean) => void;
  onCycleWidth: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colKey });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const def = colByKey.get(colKey);
  return (
    <div ref={setNodeRef} style={style}
      className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-1.5 py-1 text-sm">
      <button type="button" className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox checked onCheckedChange={(v) => onToggle(v === true)} aria-label={`Hide ${def?.label}`} />
      <span className="flex-1 truncate">{def?.label ?? colKey}</span>
      <button type="button" onClick={onCycleWidth} title="Click to change column width"
        className="w-7 shrink-0 rounded border border-border bg-background px-1 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground">
        {WIDTH_LABEL[width]}
      </button>
    </div>
  );
}

export function ColumnsPicker({
  tabKey, config, onChange,
}: {
  tabKey: string;
  config: TableConfig;
  onChange: (c: TableConfig) => void;
}) {
  const [scope, setScope] = useState<SaveScope>('tab');
  const [copied, setCopied] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Persist a change honouring the chosen save scope (this tab only / all tabs).
  const persist = (next: TableConfig) => {
    if (scope === 'all') saveConfigForTabs(PIPELINE_TABS.map((t) => t.key), next);
    else saveConfig(tabKey, next);
    onChange(next);
  };

  const widthOf = (key: string): ColumnWidth =>
    config.widths[key] ?? colByKey.get(key)?.defaultWidth ?? 'normal';

  const setVisible = (key: string, on: boolean) => {
    if (on) {
      if (config.visible.includes(key)) return;
      persist({ ...config, visible: [...config.visible, key] }); // append → preserves custom order
    } else {
      if (config.visible.length <= 1) return; // keep at least one column
      persist({ ...config, visible: config.visible.filter((k) => k !== key) });
    }
  };

  const cycleWidth = (key: string) => {
    const next = WIDTHS[(WIDTHS.indexOf(widthOf(key)) + 1) % WIDTHS.length];
    persist({ ...config, widths: { ...config.widths, [key]: next } });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = config.visible.indexOf(String(active.id));
    const newI = config.visible.indexOf(String(over.id));
    if (oldI < 0 || newI < 0) return;
    persist({ ...config, visible: arrayMove(config.visible, oldI, newI) });
  };

  const copyToAllTabs = () => {
    saveConfigForTabs(PIPELINE_TABS.map((t) => t.key), config);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const hidden = TABLE_COLUMNS.filter((c) => !config.visible.includes(c.key));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <Settings2 className="w-4 h-4" /> Columns <span className="text-muted-foreground">({config.visible.length})</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Columns</span>
          <button className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => persist(defaultConfig(tabKey))}>
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>

        {/* Save scope */}
        <div className="mb-3">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">Save changes for</div>
          <div className="inline-flex w-full rounded-md bg-muted p-0.5 text-xs text-muted-foreground">
            {([['tab', 'This tab'], ['all', 'All tabs']] as const).map(([val, label]) => (
              <button key={val} type="button" onClick={() => setScope(val)}
                aria-pressed={scope === val}
                className={'flex-1 rounded-sm px-2 py-1 font-medium transition-all ' +
                  (scope === val ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Visible — drag to reorder, toggle to hide, button to resize */}
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">Shown · drag to reorder</span>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={config.visible} strategy={verticalListSortingStrategy}>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-0.5">
              {config.visible.map((key) => (
                <SortableColumnRow key={key} colKey={key} width={widthOf(key)}
                  onToggle={(on) => setVisible(key, on)} onCycleWidth={() => cycleWidth(key)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Hidden — add back */}
        {hidden.length > 0 && (
          <>
            <div className="mb-1 mt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">Hidden</div>
            <div className="max-h-40 space-y-1 overflow-y-auto pr-0.5">
              {hidden.map((c) => (
                <button key={c.key} type="button" onClick={() => setVisible(c.key, true)}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground">
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{c.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <Button variant="ghost" size="sm" className="mt-2 w-full gap-1.5 text-xs text-muted-foreground" onClick={copyToAllTabs}>
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied to all tabs' : 'Copy this layout to all tabs'}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
