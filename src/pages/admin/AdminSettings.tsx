import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { ChevronRight } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import PageHeader from '@/components/admin/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { SETTINGS_GROUPS } from '@/components/admin/settings/settingsRegistry';

/**
 * Settings hub — now an INDEX page.
 *
 * Each setting used to render as an in-page tab panel; the owner wanted every
 * setting to get its own page. This is the grouped directory: every item links
 * to `/admin/settings/<key>` (rendered by `AdminSettingPage`). Grouping/labels
 * and super-admin gating come from `settingsRegistry` so the index and the
 * routes never drift apart.
 */
const AdminSettings = () => {
  const { isSuperAdmin } = useAuth();

  const groups = SETTINGS_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((s) => !s.requireSuperAdmin || isSuperAdmin),
  })).filter((g) => g.items.length > 0);

  return (
    <AdminLayout>
      <Helmet>
        <title>Settings | Lumina Auto Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <PageHeader title="Settings" subtitle="Configure your dealership — pick a setting to open its page" />

      <div className="p-4 sm:p-6">
        <div className="max-w-3xl space-y-8">
          {groups.map((group) => (
            <section key={group.label} className="space-y-2">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.label}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.key}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Link
                        to={`/admin/settings/${item.key}`}
                        className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-border hover:bg-card/70"
                      >
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-medium leading-tight">{item.title}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
