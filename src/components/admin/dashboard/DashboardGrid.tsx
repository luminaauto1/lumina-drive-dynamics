import { useMemo } from 'react';
import { Responsive, WidthProvider, type Layout } from 'react-grid-layout';
import { EyeOff } from 'lucide-react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { WIDGET_REGISTRY } from './widgetRegistry';
import type { WidgetDef } from './types';

const RGL = WidthProvider(Responsive);

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS = { lg: 12, md: 12, sm: 6, xs: 2, xxs: 1 };
const ROW_HEIGHT = 56;

export interface DashboardGridProps {
  /** All widget tiles (registry-merged). Visibility is applied here via `visibleIds`. */
  layout: Layout[];
  /** Ids of widgets to render, in order. Tiles not in this list are hidden. */
  visibleIds: string[];
  /** Draggable + resizable when true. */
  editMode: boolean;
  /** Persist layout changes (wire to useDashboardLayout().setLayout). */
  onLayoutChange: (next: Layout[]) => void;
  /** Widget registry backing the tiles. Default: the analytics WIDGET_REGISTRY. */
  registry?: WidgetDef[];
  /**
   * When provided, each edit-mode tile header gets a hide button (except pinned
   * widgets). Wire to useDashboardLayout().toggleVisible.
   */
  onHideWidget?: (id: string) => void;
}

/**
 * The customizable widget grid. Renders each visible widget inside a themed card
 * container and wires react-grid-layout drag/resize to `editMode`.
 */
export function DashboardGrid({
  layout,
  visibleIds,
  editMode,
  onLayoutChange,
  registry = WIDGET_REGISTRY,
  onHideWidget,
}: DashboardGridProps) {
  const byId = useMemo(() => new Map(registry.map((d) => [d.id, d])), [registry]);
  const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds]);

  // Only lay out + render tiles that are both visible and backed by a real widget.
  const visibleLayout = useMemo(
    () => layout.filter((l) => visibleSet.has(l.i) && byId.has(l.i)),
    [layout, visibleSet, byId],
  );

  const layouts = useMemo(
    () => ({ lg: visibleLayout, md: visibleLayout, sm: visibleLayout, xs: visibleLayout, xxs: visibleLayout }),
    [visibleLayout],
  );

  return (
    <RGL
      className="dashboard-grid"
      layouts={layouts}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={ROW_HEIGHT}
      margin={[16, 16]}
      containerPadding={[0, 0]}
      isDraggable={editMode}
      isResizable={editMode}
      // Only drag from the header handle so text/controls inside widgets stay usable.
      draggableHandle=".widget-drag-handle"
      // The hide button sits INSIDE the drag handle — exempt it from drag starts.
      draggableCancel=".widget-no-drag"
      // Persist ONLY while the user is actively editing. RGL also fires this on
      // mount, window resize, and responsive breakpoint reflows — persisting those
      // would let a narrow-screen reflow clobber the saved `lg` geometry. When we
      // do persist, take `allLayouts.lg` (never the current breakpoint's reflow),
      // since every breakpoint is fed the same `lg` layout.
      onLayoutChange={(current, allLayouts) => {
        if (!editMode) return;
        onLayoutChange(allLayouts.lg ?? current);
      }}
      measureBeforeMount={false}
      useCSSTransforms
    >
      {visibleLayout.map((item) => {
        const def = byId.get(item.i)!;
        const Body = def.Component;
        return (
          <div
            key={item.i}
            className="group flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
          >
            {editMode && (
              <div className="widget-drag-handle flex cursor-move items-center gap-2 border-b border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <span className="select-none">⠿</span>
                <span className="min-w-0 flex-1 truncate">{def.title}</span>
                {onHideWidget && !def.pinned && (
                  <button
                    type="button"
                    onClick={() => onHideWidget(def.id)}
                    title={`Hide ${def.title}`}
                    aria-label={`Hide ${def.title}`}
                    className="widget-no-drag shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <Body />
            </div>
          </div>
        );
      })}
    </RGL>
  );
}

export default DashboardGrid;
