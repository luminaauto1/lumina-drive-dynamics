import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  TrendingUp, Users, FileCheck2, AlertTriangle, Percent,
  Clock, Activity, ShieldAlert, Globe, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import AdminLayout from '@/components/admin/AdminLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

type Range = '1h' | '24h' | '7d' | '30d' | 'all';

const RANGE_LABELS: Record<Range, string> = {
  '1h': 'Last Hour',
  '24h': 'Last 24 Hours',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  all: 'All Time',
};

const STEPS: Record<number, string> = {
  1: 'Personal',
  2: 'Employment',
  3: 'Financials',
  4: 'Vehicle',
  5: 'Review',
};

// Brand-aligned monochrome palette w/ a single accent
const ACCENT = 'hsl(var(--primary))';
const MUTED = 'hsl(var(--muted-foreground))';
const SURFACE = 'hsl(var(--card))';
const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(0 0% 90%)',
  'hsl(0 0% 65%)',
  'hsl(0 0% 45%)',
  'hsl(0 0% 30%)',
  'hsl(0 70% 55%)',
];

const rangeToCutoff = (r: Range): Date | null => {
  if (r === 'all') return null;
  const now = Date.now();
  const ms = r === '1h' ? 3_600_000 : r === '24h' ? 86_400_000 : r === '7d' ? 7 * 86_400_000 : 30 * 86_400_000;
  return new Date(now - ms);
};

interface LeadRow {
  id: string;
  created_at: string;
  updated_at: string;
  last_step_reached: number | null;
  last_step_name: string | null;
  utm_source: string | null;
  source: string | null;
  status: string | null;
}

interface AppRow {
  id: string;
  created_at: string;
  updated_at: string;
  status: string | null;
  credit_score_status: string | null;
  email: string | null;
  phone: string | null;
}

const AdminLeadAnalytics = () => {
  const [range, setRange] = useState<Range>('7d');
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [apps, setApps] = useState<AppRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const cutoff = rangeToCutoff(range);

      let leadsQ = supabase.from('leads').select('id, created_at, updated_at, last_step_reached, last_step_name, utm_source, source, status').order('created_at', { ascending: false }).limit(5000);
      let appsQ = supabase.from('finance_applications').select('id, created_at, updated_at, status, credit_score_status, email, phone').order('created_at', { ascending: false }).limit(5000);
      if (cutoff) {
        leadsQ = leadsQ.gte('created_at', cutoff.toISOString());
        appsQ = appsQ.gte('created_at', cutoff.toISOString());
      }
      const [{ data: leadsData }, { data: appsData }] = await Promise.all([leadsQ, appsQ]);
      if (cancelled) return;
      setLeads((leadsData || []) as any);
      setApps((appsData || []) as any);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [range]);

  // Match submitted apps back to lead rows by email/phone for funnel accuracy
  const submittedKeys = useMemo(() => {
    const s = new Set<string>();
    apps.forEach((a) => {
      if (a.email) s.add(`e:${a.email.toLowerCase().trim()}`);
      if (a.phone) s.add(`p:${a.phone.replace(/\D/g, '')}`);
    });
    return s;
  }, [apps]);

  const enrichedLeads = useMemo(() => {
    return leads.map((l: any) => {
      const key1 = l.client_email ? `e:${String(l.client_email).toLowerCase().trim()}` : '';
      const key2 = l.client_phone ? `p:${String(l.client_phone).replace(/\D/g, '')}` : '';
      const submitted = (key1 && submittedKeys.has(key1)) || (key2 && submittedKeys.has(key2));
      return { ...l, _submitted: submitted };
    });
  }, [leads, submittedKeys]);

  // Headline KPIs
  const totalLeads = leads.length;
  const totalApps = apps.length;
  const totalAbandoned = enrichedLeads.filter((l) => !l._submitted).length;
  const conversion = totalLeads > 0 ? (totalApps / totalLeads) * 100 : 0;

  // Drop-off funnel: by deepest step reached among non-submitted leads
  const funnelData = useMemo(() => {
    const buckets: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    enrichedLeads.forEach((l) => {
      if (l._submitted) return;
      const s = l.last_step_reached || 1;
      if (buckets[s] !== undefined) buckets[s] += 1;
    });
    return Object.entries(STEPS).map(([k, name]) => ({
      step: name,
      Abandoned: buckets[Number(k)] || 0,
    }));
  }, [enrichedLeads]);

  // Time analysis (avg minutes)
  const timeAnalysis = useMemo(() => {
    const diffMin = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60000);
    const abandoned = enrichedLeads.filter((l) => !l._submitted).map((l) => diffMin(l.created_at, l.updated_at));
    const submitted = apps.map((a) => diffMin(a.created_at, a.updated_at));
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return [
      { label: 'Avg time before abandonment', minutes: Math.round(avg(abandoned) * 10) / 10 },
      { label: 'Avg time to successful submission', minutes: Math.round(avg(submitted) * 10) / 10 },
    ];
  }, [enrichedLeads, apps]);

  // Lead velocity over time (bucketed)
  const velocityData = useMemo(() => {
    if (leads.length === 0) return [];
    const useHourly = range === '1h' || range === '24h';
    const fmt = (d: Date) => useHourly
      ? `${d.getHours().toString().padStart(2, '0')}:00`
      : `${d.getMonth() + 1}/${d.getDate()}`;
    const map = new Map<string, number>();
    leads.forEach((l) => {
      const d = new Date(l.created_at);
      if (useHourly) d.setMinutes(0, 0, 0);
      else d.setHours(0, 0, 0, 0);
      const key = fmt(d);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, count]) => ({ label, Leads: count }));
  }, [leads, range]);

  // Credit risk distribution from finance_applications
  const creditDist = useMemo(() => {
    const labels: Record<string, string> = {
      excellent_good: 'Excellent / Good',
      not_sure: 'Not Sure',
      defaults_arrears: 'Defaults / Arrears',
      judgements: 'Judgements',
      debt_review: 'Debt Review',
      blacklisted: 'Blacklisted',
    };
    const counts: Record<string, number> = {};
    apps.forEach((a) => {
      const k = a.credit_score_status || 'unknown';
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts).map(([k, v]) => ({ name: labels[k] || k, value: v }));
  }, [apps]);

  // Traffic source: submitted vs abandoned by source
  const trafficSourceData = useMemo(() => {
    const map = new Map<string, { source: string; Submitted: number; Abandoned: number }>();
    enrichedLeads.forEach((l) => {
      const src = (l.utm_source || l.source || 'direct').toLowerCase();
      const row = map.get(src) || { source: src, Submitted: 0, Abandoned: 0 };
      if (l._submitted) row.Submitted += 1;
      else row.Abandoned += 1;
      map.set(src, row);
    });
    return Array.from(map.values()).sort((a, b) => (b.Submitted + b.Abandoned) - (a.Submitted + a.Abandoned)).slice(0, 8);
  }, [enrichedLeads]);

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    color: 'hsl(var(--popover-foreground))',
    fontSize: 12,
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>Lead Analytics — Admin</title>
      </Helmet>

      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-semibold tracking-tight">Lead Analytics</h1>
            <p className="text-muted-foreground text-sm mt-1">Funnel, abandonment, velocity & traffic quality</p>
          </motion.div>
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-[200px] bg-card/60 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RANGE_LABELS) as Range[]).map((k) => (
                <SelectItem key={k} value={k}>{RANGE_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading analytics…
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={Users} label="Total Leads Received" value={totalLeads.toLocaleString()} />
              <KpiCard icon={FileCheck2} label="Applications Submitted" value={totalApps.toLocaleString()} />
              <KpiCard icon={AlertTriangle} label="Abandoned / Drop-offs" value={totalAbandoned.toLocaleString()} />
              <KpiCard icon={Percent} label="Conversion Rate" value={`${conversion.toFixed(1)}%`} accent />
            </div>

            {/* Funnel + Velocity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard icon={TrendingUp} title="Drop-off Funnel" subtitle="Where applicants abandon">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={funnelData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="step" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted) / 0.2)' }} />
                    <Bar dataKey="Abandoned" fill={ACCENT} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard icon={Activity} title="Lead Velocity" subtitle={`Volume over ${RANGE_LABELS[range].toLowerCase()}`}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={velocityData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="Leads" stroke={ACCENT} strokeWidth={2} dot={{ r: 3, fill: ACCENT }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Time analysis + Credit risk */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard icon={Clock} title="Time Analysis" subtitle="Average minutes spent in form">
                <div className="space-y-4 pt-2">
                  {timeAnalysis.map((row) => (
                    <div key={row.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-mono font-semibold">{row.minutes} min</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.min(100, row.minutes * 4)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </ChartCard>

              <ChartCard icon={ShieldAlert} title="Credit Risk Distribution" subtitle="Quality of incoming traffic">
                {creditDist.length === 0 ? (
                  <EmptyState />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={creditDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={2}
                        dataKey="value"
                        stroke={SURFACE}
                      >
                        {creditDist.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11, color: MUTED }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            {/* Traffic source */}
            <ChartCard icon={Globe} title="Traffic Source / Channel" subtitle="Submitted vs abandoned by source">
              {trafficSourceData.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trafficSourceData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="source" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted) / 0.2)' }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: MUTED }} />
                    <Bar dataKey="Submitted" stackId="a" fill={ACCENT} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Abandoned" stackId="a" fill="hsl(0 0% 35%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

const KpiCard = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card rounded-xl p-5 border border-border/60"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`mt-2 text-3xl font-semibold ${accent ? 'text-primary' : ''}`}>{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground'}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </motion.div>
);

const ChartCard = ({ icon: Icon, title, subtitle, children }: { icon: any; title: string; subtitle?: string; children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card rounded-xl p-5 border border-border/60"
  >
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center text-muted-foreground">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
    {children}
  </motion.div>
);

const EmptyState = () => (
  <div className="text-center py-16 text-sm text-muted-foreground">No data in the selected window.</div>
);

export default AdminLeadAnalytics;
