import { LayoutDashboard, Car, Users, CreditCard, Settings, ChevronLeft, ChevronRight, ChevronDown, BarChart3, Package, Home, FileBarChart, Banknote, ShoppingCart, Calculator, Contact, Briefcase, TableProperties, Mail, Gift, Building2, FolderOpen, Search } from 'lucide-react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { OPEN_GLOBAL_SEARCH_EVENT } from './GlobalSearch';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useOutstandingReferralCount } from '@/hooks/useReferrals';
import { useMyAllowedSections } from '@/hooks/useRolePermissions';
import { sectionForPath } from '@/lib/permissions';

interface NavGroup {
  title: string;
  icon: any;
  children: { title: string; path: string }[];
}

interface NavItem {
  title: string;
  icon: any;
  path: string;
}

type MenuItem = NavItem | NavGroup;

const isGroup = (item: MenuItem): item is NavGroup => 'children' in item;

const menuItems: MenuItem[] = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
  {
    title: 'Inventory',
    icon: Car,
    children: [
      { title: 'Active Stock', path: '/admin/inventory' },
      { title: 'Cars to Buy', path: '/admin/cars-to-buy' },
    ],
  },
  { title: 'CRM', icon: Users, path: '/admin/crm' },
  { title: 'Finance', icon: CreditCard, path: '/admin/finance' },
  { title: 'Documents Hub', icon: FolderOpen, path: '/admin/documents' },
  { title: 'Quote Generator', icon: Calculator, path: '/admin/quotes' },
  { title: 'Juristic Capture', icon: Building2, path: '/admin/juristic' },
  { title: 'Extra Incomes', icon: Banknote, path: '/admin/extra-incomes' },
  { title: 'Trade Network', icon: Briefcase, path: '/admin/network' },
  { title: 'Referrals', icon: Gift, path: '/admin/referrals' },
  {
    title: 'Financials',
    icon: Package,
    children: [
      { title: 'Deal Ledger', path: '/admin/aftersales' },
      { title: 'Reports', path: '/admin/reports' },
      { title: 'Vendors', path: '/admin/vendors' },
      { title: 'Invoice Creator', path: '/admin/invoices' },
      { title: 'Export Builder', path: '/admin/export' },
      { title: 'Lead Analytics', path: '/admin/reports/lead-analytics' },
      { title: 'Analytics', path: '/admin/analytics' },
    ],
  },
  {
    title: 'Settings',
    icon: Settings,
    children: [
      { title: 'General', path: '/admin/settings' },
      { title: 'Email Templates', path: '/admin/settings/email' },
    ],
  },
];

interface AdminSidebarProps {
  onNavigate?: () => void;
  onCollapse?: (collapsed: boolean) => void;
}

const AdminSidebar = ({ onNavigate, onCollapse }: AdminSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { allowed, isAdmin } = useMyAllowedSections();
  const { data: outstandingRefs = 0 } = useOutstandingReferralCount();

  useEffect(() => {
    onCollapse?.(collapsed);
  }, [collapsed, onCollapse]);

  // The Finance applications table is wide — auto-collapse the sidebar when entering
  // it to free up horizontal space (desktop only; the mobile drawer has no onCollapse).
  const onFinance = location.pathname.startsWith('/admin/finance');
  useEffect(() => {
    if (onFinance && onCollapse) setCollapsed(true);
  }, [onFinance, onCollapse]);

  const isPathActive = (path: string) =>
    location.pathname === path || (path !== '/admin' && location.pathname.startsWith(path));

  const isGroupActive = (group: NavGroup) =>
    group.children.some(c => isPathActive(c.path));

  // A path is visible when the user is an admin, or its governing section is one the
  // user's role is granted (Settings/Dashboard have no section → admin-only).
  const canSeePath = (path: string) => {
    if (isAdmin) return true;
    const section = sectionForPath(path);
    return !!section && allowed.has(section);
  };

  // Filter menu by the per-role section matrix.
  const visibleMenuItems = menuItems
    .map((item) => {
      if (isGroup(item)) {
        const allowedChildren = item.children.filter(c => canSeePath(c.path));
        if (allowedChildren.length === 0) return null;
        return { ...item, children: allowedChildren } as NavGroup;
      }
      return canSeePath(item.path) ? item : null;
    })
    .filter(Boolean) as MenuItem[];


  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-card border-r border-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <div>
            <span className="font-display text-xl font-bold text-gradient">Lumina.</span>
            <span className="text-xs text-muted-foreground ml-1">Business OS</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto hidden md:flex"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="p-2 space-y-1 overflow-y-auto h-[calc(100vh-8rem)]">
        {/* Global search trigger (opens the Cmd/Ctrl+K palette) */}
        <button
          type="button"
          onClick={() => { window.dispatchEvent(new CustomEvent(OPEN_GLOBAL_SEARCH_EVENT)); onNavigate?.(); }}
          title="Search clients, applications, vehicles (Ctrl/⌘ K)"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full text-left mb-1',
            'text-muted-foreground hover:bg-secondary hover:text-foreground',
            collapsed && 'justify-center'
          )}
        >
          <Search className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="font-medium flex-1">Search</span>}
          {!collapsed && (
            <kbd className="ml-auto text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">⌘K</kbd>
          )}
        </button>

        {visibleMenuItems.map((item) => {
          if (isGroup(item)) {
            const groupActive = isGroupActive(item);

            // Collapsed mode: show just the icon
            if (collapsed) {
              return (
                <NavLink
                  key={item.title}
                  to={item.children[0].path}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center justify-center px-3 py-2.5 rounded-lg transition-colors',
                    groupActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                </NavLink>
              );
            }

            return (
              <Collapsible key={item.title} defaultOpen={groupActive}>
                <CollapsibleTrigger className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full text-left text-muted-foreground hover:bg-secondary hover:text-foreground group">
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium flex-1">{item.title}</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-6 mt-1 space-y-0.5 border-l border-border pl-3">
                    {item.children.map((child) => {
                      const active = isPathActive(child.path);
                      return (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          onClick={onNavigate}
                          className={cn(
                            'flex items-center px-3 py-2 rounded-lg text-sm transition-colors',
                            active
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                          )}
                        >
                          {child.title}
                        </NavLink>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          }

          // Single link item
          const active = isPathActive(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium flex-1">{item.title}</span>}
              {item.path === '/admin/referrals' && outstandingRefs > 0 && (
                <span
                  className={cn(
                    'ml-auto inline-flex items-center justify-center rounded-full bg-amber-500/90 text-black text-[10px] font-semibold px-1.5 min-w-[1.25rem] h-5',
                    collapsed && 'absolute right-1 top-1 px-1 min-w-[1rem] h-4 text-[9px]',
                  )}
                  title={`${outstandingRefs} referral fee${outstandingRefs === 1 ? '' : 's'} outstanding`}
                >
                  {outstandingRefs}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Back to Home */}
      <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-border bg-card">
        <Link
          to="/"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
            'text-muted-foreground hover:bg-secondary hover:text-foreground'
          )}
        >
          <Home className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="font-medium">Back to Home</span>}
        </Link>
      </div>
    </aside>
  );
};

export default AdminSidebar;
