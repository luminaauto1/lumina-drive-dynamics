import { useCallback, useEffect, useState } from 'react';

export type DeskTheme = 'dark' | 'light';

const KEY = 'lumina:admin-theme';
const EVENT = 'lumina-admin-theme-change';

const read = (): DeskTheme => {
  try {
    // Default = dark (brand obsidian); light is opt-in but one click away.
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

/**
 * Admin-only light/dark theme, persisted to localStorage. AdminLayout adds
 * `theme-light` to its `.desk-root` <main> when light; the sidebar sun/moon
 * control flips it. A window event keeps every consumer (e.g. status badges)
 * in sync without prop drilling. The public marketing site never reads this —
 * it is scoped entirely to the admin wrapper.
 */
export const useDeskTheme = () => {
  const [theme, setThemeState] = useState<DeskTheme>(read);

  useEffect(() => {
    const sync = () => setThemeState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync); // sync across tabs
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setTheme = useCallback((t: DeskTheme) => {
    try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const toggle = useCallback(() => setTheme(read() === 'light' ? 'dark' : 'light'), [setTheme]);

  return { theme, setTheme, toggle };
};
