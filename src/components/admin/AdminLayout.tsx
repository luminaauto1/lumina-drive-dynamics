import { ReactNode, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AdminSidebar from './AdminSidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, isAdmin, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Desktop Sidebar - spacer div matches fixed sidebar width */}
      <div className={`hidden md:block flex-shrink-0 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
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
          <SheetContent side="left" className="p-0 w-64">
            <AdminSidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-display text-lg font-bold text-gradient ml-3">Admin</span>
      </div>

      {/* Main Content - flex-1 fills remaining space, min-w-0 prevents overflow */}
      <main className="flex-1 min-w-0 min-h-screen pt-14 md:pt-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
