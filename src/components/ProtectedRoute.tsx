import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMyAllowedSections } from '@/hooks/useRolePermissions';
import { landingPathForSections } from '@/lib/permissions';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Require ANY staff member (super_admin OR sales_agent). */
  requireAdmin?: boolean;
  /** Require super_admin specifically. Blocks sales_agent. */
  requireSuperAdmin?: boolean;
  /** When combined with requireSuperAdmin, also allows F&I (standard or senior) roles. */
  allowFAndI?: boolean;
  /** When combined with requireSuperAdmin, also allows the accountant role. */
  allowAccountant?: boolean;
  /** Block normal f_and_i (standard, non-senior) from this route. */
  blockStandardFAndI?: boolean;
  /**
   * Section key (see lib/permissions). When set, access is governed by the
   * editable per-role access matrix: super admins always pass; other staff pass
   * only if their role is granted this section. RLS remains the data security floor.
   */
  section?: string;
}

const ProtectedRoute = ({
  children, requireAdmin = false, requireSuperAdmin = false,
  allowFAndI = false, allowAccountant = false, section,
}: ProtectedRouteProps) => {
  const { user, loading, isAdmin, isStaff, isFAndI, isAccountant } = useAuth();
  const { allowed, isAdmin: hasAllSections, isLoading: permsLoading } = useMyAllowedSections();
  const location = useLocation();

  if (loading || (section && permsLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ returnTo: location.pathname }} replace />;
  }

  // Section-based access (the editable per-role matrix).
  if (section) {
    if (!isStaff) return <Navigate to="/" replace />;
    if (hasAllSections || allowed.has(section)) return <>{children}</>;
    // Send them to the first area they CAN see; bail to home if they have none.
    const landing = allowed.size ? landingPathForSections(allowed) : '/';
    if (landing === location.pathname) return <>{children}</>; // avoid redirect loop
    return <Navigate to={landing} replace />;
  }

  if (requireSuperAdmin && !isAdmin && !(allowFAndI && isFAndI) && !(allowAccountant && isAccountant)) {
    // Bounce a non-admin to the first area their role can actually open; non-staff to home.
    const fallback = isStaff && allowed.size ? landingPathForSections(allowed) : '/';
    return <Navigate to={fallback} replace />;
  }

  // requireAdmin now means "any staff" for backwards compatibility,
  // since most existing routes were intended for staff use.
  if (requireAdmin && !isStaff) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
