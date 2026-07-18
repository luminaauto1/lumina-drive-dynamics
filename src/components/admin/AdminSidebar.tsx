import {
  LayoutDashboard, TableProperties, CreditCard, ClipboardList, Car,
  Calculator, FileSignature, FolderOpen, Building2, ShoppingCart,
  Receipt, Coins, Truck, FileBarChart, BarChart3, LineChart, Download,
  Briefcase, Gift, Contact, Settings, ChevronLeft, ChevronRight, Home, Users,
  MessageCircle,
} from 'lucide-react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useOutstandingReferralCount } from '@/hooks/useReferrals';
import { useMyAllowedSections } from '@/hooks/useRolePermissions';
import { sectionForPath } from '@/lib/permissions';
import { useDocumentSettings } from '@/hooks/useDocumentSettings';
import { applyNavConfig } from '@/lib/navConfig';

export interface NavLeaf {
  title: string;
  icon: any;
  path: string;
}
export interface NavSection {
  label: string;
  items: NavLeaf[];
}

// Flat, direct-link navigation grouped under quiet section headers (no dropdowns).
// Daily-use destinations first. Every item navigates straight to its tab.
// Exported as the canonical code default — the Appearance & Navigation settings
// tab renders/reorders this same list, and an admin-saved nav config is applied
// on top of it (see lib/navConfig).
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Main',
    items: [
      { title: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
      { title: 'Pipeline', icon: TableProperties, path: '/admin/pipeline-v2' },
      { title: 'Finance', icon: CreditCard, path: '/admin/finance' },
      { title: 'Deal Desk', icon: ClipboardList, path: '/admin/deal-desk' },
      { title: 'Inventory', icon: Car, path: '/admin/inventory' },
    ],
  },
  {
    label: 'Docs & Sales',
    items: [
      { title: 'Quote Generator', icon: Calculator, path: '/admin/quotes' },
      { title: 'OTP Generator', icon: FileSignature, path: '/admin/otp' },
      { title: 'Documents Hub', icon: FolderOpen, path: '/admin/documents' },
      { title: 'Juristic Capture', icon: Building2, path: '/admin/juristic' },
      { title: 'Cars to Buy', icon: ShoppingCart, path: '/admin/cars-to-buy' },
    ],
  },
  {
    label: 'Money',
    items: [
      // Deal Ledger folded into Deal Desk (Money home is now Deal Desk's
      // Ledger / Profit + Customer Follow-ups tabs). Nav item removed.
      { title: 'Invoice Creator', icon: Receipt, path: '/admin/invoices' },
      { title: 'Extra Incomes', icon: Coins, path: '/admin/extra-incomes' },
      { title: 'Vendors', icon: Truck, path: '/admin/vendors' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { title: 'Reports', icon: FileBarChart, path: '/admin/reports' },
      { title: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
      { title: 'Lead Analytics', icon: LineChart, path: '/admin/reports/lead-analytics' },
      { title: 'Leads Cycle', icon: Users, path: '/admin/lead-cycle' },
      { title: 'Export Builder', icon: Download, path: '/admin/export' },
    ],
  },
  {
    label: 'Network',
    items: [
      { title: 'Trade Network', icon: Briefcase, path: '/admin/network' },
      { title: 'Referrals', icon: Gift, path: '/admin/referrals' },
      { title: 'Contacts', icon: Contact, path: '/admin/contacts' },
      { title: 'Reply Suggester', icon: MessageCircle, path: '/admin/chat-control' },
    ],
  },
  {
    label: 'System',
    items: [
      { title: 'Settings', icon: Settings, path: '/admin/settings' },
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
  const { data: docSettings } = useDocumentSettings();

  useEffect(() => {
    onCollapse?.(collapsed);
  }, [collapsed, onCollapse]);

  // The Finance/Pipeline tables are wide — auto-collapse to free horizontal space.
  const onFinance =
    location.pathname.startsWith('/admin/finance') || location.pathname.startsWith('/admin/pipeline-v2');
  useEffect(() => {
    if (onFinance && onCollapse) setCollapsed(true);
  }, [onFinance, onCollapse]);

  const isPathActive = (path: string) =>
    location.pathname === path || (path !== '/admin' && location.pathname.startsWith(path));

  // A path is visible when the user is an admin, or its governing section is granted.
  const canSeePath = (path: string) => {
    if (isAdmin) return true;
    const section = sectionForPath(path);
    return !!section && allowed.has(section);
  };

  // 1) Apply the admin's saved appearance/order config (hide/show + reorder).
  // 2) Then apply role filtering — a config can only ever hide/reorder what the
  //    user could already see, never grant access.
  const configuredSections = applyNavConfig(NAV_SECTIONS, docSettings?.navConfig);
  const visibleSections = configuredSections
    .map((s) => ({ ...s, items: s.items.filter((i) => canSeePath(i.path)) }))
    .filter((s) => s.items.length > 0);

  const renderItem = (item: NavLeaf) => {
    const active = isPathActive(item.path);
    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={onNavigate}
        title={collapsed ? item.title : undefined}
        className={cn(
          'relative flex items-center gap-2.5 rounded-md transition-colors',
          collapsed ? 'justify-center px-2 py-2' : 'px-3 py-1.5',
          active
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )}
      >
        <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
        {!collapsed && <span className="text-sm font-medium flex-1 truncate">{item.title}</span>}
        {item.path === '/admin/referrals' && outstandingRefs > 0 && (
          <span
            className={cn(
              'inline-flex items-center justify-center rounded-full bg-amber-500/90 text-black text-[10px] font-semibold px-1.5 min-w-[1.25rem] h-4',
              collapsed && 'absolute right-1 top-1 px-1 min-w-[0.9rem] h-3.5 text-[8px]',
            )}
            title={`${outstandingRefs} referral fee${outstandingRefs === 1 ? '' : 's'} outstanding`}
          >
            {outstandingRefs}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-card border-r border-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
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
      <nav className="px-2 py-2 overflow-y-auto h-[calc(100vh-8rem)]">
        {visibleSections.map((section) => (
          <div key={section.label} className="mb-1">
            {!collapsed && (
              <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {section.label}
              </div>
            )}
            {collapsed && <div className="my-1.5 mx-3 border-t border-border" />}
            <div className="space-y-0.5">{section.items.map(renderItem)}</div>
          </div>
        ))}
      </nav>

      {/* Footer: back to home */}
      <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-border bg-card space-y-0.5">
        <Link
          to="/"
          onClick={onNavigate}
          title={collapsed ? 'Back to Home' : undefined}
          className={cn(
            'flex items-center gap-2.5 rounded-md transition-colors',
            collapsed ? 'justify-center px-2 py-2' : 'px-3 py-1.5',
            'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
        >
          <Home className="h-[18px] w-[18px] flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Back to Home</span>}
        </Link>
      </div>
    </aside>
  );
};

export default AdminSidebar;
