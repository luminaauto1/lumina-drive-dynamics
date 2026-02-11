import { LayoutDashboard, Car, Users, CreditCard, Settings, ChevronLeft, ChevronRight, BarChart3, Package, Home, MessageSquareQuote, FileBarChart, Banknote, ShoppingCart } from 'lucide-react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const menuItems = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
  { title: 'Inventory', icon: Car, path: '/admin/inventory' },
  { title: 'Cars To Buy', icon: ShoppingCart, path: '/admin/cars-to-buy' },
  { title: 'Leads', icon: Users, path: '/admin/leads' },
  { title: 'Finance', icon: CreditCard, path: '/admin/finance' },
  { title: 'Quote Generator', icon: MessageSquareQuote, path: '/admin/quotes' },
  { title: 'Extra Incomes', icon: Banknote, path: '/admin/extra-incomes' },
  { title: 'Aftersales', icon: Package, path: '/admin/aftersales' },
  { title: 'Reports', icon: FileBarChart, path: '/admin/reports' },
  { title: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
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
          <span className="font-display text-xl font-bold text-gradient">
            Admin
          </span>
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
      <nav className="p-2 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/admin' && location.pathname.startsWith(item.path));
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isActive
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

      {/* Back to Home Button */}
      <div className="p-2 mt-2">
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

      {/* Footer */}
      {!collapsed && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="glass-card rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Lumina Auto DMS</p>
            <p className="text-xs text-muted-foreground">v1.0.0</p>
          </div>
        </div>
      )}
    </aside>
  );
};

export default AdminSidebar;
