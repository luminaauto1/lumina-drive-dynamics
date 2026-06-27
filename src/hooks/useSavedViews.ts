import { useCallback, useEffect, useState } from 'react';

/**
 * Named filter/view presets, persisted per user in localStorage.
 *
 * Generic over a JSON-serialisable `preset` shape so the same hook backs the
 * Pipeline toolbar and the Deal Desk Deals table. `scope` namespaces the storage
 * key (e.g. 'pipeline', 'dealdesk') and `userId` keeps one operator's saved views
 * from leaking into another's on a shared machine. Purely additive — no presets
 * means no behaviour change.
 */
export interface SavedView<P> {
  id: string;
  name: string;
  preset: P;
}

const keyFor = (scope: string, userId: string | null | undefined) =>
  `lumina:saved-views:${scope}:${userId || 'anon'}`;

function read<P>(scope: string, userId: string | null | undefined): SavedView<P>[] {
  try {
    const raw = localStorage.getItem(keyFor(scope, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedView<P>[]) : [];
  } catch {
    return [];
  }
}

export function useSavedViews<P>(scope: string, userId: string | null | undefined) {
  const [views, setViews] = useState<SavedView<P>[]>(() => read<P>(scope, userId));

  // Re-read when the active user changes (e.g. after login).
  useEffect(() => { setViews(read<P>(scope, userId)); }, [scope, userId]);

  const persist = useCallback((next: SavedView<P>[]) => {
    setViews(next);
    try { localStorage.setItem(keyFor(scope, userId), JSON.stringify(next)); } catch { /* ignore */ }
  }, [scope, userId]);

  const saveView = useCallback((name: string, preset: P) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setViews((prev) => {
      // Overwrite a same-named view rather than duplicating it.
      const without = prev.filter((v) => v.name.toLowerCase() !== trimmed.toLowerCase());
      const next = [...without, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: trimmed, preset }];
      try { localStorage.setItem(keyFor(scope, userId), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [scope, userId]);

  const deleteView = useCallback((id: string) => {
    setViews((prev) => {
      const next = prev.filter((v) => v.id !== id);
      try { localStorage.setItem(keyFor(scope, userId), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [scope, userId]);

  return { views, saveView, deleteView, persist };
}
