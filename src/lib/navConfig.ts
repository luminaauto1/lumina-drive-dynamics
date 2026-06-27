// Pure helpers for the editable admin sidebar.
// AdminSidebar owns the *code defaults* (sections with icons); these functions
// apply an admin-saved NavConfig (order + hide/show) on top, and are also used
// by the Appearance & Navigation settings tab to render/reorder the same list.
// Item id = its path (stable). Section id = its label (stable). Role filtering
// is applied separately by the sidebar AFTER this, so a config can never grant
// access — it only hides/reorders what the user could already see.
import type { NavConfig, NavSectionOverride } from '@/hooks/useDocumentSettings';

export interface NavLeafLike { title: string; path: string }
export interface NavSectionLike<T extends NavLeafLike = NavLeafLike> { label: string; items: T[] }

export const sectionId = (s: { label: string }) => s.label;
export const itemId = (i: { path: string }) => i.path;

// Order `arr` by the saved id list, appending any ids not present in `order`
// (new code-added entries) in their original order; drops stale ids.
function applyOrder<T>(arr: T[], idOf: (x: T) => string, order?: string[]): T[] {
  if (!order || order.length === 0) return arr;
  const byId = new Map(arr.map((x) => [idOf(x), x]));
  const out: T[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    const x = byId.get(id);
    if (x && !seen.has(id)) { out.push(x); seen.add(id); }
  }
  for (const x of arr) if (!seen.has(idOf(x))) out.push(x);
  return out;
}

/** Apply a saved NavConfig (order + visibility) to the code-default sections.
 *  Hidden sections/items are removed; everything else keeps its code definition
 *  (icons, badges, etc.). Falls back to the defaults when config is absent. */
export function applyNavConfig<T extends NavLeafLike, S extends NavSectionLike<T>>(
  sections: S[],
  config?: NavConfig | null,
): S[] {
  if (!config || (!config.sectionOrder && !config.sections)) return sections;
  const orderedSections = applyOrder(sections, sectionId, config.sectionOrder);
  return orderedSections
    .map((s) => {
      const ov: NavSectionOverride | undefined = config.sections?.[sectionId(s)];
      if (ov?.hidden) return null;
      let items = applyOrder(s.items, itemId, ov?.order);
      if (ov?.items) items = items.filter((i) => !ov.items?.[itemId(i)]?.hidden);
      return { ...s, items } as S;
    })
    .filter((s): s is S => !!s && s.items.length > 0);
}
