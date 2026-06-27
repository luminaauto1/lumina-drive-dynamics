import { Navigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import AdminLayout from '@/components/admin/AdminLayout';
import SettingsPageLayout from '@/components/admin/settings/SettingsPageLayout';
import { SETTINGS_BY_KEY } from '@/components/admin/settings/settingsRegistry';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Renders a single setting on its own route `/admin/settings/<key>`.
 *
 * The route table already gates the whole tree behind `requireSuperAdmin` (via
 * ProtectedRoute), but individual settings can ALSO be super-admin-only; for a
 * non-super-admin we redirect those (and unknown keys) back to the index so the
 * page can't be reached by typing the URL.
 */
const AdminSettingPage = () => {
  const { key = '' } = useParams();
  const { isSuperAdmin } = useAuth();
  const setting = SETTINGS_BY_KEY[key];

  if (!setting) return <Navigate to={ADMIN_ROUTES.settings} replace />;
  if (setting.requireSuperAdmin && !isSuperAdmin) return <Navigate to={ADMIN_ROUTES.settings} replace />;

  const Icon = setting.icon;

  return (
    <AdminLayout>
      <Helmet>
        <title>{setting.title} · Settings | Lumina Auto Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <SettingsPageLayout title={setting.title} description={setting.description} icon={<Icon />}>
        {setting.body}
      </SettingsPageLayout>
    </AdminLayout>
  );
};

export default AdminSettingPage;
