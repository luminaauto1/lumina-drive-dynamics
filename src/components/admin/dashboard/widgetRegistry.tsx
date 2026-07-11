import type { WidgetDef } from './types';

/**
 * Central registry of every dashboard widget.
 *
 * FOUNDATION STAGE: this starts empty (well — with a single placeholder so the
 * grid/customize panel are exercisable). The Widgets stage replaces the
 * placeholder with the real widgets extracted from AdminAnalytics.tsx. The
 * framework (useDashboardLayout / DashboardGrid / CustomizePanel) derives all of
 * its defaults from this array, so registering a widget is the only step needed
 * to make it appear in the library + default layout.
 */

const Placeholder = () => null;

export const WIDGET_REGISTRY: WidgetDef[] = [
  // Example shape (kept as a visible-but-inert placeholder so the empty grid has
  // something to render during the foundation stage). Remove/replace in Widgets stage.
  {
    id: '__placeholder__',
    title: 'Placeholder',
    category: 'Setup',
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    Component: Placeholder,
  },
];

/** Look up a widget definition by id. Returns undefined for unknown ids. */
export function getWidget(id: string): WidgetDef | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === id);
}
