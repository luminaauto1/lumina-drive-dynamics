import { Settings2, RotateCcw, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WIDGET_REGISTRY } from './widgetRegistry';
import type { WidgetDef } from './types';
import type { DashboardLayoutApi } from './useDashboardLayout';

export interface CustomizePanelProps {
  api: DashboardLayoutApi;
  /** Widget registry backing the library list. Default: the analytics WIDGET_REGISTRY. */
  registry?: WidgetDef[];
  /** Sheet description line. Default matches the per-browser (localStorage) dashboards. */
  description?: string;
}

function groupByCategory(defs: WidgetDef[]): [string, WidgetDef[]][] {
  const groups = new Map<string, WidgetDef[]>();
  for (const def of defs) {
    const cat = def.category ?? 'Widgets';
    const list = groups.get(cat) ?? [];
    list.push(def);
    groups.set(cat, list);
  }
  return Array.from(groups.entries());
}

/**
 * Top-right "Customize" control. Opens a Sheet with:
 *  - an "Edit layout" switch (drag/resize the grid),
 *  - a per-widget visibility toggle library (grouped by category),
 *  - "Show all" + "Reset to default" actions.
 *
 * Semantic tokens only; safe in dark + light. Avoids bg-accent on subtle surfaces
 * (uses bg-muted) since --accent is pure white in this admin's dark theme.
 */
export function CustomizePanel({
  api,
  registry = WIDGET_REGISTRY,
  description = 'Toggle widgets, rearrange the layout, or reset to the default view. Changes are saved in this browser.',
}: CustomizePanelProps) {
  const { visibleIds, editMode, toggleVisible, showAll, resetToDefault, setEditMode } = api;
  const visibleSet = new Set(visibleIds);
  const groups = groupByCategory(registry);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Customize
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="space-y-1">
          <SheetTitle>Customize dashboard</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        {/* Edit-layout toggle */}
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2.5">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Edit layout</p>
            <p className="text-xs text-muted-foreground">Drag &amp; resize widgets</p>
          </div>
          <Switch checked={editMode} onCheckedChange={setEditMode} aria-label="Edit layout" />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button variant="secondary" size="sm" className="flex-1 gap-2" onClick={showAll}>
            <Eye className="h-4 w-4" />
            Show all
          </Button>
          <Button variant="secondary" size="sm" className="flex-1 gap-2" onClick={resetToDefault}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>

        <Separator className="my-4" />

        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Widget library
        </p>
        <ScrollArea className="-mr-4 flex-1 pr-4">
          <div className="space-y-5 pb-4">
            {groups.map(([category, defs]) => (
              <div key={category} className="space-y-1">
                <p className="px-1 text-xs font-semibold text-muted-foreground">{category}</p>
                {defs.map((def) =>
                  def.pinned ? (
                    // Pinned widgets can't be hidden — omit the toggle, show a hint.
                    <div
                      key={def.id}
                      className="flex items-center justify-between rounded-lg px-2 py-2 text-sm"
                    >
                      <span className="truncate pr-3 text-foreground">{def.title}</span>
                      <span className="shrink-0 whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Always shown
                      </span>
                    </div>
                  ) : (
                    <label
                      key={def.id}
                      htmlFor={`widget-${def.id}`}
                      className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-muted"
                    >
                      <span className="truncate pr-3 text-foreground">{def.title}</span>
                      <Switch
                        id={`widget-${def.id}`}
                        checked={visibleSet.has(def.id)}
                        onCheckedChange={() => toggleVisible(def.id)}
                        aria-label={`Toggle ${def.title}`}
                      />
                    </label>
                  ),
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default CustomizePanel;
