import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/admin/PageHeader';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';

/**
 * How much horizontal room a setting body gets.
 *
 * - `default` — a comfortable reading column for forms and prose-y settings.
 * - `wide`    — for content-heavy settings (grids of cards, tables, multi-column
 *               editors) that were visibly cramped in the reading column.
 *
 * Both are CENTERED: previously the body was `max-w-3xl` with no `mx-auto`, so
 * every settings page hugged the left edge and left half of a wide screen empty.
 */
export type SettingsPageWidth = 'default' | 'wide';

const WIDTH_CLASS: Record<SettingsPageWidth, string> = {
  default: 'mx-auto w-full max-w-4xl',
  wide: 'mx-auto w-full max-w-6xl',
};

interface SettingsPageLayoutProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** Content width for this setting's body. Defaults to `default`. */
  width?: SettingsPageWidth;
  children: React.ReactNode;
}

/**
 * Shared shell for an individual setting's own page.
 *
 * A "Back to Settings" link, then the compact <PageHeader> (icon + title +
 * description), then the setting body in a centered column sized by `width`.
 * Used by every `/admin/settings/<key>` route so they all read and behave the
 * same.
 */
const SettingsPageLayout = ({ title, description, icon, width = 'default', children }: SettingsPageLayoutProps) => (
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
      <div className={WIDTH_CLASS[width]}>{children}</div>
    </div>
  </div>
);

export default SettingsPageLayout;
