import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { 
  TrendingUp, DollarSign, Car, Clock, AlertTriangle, Percent, 
  PieChart, BarChart3, Calendar, Filter
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, differenceInDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell } from 'recharts';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/hooks/useVehicles';
import { cn } from '@/lib/utils';

interface DealRecord {
  id: string;
  sale_date: string | null;
  created_at: string;
  sold_price: number | null;
  cost_price: number | null;
  gross_profit: number | null;
  recon_cost: number | null;
  discount_amount: number | null;
  dic_amount: number | null;
  sales_rep_commission: number | null;
  referral_commission_amount: number | null;
  aftersales_expenses: Array<{ type: string; amount: number }> | null;
  vehicle?: {
    id: string;
    make: string;
    model: string;
    year: number;
    created_at: string;
    status: string;
  };
  application?: {
    buyer_type: string | null;
  };
}

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  status: string;
  created_at: string;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

const useDealRecordsForReports = () => {
  return useQuery({
    queryKey: ['deal-records-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_records')
        .select(`
          *,
          vehicle:vehicles(id, make, model, year, created_at, status),
          application:finance_applications(buyer_type)
        `)
        .order('sale_date', { ascending: false });

      if (error) throw error;
      return (data || []).map(record => ({
        ...record,
        aftersales_expenses: Array.isArray(record.aftersales_expenses) 
          ? record.aftersales_expenses as unknown as Array<{ type: string; amount: number }>
          : [],
      })) as DealRecord[];
    },
  });
};

const useVehiclesForReports = () => {
  return useQuery({
    queryKey: ['vehicles-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, make, model, year, price, status, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Vehicle[];
    },
  });
};

const AdminReports = () => {
  const { data: dealRecords = [], isLoading: dealsLoading } = useDealRecordsForReports();
  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehiclesForReports();
  
  // Date range state - default last 30 days
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Filter deals by date range
  const filteredDeals = useMemo(() => {
    return dealRecords.filter(deal => {
      const saleDate = deal.sale_date ? new Date(deal.sale_date) : new Date(deal.created_at);
      return isWithinInterval(saleDate, { start: dateRange.from, end: dateRange.to });
    });
  }, [dealRecords, dateRange]);

  // === FINANCIAL HEALTH METRICS ===
  const financialMetrics = useMemo(() => {
    const netProfit = filteredDeals.reduce((sum, d) => sum + (d.gross_profit || 0), 0);
    const grossRevenue = filteredDeals.reduce((sum, d) => sum + (d.sold_price || 0), 0);
    const totalCosts = filteredDeals.reduce((sum, d) => sum + (d.cost_price || 0) + (d.recon_cost || 0), 0);
    const totalExpenses = filteredDeals.reduce((sum, d) => {
      const aftersales = (d.aftersales_expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
      return sum + aftersales;
    }, 0);
    const commissionPayouts = filteredDeals.reduce((sum, d) => 
      sum + (d.sales_rep_commission || 0) + (d.referral_commission_amount || 0), 0);

    return { netProfit, grossRevenue, totalCosts, totalExpenses, commissionPayouts };
  }, [filteredDeals]);

  // Chart data: Profit vs Expenses by week/day
  const profitExpenseChartData = useMemo(() => {
    const groupedData: Record<string, { date: string; profit: number; expenses: number }> = {};
    
    filteredDeals.forEach(deal => {
      const saleDate = deal.sale_date ? new Date(deal.sale_date) : new Date(deal.created_at);
      const dateKey = format(saleDate, 'dd MMM');
      
      if (!groupedData[dateKey]) {
        groupedData[dateKey] = { date: dateKey, profit: 0, expenses: 0 };
      }
      
      groupedData[dateKey].profit += deal.gross_profit || 0;
      const aftersales = (deal.aftersales_expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
      groupedData[dateKey].expenses += (deal.recon_cost || 0) + aftersales;
    });

    return Object.values(groupedData).slice(-14); // Last 14 data points
  }, [filteredDeals]);

  // === INVENTORY VELOCITY METRICS ===
  const inventoryMetrics = useMemo(() => {
    // Average days to sell
    const soldVehiclesWithDays = filteredDeals
      .filter(d => d.vehicle?.created_at && d.sale_date)
      .map(d => {
        const stockedDate = new Date(d.vehicle!.created_at);
        const saleDate = new Date(d.sale_date!);
        return differenceInDays(saleDate, stockedDate);
      })
      .filter(days => days >= 0);

    const avgDaysToSell = soldVehiclesWithDays.length > 0 
      ? Math.round(soldVehiclesWithDays.reduce((a, b) => a + b, 0) / soldVehiclesWithDays.length)
      : 0;

    // Stock turn rate (units sold / average stock)
    const currentStock = vehicles.filter(v => ['available', 'reserved', 'incoming'].includes(v.status)).length;
    const unitsSold = filteredDeals.length;
    const stockTurnRate = currentStock > 0 ? (unitsSold / currentStock).toFixed(2) : '0';

    // Aged stock (> 60 days)
    const agedStock = vehicles.filter(v => {
      if (!['available', 'reserved'].includes(v.status)) return false;
      const daysInStock = differenceInDays(new Date(), new Date(v.created_at));
      return daysInStock > 60;
    });

    return { avgDaysToSell, stockTurnRate, unitsSold, currentStock, agedStock };
  }, [filteredDeals, vehicles]);

  // === DEAL INSIGHTS METRICS ===
  const dealInsights = useMemo(() => {
    // Finance penetration
    const financeDeals = filteredDeals.filter(d => d.application?.buyer_type === 'finance').length;
    const cashDeals = filteredDeals.filter(d => d.application?.buyer_type === 'cash').length;
    const totalWithType = financeDeals + cashDeals;
    const financePenetration = totalWithType > 0 ? ((financeDeals / totalWithType) * 100).toFixed(1) : '0';

    // Average discount given
    const dealsWithDiscount = filteredDeals.filter(d => d.discount_amount && d.discount_amount > 0);
    const avgDiscount = dealsWithDiscount.length > 0 
      ? Math.round(dealsWithDiscount.reduce((sum, d) => sum + (d.discount_amount || 0), 0) / dealsWithDiscount.length)
      : 0;

    // Deals by brand
    const brandCounts: Record<string, number> = {};
    filteredDeals.forEach(deal => {
      const make = deal.vehicle?.make || 'Unknown';
      brandCounts[make] = (brandCounts[make] || 0) + 1;
    });

    const brandChartData = Object.entries(brandCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));

    return { financePenetration, financeDeals, cashDeals, avgDiscount, brandChartData };
  }, [filteredDeals]);

  const isLoading = dealsLoading || vehiclesLoading;

  return (
    <AdminLayout>
      <Helmet>
        <title>Reports Hub | Lumina Auto Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-semibold mb-2">Reports Hub</h1>
            <p className="text-muted-foreground">Business intelligence and performance analytics</p>
          </div>
          
          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Calendar className="w-4 h-4" />
                  {format(dateRange.from, 'dd MMM')} - {format(dateRange.to, 'dd MMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setDateRange({ from: range.from, to: range.to });
                    }
                  }}
                  numberOfMonths={2}
                  className={cn("p-3 pointer-events-auto")}
                />
                <div className="p-2 border-t flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
                  >
                    Last 7 days
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
                  >
                    Last 30 days
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}
                  >
                    This Month
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="financial" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Financial Health
            </TabsTrigger>
            <TabsTrigger value="velocity" className="gap-2">
              <Clock className="w-4 h-4" />
              Inventory Velocity
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2">
              <PieChart className="w-4 h-4" />
              Deal Insights
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Financial Health */}
          <TabsContent value="financial" className="space-y-6">
            {/* Big Numbers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Net Profit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${financialMetrics.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatPrice(financialMetrics.netProfit)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-blue-400" />
                    Gross Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-400">{formatPrice(financialMetrics.grossRevenue)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-orange-400" />
                    Total Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-orange-400">{formatPrice(financialMetrics.totalExpenses)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-purple-400" />
                    Commission Payouts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-purple-400">{formatPrice(financialMetrics.commissionPayouts)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Profit vs Expenses Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Profit vs Expenses</CardTitle>
                <CardDescription>Daily breakdown over the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profitExpenseChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => formatPrice(value)}
                      />
                      <Legend />
                      <Bar dataKey="profit" name="Profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Inventory Velocity */}
          <TabsContent value="velocity" className="space-y-6">
            {/* Velocity Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    Avg Days to Sell
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{inventoryMetrics.avgDaysToSell} <span className="text-sm text-muted-foreground">days</span></p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Stock Turn Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{inventoryMetrics.stockTurnRate}x</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {inventoryMetrics.unitsSold} sold / {inventoryMetrics.currentStock} in stock
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Car className="w-4 h-4 text-purple-400" />
                    Units Sold
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-purple-400">{inventoryMetrics.unitsSold}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Aged Stock ({">"}60 days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-amber-400">{inventoryMetrics.agedStock.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Aged Stock Alert Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  Aged Stock Alert
                </CardTitle>
                <CardDescription>Vehicles in stock for more than 60 days</CardDescription>
              </CardHeader>
              <CardContent>
                {inventoryMetrics.agedStock.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Car className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No aged stock! All inventory is moving well.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Days in Stock</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryMetrics.agedStock.map((vehicle) => {
                        const daysInStock = differenceInDays(new Date(), new Date(vehicle.created_at));
                        return (
                          <TableRow key={vehicle.id}>
                            <TableCell className="font-medium">
                              {vehicle.year} {vehicle.make} {vehicle.model}
                            </TableCell>
                            <TableCell>{formatPrice(vehicle.price)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-amber-500 text-amber-500">
                                {daysInStock} days
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{vehicle.status}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Deal Insights */}
          <TabsContent value="insights" className="space-y-6">
            {/* Deal Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Percent className="w-4 h-4 text-blue-400" />
                    Finance Penetration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-400">{dealInsights.financePenetration}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dealInsights.financeDeals} finance / {dealInsights.cashDeals} cash
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-orange-400" />
                    Avg Discount Given
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-orange-400">{formatPrice(dealInsights.avgDiscount)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Margin leakage per deal</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Car className="w-4 h-4 text-emerald-400" />
                    Total Deals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-emerald-400">{filteredDeals.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Deals by Brand Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Deals by Brand</CardTitle>
                <CardDescription>Distribution of sales across vehicle makes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {dealInsights.brandChartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No deal data for the selected period
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={dealInsights.brandChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {dealInsights.brandChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </RechartsPie>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminReports;
