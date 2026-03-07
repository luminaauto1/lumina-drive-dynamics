import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { 
  TrendingUp, DollarSign, Car, Clock, AlertTriangle, Percent, 
  PieChart, BarChart3, Calendar, Filter, Briefcase, Printer
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
  referral_income_amount: number | null;
  addons_data: any[] | null;
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
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
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
            <TabsTrigger value="investor" className="gap-2">
              <Briefcase className="w-4 h-4" />
              Investor Report
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

          {/* Tab 4: Investor Report */}
          <TabsContent value="investor" className="space-y-6">
            <InvestorReport deals={dealRecords} dateRange={dateRange} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

/* ─── INVESTOR REPORT: CAPITAL BACKING PROPOSAL ─── */
const InvestorReport = ({ deals, dateRange }: { deals: DealRecord[]; dateRange: { from: Date; to: Date } }) => {
  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      const saleDate = d.sale_date ? new Date(d.sale_date) : new Date(d.created_at);
      return isWithinInterval(saleDate, { start: dateRange.from, end: dateRange.to });
    });
  }, [deals, dateRange]);

  const metrics = useMemo(() => {
    let turnover = 0;
    let totalVehicleMargin = 0;
    let totalNetProfit = 0;

    filteredDeals.forEach(deal => {
      const soldPrice = Number(deal.sold_price || 0);
      const costPrice = Number(deal.cost_price || 0);
      const reconCost = Number(deal.recon_cost || 0);
      const margin = soldPrice - costPrice - reconCost;

      const dicAmount = Number(deal.dic_amount || 0);
      const referralIncome = Number(deal.referral_income_amount || 0);
      const addons = Array.isArray(deal.addons_data) ? (deal.addons_data as any[]) : [];
      const vapProfit = addons.reduce((s: number, a: any) => s + ((Number(a.price) || 0) - (Number(a.cost) || 0)), 0);

      turnover += soldPrice;
      totalVehicleMargin += margin;
      totalNetProfit += (margin + dicAmount + referralIncome + vapProfit);
    });

    return {
      turnover,
      netProfit: totalNetProfit,
      vehicleMargin: totalVehicleMargin,
      units: filteredDeals.length,
      avgMarginPerUnit: filteredDeals.length > 0 ? totalVehicleMargin / filteredDeals.length : 0,
    };
  }, [filteredDeals]);

  const fmt = (val: number) => `R ${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const tiers = [
    { range: 'Less than R 10,000', payout: 'R 2,000' },
    { range: 'R 10,000 – R 20,000', payout: 'R 3,000' },
    { range: 'R 20,000 – R 30,000', payout: 'R 4,000' },
    { range: 'R 30,000 – R 40,000', payout: 'R 5,000' },
    { range: 'R 40,000 – R 50,000', payout: 'R 7,000' },
    { range: 'Over R 50,000', payout: 'R 8,000' },
  ];

  const dateRangeString = `01 Jan ${new Date().getFullYear()} — ${format(new Date(), 'dd MMM yyyy')}`;

  return (
    <div className="space-y-6">
      {/* Print Button */}
      <div className="flex justify-end print:hidden">
        <Button variant="outline" onClick={() => window.print()} className="gap-2">
          <Printer className="w-4 h-4" />
          Print / Save PDF
        </Button>
      </div>

      {/* Report Container */}
      <div className="bg-card border border-border rounded-xl p-8 print:p-0 print:border-0 space-y-10">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-border pb-6">
          <div>
            <h2 className="text-3xl font-bold">Lumina Auto</h2>
            <p className="text-muted-foreground mt-1">Capital Backing Proposal</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Pretoria, South Africa</p>
            <p>Report Period: {dateRangeString}</p>
          </div>
        </div>

        {/* 1. The Opportunity */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            1. The Opportunity
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            Lumina Auto specializes in the rapid sourcing, reconditioning, and retailing of premium pre-owned vehicles.
            We are expanding our purchasing capacity and offering a secure, per-vehicle capital backing partnership.
            Capital is deployed directly into physical, highly liquid automotive assets. Once the specific asset is sold,
            the initial capital is returned immediately alongside a fixed, performance-based return.
          </p>
        </div>

        {/* 2. Proof of Performance */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            2. Year-to-Date Performance
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Trading Turnover</p>
              <p className="text-xl font-bold text-emerald-400">{fmt(metrics.ytdTurnover)}</p>
            </Card>
            <Card className="p-4 text-center space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Net Profit</p>
              <p className="text-xl font-bold text-amber-400">{fmt(metrics.ytdNetProfit)}</p>
            </Card>
            <Card className="p-4 text-center space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Units Delivered</p>
              <p className="text-xl font-bold text-blue-400">{metrics.ytdUnits}</p>
            </Card>
            <Card className="p-4 text-center space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Margin / Unit</p>
              <p className="text-xl font-bold text-purple-400">{fmt(metrics.avgMarginPerUnit)}</p>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground italic">
            * Vehicle Margin represents the gross profit on the physical asset (Sold Price − Cost − Reconditioning) prior to external dealer commissions (DIC) and VAP kickbacks.
          </p>
        </div>

        {/* 3. Proposed Return Structure */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            3. Proposed Capital Return Structure
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            Returns are calculated per vehicle and paid out immediately upon delivery and final settlement of the asset.
            The payout is determined by the total net profit generated by the specific vehicle funded by the capital partner.
          </p>
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Vehicle Net Profit Tier</TableHead>
                  <TableHead className="font-semibold text-right">Fixed Partner Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map((tier, i) => (
                  <TableRow key={i}>
                    <TableCell>{tier.range}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-400">{tier.payout}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Lumina Auto (Pty) Ltd • Partnership Proposal • Confidential
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminReports;
