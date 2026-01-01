import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Car, Users, CreditCard, DollarSign, TrendingUp, ArrowRight, Plus, FileText, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { useVehicles, formatPrice } from '@/hooks/useVehicles';
import { useLeads } from '@/hooks/useLeads';
import { useFinanceApplications } from '@/hooks/useFinanceApplications';

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
  const pendingValidations = applications.filter(a => a.status === 'validations_pending').length;

  const pulseCards = [
    { 
      label: 'Active Leads', 
      value: newLeadsThisMonth.toString(), 
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      link: '/admin/leads'
    },
    { 
      label: 'Pending Validations', 
      value: pendingValidations.toString(), 
      icon: FileText,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      link: '/admin/finance'
    },
    { 
      label: 'Total Stock', 
      value: availableVehicles.toString(), 
      icon: Car,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      link: '/admin/inventory'
    },
    { 
      label: 'Stock Value', 
      value: formatPrice(totalStockValue), 
      icon: DollarSign,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      link: '/admin/inventory'
    },
  ];

  const quickActions = [
    { label: 'Add Vehicle', icon: Plus, link: '/admin/inventory', variant: 'default' as const },
    { label: 'View Analytics', icon: BarChart3, link: '/admin/analytics', variant: 'outline' as const },
    { label: 'Finance Apps', icon: CreditCard, link: '/admin/finance', variant: 'outline' as const },
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

        {/* Pulse Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {pulseCards.map((card) => (
            <Link
              key={card.label}
              to={card.link}
              className="glass-card rounded-xl p-6 hover:border-primary/50 transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${card.bg}`}>
                  <card.icon className={`w-6 h-6 ${card.color}`} />
                </div>
                <TrendingUp className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-bold mb-1">{card.value}</p>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          ))}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl p-6 mb-8"
        >
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action) => (
              <Button 
                key={action.label} 
                variant={action.variant} 
                asChild
              >
                <Link to={action.link}>
                  <action.icon className="w-4 h-4 mr-2" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Leads</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/leads">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
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
