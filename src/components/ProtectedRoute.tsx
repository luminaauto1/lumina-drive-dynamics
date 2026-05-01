import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Require ANY staff member (super_admin OR sales_agent). */
  requireAdmin?: boolean;
  /** Require super_admin specifically. Blocks sales_agent. */
  requireSuperAdmin?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false, requireSuperAdmin = false }: ProtectedRouteProps) => {
  const { user, loading, isAdmin, isStaff } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ returnTo: location.pathname }} replace />;
  }

  if (requireSuperAdmin && !isAdmin) {
    // Sales agents land on the leads pipeline; non-staff bounce to home.
    return <Navigate to={isStaff ? '/admin/leads' : '/'} replace />;
  }

  // requireAdmin now means "any staff" for backwards compatibility,
  // since most existing routes were intended for staff use.
  if (requireAdmin && !isStaff) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
