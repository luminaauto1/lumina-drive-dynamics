import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Car, Users, CreditCard, DollarSign, TrendingUp, ArrowRight, Plus, FileText, BarChart3, Wrench, Target, Gauge, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useVehicles, formatPrice } from '@/hooks/useVehicles';
import { useLeads } from '@/hooks/useLeads';
import { useFinanceApplications } from '@/hooks/useFinanceApplications';
import { useDealRecords } from '@/hooks/useDealRecords';
import { useAllInventoryTasks } from '@/hooks/useInventoryTasks';

const MONTHLY_TARGET = 15; // Hardcoded monthly target

const AdminDashboard = () => {
  const { data: vehicles = [] } = useVehicles();
  const { data: leads = [] } = useLeads();
  const { data: applications = [] } = useFinanceApplications();
  const { data: dealRecords = [] } = useDealRecords();
  const { data: inventoryTasks = [] } = useAllInventoryTasks();

  const totalStockValue = vehicles.reduce((sum, v) => sum + v.price, 0);
  const availableVehicles = vehicles.filter(v => v.status === 'available').length;
  const newLeadsThisMonth = leads.filter(l => {
    const leadDate = new Date(l.created_at);
    const now = new Date();
    return leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
  }).length;
  const pendingValidations = applications.filter(a => a.status === 'validations_pending').length;

  // Financial Vault Calculations
  const now = new Date();
  const thisMonthDeals = dealRecords.filter(deal => {
    const dealDate = new Date(deal.created_at);
    return dealDate.getMonth() === now.getMonth() && dealDate.getFullYear() === now.getFullYear();
  });

  // Gross Profit = Sold Price - (Purchase Price + Reconditioning)
  const grossProfit = dealRecords.reduce((sum, deal) => {
    const soldPrice = deal.sold_price || 0;
    const purchasePrice = (deal.vehicle as any)?.purchase_price || 0;
    const reconditioningCost = (deal.vehicle as any)?.reconditioning_cost || 0;
    return sum + (soldPrice - purchasePrice - reconditioningCost);
  }, 0);

  // Net Profit = Gross - Expenses - Commissions
  const totalExpenses = dealRecords.reduce((sum, deal) => {
    const expenses = (deal.aftersales_expenses || []).reduce((e: number, exp: any) => e + (exp.amount || 0), 0);
    return sum + expenses;
  }, 0);

  const totalCommissions = dealRecords.reduce((sum, deal) => sum + (deal.sales_rep_commission || 0), 0);
  const netProfit = grossProfit - totalExpenses - totalCommissions;

  // GPU = Gross Profit / Units Sold
  const unitsSold = dealRecords.length;
  const gpu = unitsSold > 0 ? grossProfit / unitsSold : 0;

  // Inventory Velocity = Units sold this month
  const unitsSoldThisMonth = thisMonthDeals.length;
  const velocityProgress = Math.min((unitsSoldThisMonth / MONTHLY_TARGET) * 100, 100);

  // Recon Liability = Sum of pending/in_progress task costs
  const reconLiability = inventoryTasks
    .filter(t => t.status !== 'completed')
    .reduce((sum, t) => sum + (t.cost || 0), 0);

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

        {/* Financial Vault Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Financial Vault
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Cash Flow Widget */}
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-sm text-muted-foreground">Cash Flow</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Gross Profit</span>
                  <span className={`font-semibold ${grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatPrice(grossProfit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Net Profit</span>
                  <span className={`font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatPrice(netProfit)}
                  </span>
                </div>
              </div>
            </div>

            {/* GPU Widget */}
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Gauge className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">GPU</span>
              </div>
              <p className="text-2xl font-bold text-primary">{formatPrice(gpu)}</p>
              <p className="text-xs text-muted-foreground mt-1">Per unit ({unitsSold} sold)</p>
            </div>

            {/* Inventory Velocity Widget */}
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Target className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-sm text-muted-foreground">Inventory Velocity</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold">{unitsSoldThisMonth}</span>
                <span className="text-muted-foreground">/ {MONTHLY_TARGET}</span>
              </div>
              <Progress value={velocityProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">Units sold this month</p>
            </div>

            {/* Recon Liability Widget */}
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Wrench className="w-5 h-5 text-amber-400" />
                </div>
                <span className="text-sm text-muted-foreground">Capital in Recon</span>
              </div>
              <p className="text-2xl font-bold text-amber-400">{formatPrice(reconLiability)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {inventoryTasks.filter(t => t.status !== 'completed').length} pending tasks
              </p>
            </div>
          </div>
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
