import { useCallback, useEffect, useState } from 'react';

export type AdminDensity = 'comfortable' | 'compact';

const KEY = 'lumina:admin-density';
const EVENT = 'lumina-admin-density-change';

const read = (): AdminDensity => {
  try {
    return localStorage.getItem(KEY) === 'compact' ? 'compact' : 'comfortable';
  } catch {
    return 'comfortable';
  }
};

/**
 * Per-user admin density (Comfortable default · Compact opt-in), persisted to
 * localStorage. AdminLayout applies the resulting class to its <main>; the
 * sidebar toggle flips it. A window event keeps all consumers in sync.
 */
export const useAdminDensity = () => {
  const [density, setDensityState] = useState<AdminDensity>(read);

  useEffect(() => {
    const sync = () => setDensityState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync); // sync across tabs
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setDensity = useCallback((d: AdminDensity) => {
    try { localStorage.setItem(KEY, d); } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const toggle = useCallback(() => setDensity(read() === 'compact' ? 'comfortable' : 'compact'), [setDensity]);

  return { density, setDensity, toggle };
};
