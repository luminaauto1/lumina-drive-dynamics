import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Car, Users, CreditCard, TrendingUp, Eye, DollarSign, Clock, Activity, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import AdminLayout from '@/components/admin/AdminLayout';
import { useVehicles, formatPrice } from '@/hooks/useVehicles';
import { useLeads } from '@/hooks/useLeads';
import { useFinanceApplications } from '@/hooks/useFinanceApplications';
import { useAnalyticsSummary } from '@/hooks/useAnalytics';

const AdminDashboard = () => {
  const { data: vehicles = [] } = useVehicles();
  const { data: leads = [] } = useLeads();
  const { data: applications = [] } = useFinanceApplications();
  const { 
    totalPageViews, 
    avgTimeOnSite, 
    mostViewedPath, 
    chartData, 
    enquiryCount,
    isLoading: analyticsLoading 
  } = useAnalyticsSummary(7);

  const totalStockValue = vehicles.reduce((sum, v) => sum + v.price, 0);
  const availableVehicles = vehicles.filter(v => v.status === 'available').length;
  const newLeadsThisMonth = leads.filter(l => {
    const leadDate = new Date(l.created_at);
    const now = new Date();
    return leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
  }).length;
  const pendingApplications = applications.filter(a => a.status === 'pending').length;

  // Extract vehicle ID from path and find vehicle name
  const getMostViewedVehicle = () => {
    if (!mostViewedPath) return null;
    const vehicleId = mostViewedPath.replace('/vehicle/', '');
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    }
    return null;
  };

  const mostViewedVehicle = getMostViewedVehicle();

  // Format seconds to readable time
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const stats = [
    { 
      label: 'Total Stock Value', 
      value: formatPrice(totalStockValue), 
      icon: DollarSign,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10'
    },
    { 
      label: 'Cars Available', 
      value: availableVehicles.toString(), 
      icon: Car,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10'
    },
    { 
      label: 'New Leads (This Month)', 
      value: newLeadsThisMonth.toString(), 
      icon: Users,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10'
    },
    { 
      label: 'Pending Applications', 
      value: pendingApplications.toString(), 
      icon: CreditCard,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10'
    },
  ];

  return (
    <AdminLayout>
      <Helmet>
        <title>Admin Dashboard | Lumina Auto</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-semibold mb-2">Mission Control</h1>
          <p className="text-muted-foreground">Welcome back. Here's what's happening today.</p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="glass-card rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold mb-1">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Intelligence Report Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Intelligence Report</h2>
            <span className="text-xs text-muted-foreground ml-2">Last 7 days</span>
          </div>

          {/* Intelligence Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Most Viewed Car */}
            <div className="glass-card rounded-xl p-6 border-l-4 border-l-primary">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">Most Viewed Car</span>
              </div>
              {analyticsLoading ? (
                <div className="h-6 bg-muted/50 rounded animate-pulse" />
              ) : mostViewedVehicle ? (
                <p className="text-lg font-semibold">{mostViewedVehicle}</p>
              ) : (
                <p className="text-muted-foreground text-sm">No vehicle views yet</p>
              )}
            </div>

            {/* Avg Time on Site */}
            <div className="glass-card rounded-xl p-6 border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-muted-foreground">Avg Time on Site</span>
              </div>
              {analyticsLoading ? (
                <div className="h-6 bg-muted/50 rounded animate-pulse" />
              ) : (
                <p className="text-lg font-semibold">{formatTime(avgTimeOnSite)}</p>
              )}
            </div>

            {/* Total Page Views */}
            <div className="glass-card rounded-xl p-6 border-l-4 border-l-purple-500">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Total Page Views</span>
              </div>
              {analyticsLoading ? (
                <div className="h-6 bg-muted/50 rounded animate-pulse" />
              ) : (
                <p className="text-lg font-semibold">{totalPageViews.toLocaleString()}</p>
              )}
            </div>
          </div>

          {/* Enquiries vs Views Chart */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Views vs Enquiries</h3>
            </div>
            <div className="h-64">
              {analyticsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="views" name="Page Views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="enquiries" name="Enquiries" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </motion.div>

        {/* Existing Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leads Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Leads This Week</h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="views" name="Views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card rounded-xl p-6"
          >
            <h2 className="text-lg font-semibold mb-4">Recent Leads</h2>
            {leads.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No leads yet</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {leads.slice(0, 5).map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{lead.client_name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">
                        {lead.source} • {lead.vehicle ? `${lead.vehicle.year} ${lead.vehicle.make} ${lead.vehicle.model}` : 'No vehicle'}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      lead.status === 'new' ? 'bg-blue-500/20 text-blue-400' :
                      lead.status === 'contacted' ? 'bg-amber-500/20 text-amber-400' :
                      lead.status === 'sold' ? 'bg-emerald-500/20 text-emerald-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {lead.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
