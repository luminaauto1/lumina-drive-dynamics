import { Settings2, RotateCcw, GripVertical, Plus } from 'lucide-react';
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
import {
  DEAL_COLUMNS, defaultConfig, saveConfig,
  type ColumnWidth, type DealTableConfig,
} from '@/lib/dealdesk/columns';

// Show/hide + drag-reorder + per-column width (S/M/L/XL) picker for the Deal Desk
// "Deals" table. Mirrors the Pipeline v2 ColumnsPicker but is single-config: the
// Deal Desk has one table, so there is no per-tab save scope / copy-to-all-tabs.

const WIDTHS: ColumnWidth[] = ['narrow', 'normal', 'wide', 'xwide'];
const WIDTH_LABEL: Record<ColumnWidth, string> = { narrow: 'S', normal: 'M', wide: 'L', xwide: 'XL' };
const colByKey = new Map(DEAL_COLUMNS.map((c) => [c.key, c]));

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

export function DealsColumnsPicker({
  config, onChange, hiddenKeys,
}: {
  config: DealTableConfig;
  onChange: (c: DealTableConfig) => void;
  /** Columns this role may not use at all — omitted from both lists so the
   *  picker can't offer a toggle the table will ignore (e.g. GP for a
   *  delivery-only role). */
  hiddenKeys?: string[];
}) {
  const suppressed = (key: string) => !!hiddenKeys?.includes(key);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const persist = (next: DealTableConfig) => {
    saveConfig(next);
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

  const hidden = DEAL_COLUMNS.filter((c) => !config.visible.includes(c.key) && !suppressed(c.key));

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
            onClick={() => persist(defaultConfig())}>
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>

        {/* Visible — drag to reorder, toggle to hide, button to resize */}
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">Shown · drag to reorder</span>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={config.visible.filter((k) => !suppressed(k))} strategy={verticalListSortingStrategy}>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-0.5">
              {config.visible.filter((k) => !suppressed(k)).map((key) => (
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
      </PopoverContent>
    </Popover>
  );
}
