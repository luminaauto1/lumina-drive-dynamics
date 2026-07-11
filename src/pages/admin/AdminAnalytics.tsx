import AdminLayout from "@/components/admin/AdminLayout";
import { Helmet } from "react-helmet-async";
import { useDashboardLayout } from "@/components/admin/dashboard/useDashboardLayout";
import { DashboardGrid } from "@/components/admin/dashboard/DashboardGrid";
import { CustomizePanel } from "@/components/admin/dashboard/CustomizePanel";
import { DashboardProvider } from "@/components/admin/dashboard/widgets/DashboardContext";

const AdminAnalytics = () => {
  const api = useDashboardLayout();

  return (
    <AdminLayout>
      <Helmet>
        <title>Analytics | Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardProvider>
        <div className="p-6">
          {/* Header row: title + top-right Customize control */}
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">Analytics</h1>
            <CustomizePanel api={api} />
          </div>

          <DashboardGrid
            layout={api.layout}
            visibleIds={api.visibleIds}
            editMode={api.editMode}
            onLayoutChange={api.setLayout}
          />
        </div>
      </DashboardProvider>
    </AdminLayout>
  );
};

export default AdminAnalytics;
