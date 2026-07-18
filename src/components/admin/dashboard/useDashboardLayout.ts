import { useCallback, useMemo, useState } from 'react';
import type { Layout } from 'react-grid-layout';
import { WIDGET_REGISTRY } from './widgetRegistry';
import type { DashboardPersistedState, DashboardStorageAdapter, WidgetDef } from './types';

/**
 * Layout engine for customizable widget dashboards.
 *
 * Framework-level: the hook takes a widget REGISTRY (what can be shown) and a
 * STORAGE ADAPTER (where the layout persists) and returns the merged layout +
 * visibility state plus the mutation API DashboardGrid / CustomizePanel consume.
 *
 * Callers:
 *  - /admin/analytics — `useDashboardLayout()` with no options: the analytics
 *    WIDGET_REGISTRY + the built-in per-browser localStorage adapter
 *    (key lumina.admin.dashboard.v1). Behaviour unchanged from before the
 *    adapter refactor.
 *  - /admin (Command Center) — its own registry + useGlobalDashboardAdapter:
 *    ONE shared layout for every staff member, stored in
 *    site_settings.document_settings.commandDashboardLayout; only super-admins
 *    can edit (adapter.canEdit).
 *
 * Merge-safe: defaults derive from the registry, so when a widget is added to
 * the registry its default tile is appended and it shows by default; when one is
 * removed, its stale layout/visible entry is dropped. Bump the adapter's version
 * to force everyone back to defaults after an incompatible change.
 */

const STORAGE_VERSION = 'v1';
const STORAGE_KEY = `lumina.admin.dashboard.${STORAGE_VERSION}`;

/** Grid columns at the `lg` breakpoint. defaultLayout widths are relative to this. */
const GRID_COLS = 12;

/** Left-to-right shelf packing of a registry into a 12-col grid. */
export function buildDefaultLayout(defs: WidgetDef[]): Layout[] {
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

function defaultVisibleIds(registry: WidgetDef[]): string[] {
  return registry.map((w) => w.id);
}

/** Ids of widgets that can never be hidden (WidgetDef.pinned). */
function pinnedIds(registry: WidgetDef[]): Set<string> {
  return new Set(registry.filter((w) => w.pinned).map((w) => w.id));
}

/** Merge a persisted layout with the current registry. */
function mergeLayout(registry: WidgetDef[], saved: Layout[] | undefined): Layout[] {
  const defaults = buildDefaultLayout(registry);
  if (!saved || saved.length === 0) return defaults;
  const savedById = new Map(saved.map((l) => [l.i, l]));
  const defById = new Map(defaults.map((l) => [l.i, l]));
  // Registry order, saved geometry where present, defaults otherwise. Unknown
  // (removed) ids in `saved` are dropped because we only iterate the registry.
  return registry.map((def) => {
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
function mergeVisible(
  registry: WidgetDef[],
  savedVisible: string[] | undefined,
  savedLayout: Layout[] | undefined,
): string[] {
  const registryIds = registry.map((w) => w.id);
  if (!savedVisible) return registryIds;
  const knownAtSave = new Set((savedLayout ?? []).map((l) => l.i));
  const visibleSet = new Set(savedVisible.filter((id) => registryIds.includes(id)));
  // Any registry id the user has never seen (absent from the persisted layout) is new → show it.
  for (const id of registryIds) {
    if (!knownAtSave.has(id)) visibleSet.add(id);
  }
  // Pinned widgets are always visible, even if an older persisted state hid them.
  for (const id of pinnedIds(registry)) visibleSet.add(id);
  return registryIds.filter((id) => visibleSet.has(id));
}

/* ── Default adapter: per-browser localStorage (the analytics dashboard) ─────── */

function readPersisted(key: string): DashboardPersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== STORAGE_VERSION) return null;
    return parsed as DashboardPersistedState;
  } catch {
    return null;
  }
}

function writePersisted(key: string, state: DashboardPersistedState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

function useLocalStorageAdapter(key: string): DashboardStorageAdapter {
  const [state, setState] = useState<DashboardPersistedState | null>(() => readPersisted(key));
  const save = useCallback(
    (next: { layout: Layout[]; visibleIds: string[] }) => {
      const payload: DashboardPersistedState = { version: STORAGE_VERSION, ...next };
      setState(payload);
      writePersisted(key, payload);
    },
    [key],
  );
  return useMemo(() => ({ state, isLoading: false, canEdit: true, save }), [state, save]);
}

/* ── The layout hook ──────────────────────────────────────────────────────────── */

export interface DashboardLayoutApi {
  /** Current react-grid-layout items (registry-merged, all widgets — visibility is separate). */
  layout: Layout[];
  /** Ids of widgets the user wants shown, in registry order. */
  visibleIds: string[];
  /** When true, the grid is draggable + resizable. Transient — not persisted. */
  editMode: boolean;
  /** False while an async adapter (DB) is still loading its saved state. */
  ready: boolean;
  /** Whether this user may edit the layout (adapter-controlled; localStorage = always). */
  canEdit: boolean;
  /** Persist a new layout (called by DashboardGrid.onLayoutChange). */
  setLayout: (next: Layout[]) => void;
  /** Show/hide a single widget. */
  toggleVisible: (id: string) => void;
  /** Make every registered widget visible. */
  showAll: () => void;
  /** Wipe persistence and return to registry defaults. */
  resetToDefault: () => void;
  /** Enter/exit layout edit mode. No-op when canEdit is false. */
  setEditMode: (on: boolean) => void;
}

export interface DashboardLayoutOptions {
  /** Widget registry backing this dashboard. Default: the analytics WIDGET_REGISTRY. */
  registry?: WidgetDef[];
  /** Storage adapter. Default: per-browser localStorage (lumina.admin.dashboard.v1). */
  adapter?: DashboardStorageAdapter;
}

export function useDashboardLayout(options: DashboardLayoutOptions = {}): DashboardLayoutApi {
  const registry = options.registry ?? WIDGET_REGISTRY;
  // Always called (rules of hooks) — inert when an external adapter is supplied.
  // A call site either always passes an adapter or never does, so hook order is stable.
  const localAdapter = useLocalStorageAdapter(STORAGE_KEY);
  const adapter = options.adapter ?? localAdapter;
  const canEdit = adapter.canEdit !== false;

  // Local working copy — set on the first mutation. It masks adapter.state from
  // then on, so an async adapter's in-flight save can never bounce the UI back.
  const [draft, setDraft] = useState<{ layout: Layout[]; visibleIds: string[] } | null>(null);
  const [editMode, setEditModeState] = useState(false);

  const sourceLayout = draft?.layout ?? adapter.state?.layout;
  const sourceVisible = draft?.visibleIds ?? adapter.state?.visibleIds;

  const layout = useMemo(() => mergeLayout(registry, sourceLayout), [registry, sourceLayout]);
  const visibleIds = useMemo(
    () => mergeVisible(registry, sourceVisible, sourceLayout),
    [registry, sourceVisible, sourceLayout],
  );

  const commit = useCallback(
    (next: { layout: Layout[]; visibleIds: string[] }) => {
      if (!canEdit) return;
      setDraft(next);
      adapter.save(next);
    },
    [adapter, canEdit],
  );

  const setLayout = useCallback(
    (next: Layout[]) => {
      // RGL emits an empty array in some transient states — ignore those.
      if (!next || next.length === 0) return;
      // RGL only reports geometry for RENDERED (visible) tiles. Merge it into the
      // full-registry layout so hidden widgets keep their saved tiles and re-appear
      // where they were when toggled back on.
      const incoming = new Map(next.map((l) => [l.i, l]));
      commit({ layout: layout.map((item) => incoming.get(item.i) ?? item), visibleIds });
    },
    [commit, layout, visibleIds],
  );

  const toggleVisible = useCallback(
    (id: string) => {
      // Pinned widgets can never be toggled off.
      if (pinnedIds(registry).has(id)) return;
      const registryIds = registry.map((w) => w.id);
      const set = new Set(visibleIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      commit({ layout, visibleIds: registryIds.filter((rid) => set.has(rid)) });
    },
    [commit, registry, layout, visibleIds],
  );

  const showAll = useCallback(() => {
    commit({ layout, visibleIds: defaultVisibleIds(registry) });
  }, [commit, registry, layout]);

  const resetToDefault = useCallback(() => {
    commit({ layout: buildDefaultLayout(registry), visibleIds: defaultVisibleIds(registry) });
    setEditModeState(false);
  }, [commit, registry]);

  const setEditMode = useCallback(
    (on: boolean) => {
      setEditModeState(on && canEdit);
    },
    [canEdit],
  );

  return useMemo(
    () => ({
      layout,
      visibleIds,
      editMode: editMode && canEdit,
      ready: !(adapter.isLoading ?? false),
      canEdit,
      setLayout,
      toggleVisible,
      showAll,
      resetToDefault,
      setEditMode,
    }),
    [
      layout,
      visibleIds,
      editMode,
      canEdit,
      adapter.isLoading,
      setLayout,
      toggleVisible,
      showAll,
      resetToDefault,
      setEditMode,
    ],
  );
}
