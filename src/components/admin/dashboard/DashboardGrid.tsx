import { useMemo } from 'react';
import { Responsive, WidthProvider, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { getWidget } from './widgetRegistry';

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
}

/**
 * The customizable widget grid. Renders each visible widget inside a themed card
 * container and wires react-grid-layout drag/resize to `editMode`.
 */
export function DashboardGrid({ layout, visibleIds, editMode, onLayoutChange }: DashboardGridProps) {
  const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds]);

  // Only lay out + render tiles that are both visible and backed by a real widget.
  const visibleLayout = useMemo(
    () => layout.filter((l) => visibleSet.has(l.i) && getWidget(l.i)),
    [layout, visibleSet],
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
      onLayoutChange={(current) => onLayoutChange(current)}
      measureBeforeMount={false}
      useCSSTransforms
    >
      {visibleLayout.map((item) => {
        const def = getWidget(item.i)!;
        const Body = def.Component;
        return (
          <div
            key={item.i}
            className="group flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
          >
            {editMode && (
              <div className="widget-drag-handle flex cursor-move items-center gap-2 border-b border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <span className="select-none">⠿</span>
                <span className="truncate">{def.title}</span>
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
