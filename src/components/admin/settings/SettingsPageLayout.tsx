import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/admin/PageHeader';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';

interface SettingsPageLayoutProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared shell for an individual setting's own page.
 *
 * A "Back to Settings" link, then the compact <PageHeader> (icon + title +
 * description), then the setting body in a constrained column. Used by every
 * `/admin/settings/<key>` route so they all read and behave the same.
 */
const SettingsPageLayout = ({ title, description, icon, children }: SettingsPageLayoutProps) => (
  <div className="flex flex-col">
    <PageHeader
      icon={icon}
      title={title}
      subtitle={description}
      actions={
        <Link
          to={ADMIN_ROUTES.settings}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
      }
    />
    <div className="p-4 sm:p-6">
      <div className="max-w-3xl">{children}</div>
    </div>
  </div>
);

export default SettingsPageLayout;
