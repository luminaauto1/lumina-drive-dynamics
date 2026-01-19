import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Car, Users, CreditCard, DollarSign, TrendingUp, ArrowRight, Plus, FileText, BarChart3, Target, Wrench, PieChart, Calculator } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useVehicles, formatPrice } from '@/hooks/useVehicles';
import { useLeads } from '@/hooks/useLeads';
import { useFinanceApplications } from '@/hooks/useFinanceApplications';
import { useReconLiability } from '@/hooks/useInventoryTasks';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const AdminDashboard = () => {
  const { data: vehicles = [] } = useVehicles();
  const { data: leads = [] } = useLeads();
  const { data: applications = [] } = useFinanceApplications();
  const { data: reconLiability = 0 } = useReconLiability();
  const { data: siteSettings } = useSiteSettings();
  
  const monthlySalesTarget = siteSettings?.monthly_sales_target || 10;

  // Fetch deal records for profit calculations
  const { data: dealRecords = [] } = useQuery({
    queryKey: ['deal-records-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_records')
        .select('*, vehicles(price, purchase_price, reconditioning_cost, status)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Get current month's deals
  const currentMonthDeals = dealRecords.filter((deal: any) => {
    const dealDate = new Date(deal.created_at);
    const now = new Date();
    return dealDate.getMonth() === now.getMonth() && dealDate.getFullYear() === now.getFullYear();
  });

  // Calculate financial metrics
  const totalGrossProfit = dealRecords.reduce((sum: number, deal: any) => {
    const soldPrice = deal.sold_price || 0;
    const purchasePrice = deal.vehicles?.purchase_price || 0;
    return sum + (soldPrice - purchasePrice);
  }, 0);

  const totalCommissions = dealRecords.reduce((sum: number, deal: any) => {
    return sum + (deal.sales_rep_commission || 0);
  }, 0);

  const totalReconCosts = dealRecords.reduce((sum: number, deal: any) => {
    return sum + (deal.vehicles?.reconditioning_cost || 0);
  }, 0);

  const totalAftersalesExpenses = dealRecords.reduce((sum: number, deal: any) => {
    const expenses = deal.aftersales_expenses || [];
    return sum + expenses.reduce((expSum: number, exp: any) => expSum + (exp.amount || 0), 0);
  }, 0);

  const netProfit = totalGrossProfit - totalCommissions - totalReconCosts - totalAftersalesExpenses;
  const avgGrossPerUnit = dealRecords.length > 0 ? totalGrossProfit / dealRecords.length : 0;
  const unitsSoldThisMonth = currentMonthDeals.length;
  const salesProgress = (unitsSoldThisMonth / monthlySalesTarget) * 100;

  // SEGREGATED ANALYTICS: Exclude 'sourcing' and 'hidden' from stock calculations
  const realStockStatuses = ['available', 'reserved', 'incoming'];
  const realStockVehicles = vehicles.filter(v => realStockStatuses.includes(v.status));
  
  const totalStockValue = realStockVehicles
    .filter(v => v.status === 'available' || v.status === 'reserved')
    .reduce((sum, v) => sum + v.price, 0);
  const availableVehicles = realStockVehicles.length;
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

        {/* Financial Vault Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
        >
          {/* The Financial Vault */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <PieChart className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Financial Vault</h2>
                <p className="text-sm text-muted-foreground">Profit breakdown</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-emerald-500/10 rounded-lg">
                <span className="text-sm">Gross Profit</span>
                <span className="font-bold text-emerald-400">{formatPrice(totalGrossProfit)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-lg">
                <span className="text-sm">Less: Commissions</span>
                <span className="font-medium text-red-400">-{formatPrice(totalCommissions)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-lg">
                <span className="text-sm">Less: Recon Costs</span>
                <span className="font-medium text-red-400">-{formatPrice(totalReconCosts)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-lg">
                <span className="text-sm">Less: Aftersales Expenses</span>
                <span className="font-medium text-red-400">-{formatPrice(totalAftersalesExpenses)}</span>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Net Profit</span>
                  <span className={`text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatPrice(netProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* GPU Tracker & Velocity */}
          <div className="space-y-6">
            {/* GPU Tracker */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg bg-purple-500/10">
                  <Calculator className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">GPU Tracker</h2>
                  <p className="text-sm text-muted-foreground">Avg Gross Profit per Unit</p>
                </div>
              </div>
              <div className="text-3xl font-bold text-purple-400">
                {formatPrice(avgGrossPerUnit)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Based on {dealRecords.length} finalized deals
              </p>
            </div>

            {/* Inventory Velocity */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Target className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Inventory Velocity</h2>
                  <p className="text-sm text-muted-foreground">Monthly target progress</p>
                </div>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-3xl font-bold text-blue-400">{unitsSoldThisMonth}</span>
                <span className="text-muted-foreground mb-1">/ {monthlySalesTarget} units</span>
              </div>
              <Progress value={Math.min(salesProgress, 100)} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">
                {salesProgress >= 100 ? '🎉 Target achieved!' : `${Math.round(salesProgress)}% to target`}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Recon Liability Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="glass-card rounded-xl p-6 mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <Wrench className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Capital in Recon</h2>
                <p className="text-sm text-muted-foreground">Pending recon tasks for unsold vehicles</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-400">
              {formatPrice(reconLiability)}
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
