import { LayoutDashboard, Car, Users, CreditCard, Settings, ChevronLeft, ChevronRight, ChevronDown, BarChart3, Package, Home, FileBarChart, Banknote, ShoppingCart, Calculator, Contact, Briefcase } from 'lucide-react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  {
    title: 'CRM',
    icon: Users,
    children: [
      { title: 'Pipeline', path: '/admin/leads' },
      { title: 'Contacts', path: '/admin/contacts' },
    ],
  },
  { title: 'Finance', icon: CreditCard, path: '/admin/finance' },
  { title: 'Quote Generator', icon: Calculator, path: '/admin/quotes' },
  { title: 'Extra Incomes', icon: Banknote, path: '/admin/extra-incomes' },
  { title: 'Trade Network', icon: Briefcase, path: '/admin/network' },
  {
    title: 'Financials',
    icon: Package,
    children: [
      { title: 'Deal Ledger', path: '/admin/aftersales' },
      { title: 'Reports', path: '/admin/reports' },
      { title: 'Analytics', path: '/admin/analytics' },
    ],
  },
  { title: 'Settings', icon: Settings, path: '/admin/settings' },
];

interface AdminSidebarProps {
  onNavigate?: () => void;
  onCollapse?: (collapsed: boolean) => void;
}

const AdminSidebar = ({ onNavigate, onCollapse }: AdminSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    onCollapse?.(collapsed);
  }, [collapsed, onCollapse]);

  const isPathActive = (path: string) =>
    location.pathname === path || (path !== '/admin' && location.pathname.startsWith(path));

  const isGroupActive = (group: NavGroup) =>
    group.children.some(c => isPathActive(c.path));

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
        {menuItems.map((item) => {
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
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium">{item.title}</span>}
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
