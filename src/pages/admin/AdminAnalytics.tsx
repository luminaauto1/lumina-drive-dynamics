import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { 
  BarChart3, Eye, Clock, TrendingUp, Activity, Zap, 
  ArrowUpRight, ArrowDownRight, Users, Car
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, PieChart, Pie, Cell 
} from 'recharts';
import AdminLayout from '@/components/admin/AdminLayout';
import { useVehicles } from '@/hooks/useVehicles';
import { useAnalyticsSummary, useAnalyticsData } from '@/hooks/useAnalytics';

const AdminAnalytics = () => {
  const { data: vehicles = [] } = useVehicles();
  const { 
    totalPageViews, 
    avgTimeOnSite, 
    mostViewedPath, 
    chartData, 
    enquiryCount,
    isLoading 
  } = useAnalyticsSummary(7);

  const { data: rawEvents = [] } = useAnalyticsData(7);

  // Calculate additional metrics
  const uniqueSessions = new Set(rawEvents.map((e: any) => e.session_id)).size;
  const bounceRate = totalPageViews > 0 
    ? Math.round((1 - (uniqueSessions / totalPageViews)) * 100) 
    : 0;
  const conversionRate = totalPageViews > 0 
    ? ((enquiryCount / totalPageViews) * 100).toFixed(1) 
    : '0';

  // Get most viewed vehicle
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

  // Format time
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Traffic source breakdown (mock for now)
  const trafficSources = [
    { name: 'Direct', value: 45, color: 'hsl(var(--primary))' },
    { name: 'Organic', value: 30, color: '#10b981' },
    { name: 'Social', value: 15, color: '#8b5cf6' },
    { name: 'Referral', value: 10, color: '#f59e0b' },
  ];

  // Top pages
  const pageViewsByPath = rawEvents
    .filter((e: any) => e.event_type === 'page_view')
    .reduce((acc: Record<string, number>, e: any) => {
      const path = e.page_path || '/';
      acc[path] = (acc[path] || 0) + 1;
      return acc;
    }, {});

  const topPages = Object.entries(pageViewsByPath)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([path, views]) => ({ path, views }));

  return (
    <AdminLayout>
      <Helmet>
        <title>Analytics | Lumina Auto Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-semibold">AI Analytics</h1>
          </div>
          <p className="text-muted-foreground">Deep insights into user behavior and performance</p>
        </motion.div>

        {/* AI Insights Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <div className="glass-card rounded-xl p-6 border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">System Report</h2>
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">AI Generated</span>
            </div>
            
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-muted/50 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-muted/50 rounded animate-pulse w-1/2" />
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                {mostViewedVehicle && (
                  <p className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Most popular vehicle this week:</strong> {mostViewedVehicle}. 
                      Consider featuring this prominently on the homepage.
                    </span>
                  </p>
                )}
                <p className="flex items-start gap-2">
                  <Eye className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>{totalPageViews} page views</strong> recorded with an average session time of {formatTime(avgTimeOnSite)}.
                    {avgTimeOnSite > 120 
                      ? ' Users are highly engaged with your content.' 
                      : ' Consider adding more engaging content to increase time on site.'}
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>{enquiryCount} enquiries</strong> generated at a {conversionRate}% conversion rate.
                    {parseFloat(conversionRate) > 2 
                      ? ' Above industry average - excellent performance!' 
                      : ' Consider adding stronger CTAs to improve conversions.'}
                  </span>
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Key Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Eye className="w-6 h-6 text-blue-400" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold mb-1">
              {isLoading ? '...' : totalPageViews.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Page Views</p>
          </div>

          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <Clock className="w-6 h-6 text-emerald-400" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold mb-1">
              {isLoading ? '...' : formatTime(avgTimeOnSite)}
            </p>
            <p className="text-sm text-muted-foreground">Avg Time on Site</p>
          </div>

          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <TrendingUp className="w-6 h-6 text-amber-400" />
              </div>
              <ArrowDownRight className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-2xl font-bold mb-1">
              {isLoading ? '...' : `${bounceRate}%`}
            </p>
            <p className="text-sm text-muted-foreground">Bounce Rate</p>
          </div>

          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <BarChart3 className="w-6 h-6 text-purple-400" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold mb-1">
              {isLoading ? '...' : `${conversionRate}%`}
            </p>
            <p className="text-sm text-muted-foreground">Conversion Rate</p>
          </div>
        </motion.div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Views vs Enquiries Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Views vs Enquiries</h3>
            </div>
            <div className="h-64">
              {isLoading ? (
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
          </motion.div>

          {/* Traffic Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Traffic Trend</h3>
            </div>
            <div className="h-64">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
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
                    <Line 
                      type="monotone" 
                      dataKey="views" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Pages */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-card rounded-xl p-6 lg:col-span-2"
          >
            <h3 className="text-lg font-semibold mb-4">Top Pages</h3>
            {topPages.length === 0 ? (
              <p className="text-muted-foreground text-sm">No page views recorded yet</p>
            ) : (
              <div className="space-y-3">
                {topPages.map((page, index) => (
                  <div key={page.path} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-6">{index + 1}</span>
                      <span className="text-sm font-medium truncate max-w-xs">{page.path}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{page.views as number} views</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Traffic Sources */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card rounded-xl p-6"
          >
            <h3 className="text-lg font-semibold mb-4">Traffic Sources</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={trafficSources}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {trafficSources.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {trafficSources.map((source) => (
                <div key={source.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }} />
                    <span>{source.name}</span>
                  </div>
                  <span className="text-muted-foreground">{source.value}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
