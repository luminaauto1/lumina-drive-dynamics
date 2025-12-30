import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Car, Users, CreditCard, TrendingUp, Eye, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AdminLayout from '@/components/admin/AdminLayout';
import { useVehicles, formatPrice } from '@/hooks/useVehicles';
import { useLeads } from '@/hooks/useLeads';
import { useFinanceApplications } from '@/hooks/useFinanceApplications';

// Mock data for charts - can be replaced with real analytics later
const viewsData = [
  { day: 'Mon', views: 45 },
  { day: 'Tue', views: 52 },
  { day: 'Wed', views: 38 },
  { day: 'Thu', views: 67 },
  { day: 'Fri', views: 89 },
  { day: 'Sat', views: 124 },
  { day: 'Sun', views: 98 },
];

const leadsData = [
  { day: 'Mon', leads: 3 },
  { day: 'Tue', leads: 5 },
  { day: 'Wed', leads: 2 },
  { day: 'Thu', leads: 8 },
  { day: 'Fri', leads: 6 },
  { day: 'Sat', leads: 12 },
  { day: 'Sun', leads: 9 },
];

const AdminDashboard = () => {
  const { data: vehicles = [] } = useVehicles();
  const { data: leads = [] } = useLeads();
  const { data: applications = [] } = useFinanceApplications();

  const totalStockValue = vehicles.reduce((sum, v) => sum + v.price, 0);
  const availableVehicles = vehicles.filter(v => v.status === 'available').length;
  const newLeadsThisMonth = leads.filter(l => {
    const leadDate = new Date(l.created_at);
    const now = new Date();
    return leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
  }).length;
  const pendingApplications = applications.filter(a => a.status === 'pending').length;

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
          {stats.map((stat, index) => (
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

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Views Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Eye className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Views Per Day</h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={viewsData}>
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
                  <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Leads Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Leads Per Day</h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadsData}>
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
                  <Bar dataKey="leads" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 glass-card rounded-xl p-6"
        >
          <h2 className="text-lg font-semibold mb-4">Recent Leads</h2>
          {leads.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No leads yet</p>
          ) : (
            <div className="space-y-3">
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
    </AdminLayout>
  );
};

export default AdminDashboard;