import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Layout } from 'react-grid-layout';
import { WIDGET_REGISTRY } from './widgetRegistry';
import type { WidgetDef } from './types';

/**
 * Per-browser persistence of the customizable dashboard: tile layout + which
 * widgets are visible. Mirrors the versioned-localStorage pattern used by
 * src/lib/pipelinev2/columns.ts.
 *
 * Merge-safe: defaults derive from WIDGET_REGISTRY, so when a widget is added to
 * the registry its default tile is appended and it shows by default; when one is
 * removed, its stale layout/visible entry is dropped. Bump STORAGE_VERSION to
 * force everyone back to defaults after an incompatible change.
 */

const STORAGE_VERSION = 'v1';
const STORAGE_KEY = `lumina.admin.dashboard.${STORAGE_VERSION}`;

/** Grid columns at the `lg` breakpoint. defaultLayout widths are relative to this. */
const GRID_COLS = 12;

interface PersistedState {
  version: string;
  layout: Layout[];
  visibleIds: string[];
}

/** Left-to-right shelf packing of the registry into a 12-col grid. */
function buildDefaultLayout(defs: WidgetDef[]): Layout[] {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  return defs.map((def) => {
    const { w, h, minW, minH } = def.defaultLayout;
    if (x + w > GRID_COLS) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    const item: Layout = { i: def.id, x, y, w, h, minW, minH };
    x += w;
    rowHeight = Math.max(rowHeight, h);
    return item;
  });
}

function defaultLayout(): Layout[] {
  return buildDefaultLayout(WIDGET_REGISTRY);
}

function defaultVisibleIds(): string[] {
  return WIDGET_REGISTRY.map((w) => w.id);
}

/** Merge a persisted layout with the current registry. */
function mergeLayout(saved: Layout[] | undefined): Layout[] {
  const defaults = buildDefaultLayout(WIDGET_REGISTRY);
  if (!saved || saved.length === 0) return defaults;
  const savedById = new Map(saved.map((l) => [l.i, l]));
  const defById = new Map(defaults.map((l) => [l.i, l]));
  // Registry order, saved geometry where present, defaults otherwise. Unknown
  // (removed) ids in `saved` are dropped because we only iterate the registry.
  return WIDGET_REGISTRY.map((def) => {
    const savedItem = savedById.get(def.id);
    const defItem = defById.get(def.id)!;
    if (!savedItem) return defItem;
    // Always re-apply current min clamps from the registry.
    return {
      ...savedItem,
      minW: def.defaultLayout.minW,
      minH: def.defaultLayout.minH,
    };
  });
}

/** Merge persisted visibility with the registry. New widgets default to visible. */
function mergeVisible(savedVisible: string[] | undefined, savedLayout: Layout[] | undefined): string[] {
  const registryIds = WIDGET_REGISTRY.map((w) => w.id);
  if (!savedVisible) return registryIds;
  const knownAtSave = new Set((savedLayout ?? []).map((l) => l.i));
  const visibleSet = new Set(savedVisible.filter((id) => registryIds.includes(id)));
  // Any registry id the user has never seen (absent from the persisted layout) is new → show it.
  for (const id of registryIds) {
    if (!knownAtSave.has(id)) visibleSet.add(id);
  }
  return registryIds.filter((id) => visibleSet.has(id));
}

function readPersisted(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== STORAGE_VERSION) return null;
    return parsed as PersistedState;
  } catch {
    return null;
  }
}

function writePersisted(state: { layout: Layout[]; visibleIds: string[] }) {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedState = { version: STORAGE_VERSION, ...state };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export interface DashboardLayoutApi {
  /** Current react-grid-layout items (registry-merged, all widgets — visibility is separate). */
  layout: Layout[];
  /** Ids of widgets the user wants shown, in registry order. */
  visibleIds: string[];
  /** When true, the grid is draggable + resizable. Transient — not persisted. */
  editMode: boolean;
  /** Persist a new layout (called by DashboardGrid.onLayoutChange). */
  setLayout: (next: Layout[]) => void;
  /** Show/hide a single widget. */
  toggleVisible: (id: string) => void;
  /** Make every registered widget visible. */
  showAll: () => void;
  /** Wipe persistence and return to registry defaults. */
  resetToDefault: () => void;
  /** Enter/exit layout edit mode. */
  setEditMode: (on: boolean) => void;
}

export function useDashboardLayout(): DashboardLayoutApi {
  const [layout, setLayoutState] = useState<Layout[]>(() => mergeLayout(readPersisted()?.layout));
  const [visibleIds, setVisibleIds] = useState<string[]>(() => {
    const p = readPersisted();
    return mergeVisible(p?.visibleIds, p?.layout);
  });
  const [editMode, setEditMode] = useState(false);

  // Persist layout + visibility whenever either changes.
  useEffect(() => {
    writePersisted({ layout, visibleIds });
  }, [layout, visibleIds]);

  const setLayout = useCallback((next: Layout[]) => {
    // RGL emits an empty array in some transient states — ignore those.
    if (!next || next.length === 0) return;
    setLayoutState(next);
  }, []);

  const toggleVisible = useCallback((id: string) => {
    setVisibleIds((prev) => {
      const registryIds = WIDGET_REGISTRY.map((w) => w.id);
      const set = new Set(prev);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return registryIds.filter((rid) => set.has(rid));
    });
  }, []);

  const showAll = useCallback(() => {
    setVisibleIds(defaultVisibleIds());
  }, []);

  const resetToDefault = useCallback(() => {
    const l = defaultLayout();
    const v = defaultVisibleIds();
    setLayoutState(l);
    setVisibleIds(v);
    setEditMode(false);
    writePersisted({ layout: l, visibleIds: v });
  }, []);

  return useMemo(
    () => ({
      layout,
      visibleIds,
      editMode,
      setLayout,
      toggleVisible,
      showAll,
      resetToDefault,
      setEditMode,
    }),
    [layout, visibleIds, editMode, setLayout, toggleVisible, showAll, resetToDefault],
  );
}
