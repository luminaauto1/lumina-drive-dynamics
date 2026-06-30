import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AdminSidebar from './AdminSidebar';
import GlobalSearch from './GlobalSearch';
import TaskOSButton from './taskos/TaskOSButton';
import { Menu, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAdminDensity } from '@/hooks/useAdminDensity';
import { useDeskTheme } from '@/hooks/useDeskTheme';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, isStaff, loading } = useAuth();
  const { density } = useAdminDensity();
  const { theme, toggle: toggleTheme } = useDeskTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Radix overlays (Dialog/Sheet/Popover/DropdownMenu/Select/Tooltip/etc.) portal
  // into document.body, OUTSIDE the .desk-root.theme-light wrapper, so they inherit
  // the default dark :root tokens. Mark <html> with `desk-portal-light` in admin
  // light mode so portaled overlay content can re-scope to the light palette.
  // Always cleared on cleanup / when theme flips to dark, so the public site
  // (which never mounts AdminLayout) is never affected.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('desk-portal-light');
    } else {
      root.classList.remove('desk-portal-light');
    }
    return () => {
      root.classList.remove('desk-portal-light');
    };
  }, [theme]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isStaff) {
    return <Navigate to="/auth" replace />;
  }

  return (
    // `desk-root` on the OUTER shell so the WHOLE admin chrome (sidebar + header +
    // main) shares the DM Sans UI font and re-themes together in light mode. The
    // light tokens are scoped to `.desk-root.theme-light`, so the public site is
    // never touched. `<main>` keeps its own desk-root for the density rules.
    <div className={`desk-root${theme === 'light' ? ' theme-light' : ''} min-h-screen bg-background flex w-full`}>
      {/* Desktop Sidebar - spacer div matches fixed sidebar width */}
      <div className={`hidden md:block flex-shrink-0 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
        <AdminSidebar onCollapse={setCollapsed} />
      </div>

      {/* Mobile Header + Drawer */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card border-b border-border flex items-center px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          {/* The drawer is portaled to <body> (outside the .desk-root wrapper), so
              it must carry the theme class itself — otherwise the sidebar inside it
              renders with the default dark tokens even in admin light mode. */}
          <SheetContent side="left" className={`desk-root${theme === 'light' ? ' theme-light' : ''} p-0 w-64`}>
            <AdminSidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-display text-lg font-bold text-gradient ml-3">Admin</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          onClick={toggleTheme}
          title={`Theme: ${theme === 'light' ? 'Light' : 'Dark'} — tap to switch`}
        >
          {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </Button>
      </div>

      {/* Main Content - flex-1 fills remaining space, min-w-0 prevents overflow */}
      <main className={`desk-root density-${density}${theme === 'light' ? ' theme-light' : ''} flex-1 min-w-0 min-h-screen pt-14 md:pt-0 overflow-x-hidden`}>
        {children}
      </main>

      <GlobalSearch />
      <TaskOSButton />
    </div>
  );
};

export default AdminLayout;
