import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  TrendingUp, Users, FileCheck2, AlertTriangle, Percent,
  Clock, Activity, ShieldAlert, Globe, Loader2, MessageCircle, Tag,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area, LabelList,
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

// Vibrant analytics palette — admin-only, intentionally pops against dark surface
const VIBRANT = {
  electricBlue: '#3B82F6',
  neonGreen: '#10F49B',
  crimson: '#EF4444',
  brightOrange: '#F97316',
  violet: '#8B5CF6',
  cyan: '#22D3EE',
  amber: '#FBBF24',
  pink: '#EC4899',
};
const VIBRANT_PALETTE = [
  VIBRANT.electricBlue,
  VIBRANT.neonGreen,
  VIBRANT.crimson,
  VIBRANT.brightOrange,
  VIBRANT.violet,
  VIBRANT.cyan,
  VIBRANT.amber,
  VIBRANT.pink,
];

const ACCENT = VIBRANT.electricBlue;
const MUTED = 'hsl(var(--muted-foreground))';
const SURFACE = 'hsl(var(--card))';

// Outlier filtering
const TEST_EMAIL_BLOCKLIST = new Set<string>([
  'albertprinsloo051@gmail.com',
]);
const TIME_OUTLIER_CAP_MIN = 1440; // 24 hours

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
  utm_medium: string | null;
  utm_campaign: string | null;
  source: string | null;
  status: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  traffic_source?: string | null;
  bot_outcome?: string | null;
  platform?: string | null;
  origin?: string | null;
}

interface AppRow {
  id: string;
  created_at: string;
  updated_at: string;
  status: string | null;
  credit_score_status: string | null;
  email: string | null;
  phone: string | null;
  utm_source?: string | null;
}

const AdminLeadAnalytics = () => {
  const [range, setRange] = useState<Range>('7d');
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [messages, setMessages] = useState<{ created_at: string; platform_source: string | null; phone_number: string | null }[]>([]);
  const [drafts, setDrafts] = useState<{ last_completed_step: string; step_number: number | null; submitted: boolean; updated_at: string }[]>([]);
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});
  const [webhookLead, setWebhookLead] = useState<any>(null);

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderInteractiveLegend = (props: any) => {
    const { payload } = props;
    if (!payload) return null;
    return (
      <ul className="flex flex-wrap gap-3 justify-center pt-2 text-[11px]">
        {payload.map((entry: any) => {
          const hidden = !!hiddenSeries[entry.dataKey];
          return (
            <li
              key={entry.dataKey}
              onClick={() => toggleSeries(entry.dataKey)}
              className="cursor-pointer flex items-center gap-1.5 select-none transition-opacity"
              style={{
                opacity: hidden ? 0.35 : 1,
                textDecoration: hidden ? 'line-through' : 'none',
                color: entry.color,
              }}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.value}
            </li>
          );
        })}
      </ul>
    );
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const cutoff = rangeToCutoff(range);

      // NOTE: do NOT use .neq() for blocklisting — PostgREST treats NULL as
      // not-matching, which would silently drop every lead with no email.
      // Filter the blocklist client-side instead (see cleanLeads below).
      let leadsQ = supabase.from('leads')
        .select('id, created_at, updated_at, last_step_reached, last_step_name, utm_source, utm_medium, utm_campaign, source, status, client_email, client_phone, traffic_source, bot_outcome, platform, origin')
        .order('created_at', { ascending: false }).limit(5000);
      let appsQ = supabase.from('finance_applications')
        .select('id, created_at, updated_at, status, credit_score_status, email, phone, utm_source')
        .order('created_at', { ascending: false }).limit(5000);
      let msgCountQ = supabase.from('whatsapp_messages')
        .select('id', { count: 'exact', head: true });
      let msgRowsQ = supabase.from('whatsapp_messages')
        .select('created_at, platform_source, phone_number')
        .order('created_at', { ascending: false }).limit(10000);
      let draftsQ = (supabase.from as any)('application_drafts')
        .select('last_completed_step, step_number, submitted, updated_at, abandonment_flags')
        .order('updated_at', { ascending: false }).limit(10000);
      if (cutoff) {
        leadsQ = leadsQ.gte('created_at', cutoff.toISOString());
        appsQ = appsQ.gte('created_at', cutoff.toISOString());
        msgCountQ = msgCountQ.gte('created_at', cutoff.toISOString());
        msgRowsQ = msgRowsQ.gte('created_at', cutoff.toISOString());
        draftsQ = draftsQ.gte('updated_at', cutoff.toISOString());
      }
      const [{ data: leadsData }, { data: appsData }, { count: msgCount }, { data: msgRows }, { data: draftRows }] =
        await Promise.all([leadsQ, appsQ, msgCountQ, msgRowsQ, draftsQ]);
      if (cancelled) return;
      // Defense-in-depth: also strip blocklisted emails client-side
      const cleanLeads = (leadsData || []).filter((l: any) =>
        !l.client_email || !TEST_EMAIL_BLOCKLIST.has(String(l.client_email).toLowerCase().trim())
      );
      const cleanApps = (appsData || []).filter((a: any) =>
        !a.email || !TEST_EMAIL_BLOCKLIST.has(String(a.email).toLowerCase().trim())
      );
      setLeads(cleanLeads as any);
      setApps(cleanApps as any);
      setMessageCount(msgCount ?? 0);
      setMessages((msgRows as any) || []);
      setDrafts(((draftRows as any) || []));
      // Targeted X-Ray: fetch one non-website lead to inspect EasySocial webhook payload
      const { data: whLead } = await supabase
        .from('leads')
        .select('*')
        .neq('source', 'Finance Form')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setWebhookLead(whLead);
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
  // Conversion = leads in this range that we matched to a submitted app,
  // divided by total leads. Using totalApps/totalLeads is wrong because
  // apps can come from leads OUTSIDE the date window (or from sources that
  // never created a lead row), producing >100% nonsense.
  const totalLeads = leads.length;
  const totalApps = apps.length;
  const submittedLeadCount = enrichedLeads.filter((l) => l._submitted).length;
  const totalAbandoned = totalLeads - submittedLeadCount;
  const conversion = totalLeads > 0
    ? Math.min(100, (submittedLeadCount / totalLeads) * 100)
    : 0;

  // Pipeline funnel: top-of-funnel leads → submitted apps → bank stages.
  // Each stage's volume includes all stages below it (true funnel shape).
  const funnelData = useMemo(() => {
    const statusOf = (a: AppRow) => String(a.status || '').toLowerCase().trim();

    const SENT_TO_BANKS = new Set([
      'sent_to_banks',
      'pre_approved', 'approved',
      'documents_received',
      'validations_pending',
      'validations_complete',
      'contract_sent', 'contract_signed',
      'vehicle_delivered', 'finalized',
      'declined', 'declined_conditional', 'blacklisted',
    ]);
    const APPROVALS_VALS = new Set([
      'pre_approved', 'approved',
      'validations_pending',
      'validations_complete',
      'contract_sent', 'contract_signed',
      'vehicle_delivered', 'finalized',
    ]);
    const VALS_DONE = new Set([
      'validations_complete',
      'contract_sent', 'contract_signed',
      'vehicle_delivered', 'finalized',
    ]);

    const sentToBanks = apps.filter((a) => SENT_TO_BANKS.has(statusOf(a))).length;
    const approvalsVals = apps.filter((a) => APPROVALS_VALS.has(statusOf(a))).length;
    const valsDone = apps.filter((a) => VALS_DONE.has(statusOf(a))).length;

    const stages = [
      { stage: 'Raw Leads', value: totalLeads, fill: VIBRANT.electricBlue },
      { stage: 'Apps Received', value: totalApps, fill: VIBRANT.violet },
      { stage: 'Sent to Banks', value: sentToBanks, fill: VIBRANT.cyan },
      { stage: 'Approvals & Vals', value: approvalsVals, fill: VIBRANT.amber },
      { stage: 'Vals Done', value: valsDone, fill: VIBRANT.neonGreen },
    ];

    return stages.map((s, i) => {
      const prev = i === 0 ? null : stages[i - 1].value;
      const conv = prev && prev > 0 ? (s.value / prev) * 100 : i === 0 ? 100 : 0;
      return { ...s, conversion: conv };
    });
  }, [apps, totalLeads, totalApps]);

  const funnelHasData = funnelData.some((s) => s.value > 0);

  // Application Form Abandonment: aggregate `application_drafts` by step,
  // excluding any sessions that ultimately submitted the application.
  // Stacked by abandonment reason: Clean / Blacklisted / Bad Credit / No Licence / Low Income.
  const ABANDON_FLAG_KEYS = ['Blacklisted', 'Bad Credit', 'No Licence', 'Low Income'] as const;
  const abandonmentData = useMemo(() => {
    const STEP_LABELS: Record<number, string> = {
      0: 'Step 0: Landed',
      1: 'Step 1: Personal Details',
      2: 'Step 2: Employment',
      3: 'Step 3: Financials',
      4: 'Step 4: Vehicle Preference',
      5: 'Step 5: Review & Submit',
    };
    const make = () => ({ clean: 0, Blacklisted: 0, 'Bad Credit': 0, 'No Licence': 0, 'Low Income': 0, total: 0 });
    const buckets: Record<number, ReturnType<typeof make>> = {
      0: make(), 1: make(), 2: make(), 3: make(), 4: make(), 5: make(),
    };
    drafts.forEach((d: any) => {
      if (d.submitted) return;
      const n = d.step_number ?? 0;
      if (n < 0 || n > 5) return;
      const flags: string[] = Array.isArray(d.abandonment_flags) ? d.abandonment_flags : [];
      const negative = flags.filter((f) => (ABANDON_FLAG_KEYS as readonly string[]).includes(f));
      buckets[n].total += 1;
      if (negative.length === 0) {
        buckets[n].clean += 1;
      } else {
        // Count toward each negative flag (stacked); also keep total = sum across stacks
        negative.forEach((f) => { (buckets[n] as any)[f] += 1; });
        // Subtract overcounting from total (we want bar height = real abandons,
        // but stacking multiple flags would inflate). Simpler: when multiple
        // flags present, attribute to the most severe in priority order.
        (buckets[n] as any)[negative[0]] = (buckets[n] as any)[negative[0]]; // no-op for clarity
      }
    });
    // Re-derive: for each draft, attribute to ONE bucket using priority order
    // so stacked bar height equals actual abandoned session count.
    Object.keys(buckets).forEach((k) => {
      const b: any = buckets[Number(k)];
      b.Blacklisted = 0; b['Bad Credit'] = 0; b['No Licence'] = 0; b['Low Income'] = 0; b.clean = 0;
    });
    drafts.forEach((d: any) => {
      if (d.submitted) return;
      const n = d.step_number ?? 0;
      if (n < 0 || n > 5) return;
      const flags: string[] = Array.isArray(d.abandonment_flags) ? d.abandonment_flags : [];
      const priority = ['Blacklisted', 'Bad Credit', 'No Licence', 'Low Income'];
      const hit = priority.find((p) => flags.includes(p));
      if (hit) (buckets[n] as any)[hit] += 1;
      else (buckets[n] as any).clean += 1;
    });
    const totalAbandoned = Object.values(buckets).reduce((a, b) => a + b.total, 0);
    return [0, 1, 2, 3, 4, 5].map((n) => {
      const b = buckets[n];
      const rate = totalAbandoned > 0 ? (b.total / totalAbandoned) * 100 : 0;
      return {
        step: STEP_LABELS[n],
        shortStep: `Step ${n}`,
        clean: b.clean,
        Blacklisted: b.Blacklisted,
        'Bad Credit': b['Bad Credit'],
        'No Licence': b['No Licence'],
        'Low Income': b['Low Income'],
        abandoned: b.total,
        rate: Math.round(rate * 10) / 10,
      };
    });
  }, [drafts]);
  const abandonmentHasData = abandonmentData.some((d) => d.abandoned > 0);
  const ABANDON_COLORS = {
    clean: '#52525B',           // zinc-600
    Blacklisted: '#EF4444',     // red
    'Bad Credit': '#F97316',    // orange
    'No Licence': '#FBBF24',    // amber
    'Low Income': '#A855F7',    // violet
  } as const;

  // Time analysis (avg minutes) — outliers > 24h excluded to prevent forgotten test sessions skewing averages
  // - Abandonment: lead.created_at -> lead.updated_at (last progressive step save)
  // - Submission: lead.created_at -> matched finance_application.created_at
  const timeAnalysis = useMemo(() => {
    const diffMin = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60000);
    const withinCap = (m: number) => m > 0 && m <= TIME_OUTLIER_CAP_MIN;

    // Build lookup of earliest app per email/phone for true funnel time
    const appByKey = new Map<string, string>(); // key -> earliest app created_at
    apps.forEach((a) => {
      const keys: string[] = [];
      if (a.email) keys.push(`e:${a.email.toLowerCase().trim()}`);
      if (a.phone) keys.push(`p:${a.phone.replace(/\D/g, '')}`);
      keys.forEach((k) => {
        const existing = appByKey.get(k);
        if (!existing || new Date(a.created_at) < new Date(existing)) appByKey.set(k, a.created_at);
      });
    });

    const abandoned = enrichedLeads
      .filter((l) => !l._submitted)
      .map((l) => diffMin(l.created_at, l.updated_at))
      .filter(withinCap);

    const submitted: number[] = [];
    enrichedLeads.forEach((l: any) => {
      if (!l._submitted) return;
      const k1 = l.client_email ? `e:${String(l.client_email).toLowerCase().trim()}` : '';
      const k2 = l.client_phone ? `p:${String(l.client_phone).replace(/\D/g, '')}` : '';
      const appCreated = (k1 && appByKey.get(k1)) || (k2 && appByKey.get(k2));
      if (!appCreated) return;
      const m = diffMin(l.created_at, appCreated);
      if (withinCap(m)) submitted.push(m);
    });

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return [
      { label: 'Avg time before abandonment', minutes: Math.round(avg(abandoned) * 10) / 10, sample: abandoned.length },
      { label: 'Avg time to successful submission', minutes: Math.round(avg(submitted) * 10) / 10, sample: submitted.length },
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

  // Traffic source: submitted vs abandoned by source.
  // Prefer EasySocial CRM platform/origin, then traffic_source tag, UTM, then internal source.
  const trafficSourceData = useMemo(() => {
    const map = new Map<string, { source: string; Submitted: number; Abandoned: number }>();
    enrichedLeads.forEach((l: any) => {
      const composed = [l.platform, l.origin].filter(Boolean).join(' / ');
      const src = String(composed || l.traffic_source || l.utm_source || l.source || 'direct').toLowerCase();
      const row = map.get(src) || { source: src, Submitted: 0, Abandoned: 0 };
      if (l._submitted) row.Submitted += 1;
      else row.Abandoned += 1;
      map.set(src, row);
    });
    return Array.from(map.values()).sort((a, b) => (b.Submitted + b.Abandoned) - (a.Submitted + a.Abandoned)).slice(0, 8);
  }, [enrichedLeads]);

  // Lead Quality by Platform: submitted vs abandoned, driven by EasySocial CRM `platform` column.
  const leadsByPlatform = useMemo(() => {
    const map = new Map<string, { platform: string; Submitted: number; Abandoned: number }>();
    enrichedLeads.forEach((l: any) => {
      const p = String(l.platform || 'Unknown');
      const row = map.get(p) || { platform: p, Submitted: 0, Abandoned: 0 };
      if (l._submitted) row.Submitted += 1; else row.Abandoned += 1;
      map.set(p, row);
    });
    return Array.from(map.values()).sort((a, b) => (b.Submitted + b.Abandoned) - (a.Submitted + a.Abandoned));
  }, [enrichedLeads]);

  // Lead Quality by Platform: bot_outcome breakdown grouped by traffic_source (EasySocial)
  const platformQualityData = useMemo(() => {
    const outcomes = new Set<string>();
    const byPlatform = new Map<string, Record<string, number>>();
    enrichedLeads.forEach((l: any) => {
      if (!l.bot_outcome && !l.traffic_source) return;
      const platform = String(l.traffic_source || 'unknown').toLowerCase();
      const outcome = String(l.bot_outcome || 'unclassified').toLowerCase();
      outcomes.add(outcome);
      const row = byPlatform.get(platform) || {};
      row[outcome] = (row[outcome] || 0) + 1;
      byPlatform.set(platform, row);
    });
    const outcomeKeys = Array.from(outcomes);
    const data = Array.from(byPlatform.entries()).map(([platform, row]) => ({
      platform,
      ...outcomeKeys.reduce((acc, k) => ({ ...acc, [k]: row[k] || 0 }), {} as Record<string, number>),
    }));
    return { data, outcomeKeys };
  }, [enrichedLeads]);

  // Message Volume by Time-of-Day × Platform (24 hourly buckets)
  const PLATFORM_COLOR: Record<string, string> = {
    Facebook: VIBRANT.electricBlue,
    Instagram: VIBRANT.pink,
    TikTok: VIBRANT.neonGreen,
    'Website Form': VIBRANT.violet,
    'Direct/Unknown': VIBRANT.amber,
  };
  // Aggressive type coercion — origin column may arrive as string, array, object, or null.
  const coerceToString = (val: any): string => {
    if (val == null) return '';
    if (Array.isArray(val)) return val.map((v) => coerceToString(v)).join(' ');
    if (typeof val === 'object') {
      try { return Object.values(val).map((v) => coerceToString(v)).join(' '); }
      catch { return ''; }
    }
    return String(val);
  };

  // Sourced from `leads` (single source of truth populated by EasySocial webhook).
  const leadPlatformOf = (l: any): string => {
    // Categorize website-originated leads up front so they don't fall into "Direct/Unknown".
    const safeSource = coerceToString(l?.source).toLowerCase();
    if (safeSource === 'finance form' || safeSource === 'website' || safeSource.includes('finance form') || safeSource.includes('website')) {
      return 'Website Form';
    }

    let safeOrigin = '';
    if (Array.isArray(l?.origin)) safeOrigin = l.origin.map(coerceToString).join(' ').toLowerCase();
    else if (typeof l?.origin === 'string') safeOrigin = l.origin.toLowerCase();
    else if (l?.origin) safeOrigin = coerceToString(l.origin).toLowerCase();
    if (!safeOrigin && l?.platform) safeOrigin = coerceToString(l.platform).toLowerCase();
    if (!safeOrigin && l?.traffic_source) safeOrigin = coerceToString(l.traffic_source).toLowerCase();
    if (!safeOrigin && l?.utm_source) safeOrigin = coerceToString(l.utm_source).toLowerCase();

    if (safeOrigin.includes('tiktok') || safeOrigin.includes('tt')) return 'TikTok';
    if (safeOrigin.includes('facebook') || safeOrigin.includes('fb') || safeOrigin.includes('meta')) return 'Facebook';
    if (safeOrigin.includes('instagram') || safeOrigin.includes('ig') || safeOrigin.includes('insta')) return 'Instagram';
    return 'Direct/Unknown';
  };
  // Kept for any legacy callers.
  const normalizePlatform = (raw: any): string => leadPlatformOf({ origin: raw });

  const messagesByHourPlatform = useMemo(() => {
    const buckets: Record<number, Record<string, number>> = {};
    for (let h = 0; h < 24; h++) {
      buckets[h] = { Facebook: 0, Instagram: 0, TikTok: 0, 'Website Form': 0, 'Direct/Unknown': 0 };
    }
    leads.forEach((l: any) => {
      if (!l.created_at) return;
      const hr = new Date(l.created_at).getHours();
      const p = leadPlatformOf(l);
      buckets[hr][p] = (buckets[hr][p] || 0) + 1;
    });
    return Object.entries(buckets).map(([h, row]) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      ...row,
    }));
  }, [leads]);

  const messageOriginsPie = useMemo(() => {
    const counts: Record<string, number> = { Facebook: 0, Instagram: 0, TikTok: 0, 'Website Form': 0, 'Direct/Unknown': 0 };
    leads.forEach((l: any) => {
      const p = leadPlatformOf(l);
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [leads]);

  // Unique contacts who sent messages (dedupe by phone)
  const uniqueContactCount = useMemo(() => {
    const set = new Set<string>();
    messages.forEach((m) => {
      const p = (m.phone_number || '').replace(/\D/g, '');
      if (p) set.add(p);
    });
    return set.size;
  }, [messages]);

  // Average messages per contact before they submitted an application.
  // For each unique phone, count messages sent BEFORE the matching application's created_at (if any).
  const messagesPerLeadStats = useMemo(() => {
    // Build phone -> earliest app created_at
    const phoneToAppDate = new Map<string, number>();
    apps.forEach((a: any) => {
      const p = (a.phone || '').replace(/\D/g, '');
      if (!p) return;
      const t = a.created_at ? new Date(a.created_at).getTime() : 0;
      const prev = phoneToAppDate.get(p);
      if (!prev || t < prev) phoneToAppDate.set(p, t);
    });
    // Count messages-before-app per phone
    const perPhone = new Map<string, number>();
    messages.forEach((m) => {
      const p = (m.phone_number || '').replace(/\D/g, '');
      if (!p) return;
      const appT = phoneToAppDate.get(p);
      if (!appT) return; // only count contacts who eventually submitted
      const mt = m.created_at ? new Date(m.created_at).getTime() : 0;
      if (mt && mt <= appT) perPhone.set(p, (perPhone.get(p) || 0) + 1);
    });
    const counts = Array.from(perPhone.values());
    const totalConverted = counts.length;
    const totalMsgs = counts.reduce((s, n) => s + n, 0);
    const avg = totalConverted > 0 ? totalMsgs / totalConverted : 0;
    return { avg, totalConverted, totalMsgs };
  }, [messages, apps]);


  // ── Tag analytics: split comma-separated EasySocial tags from leads.traffic_source ──
  const splitTags = (raw: string | null | undefined): string[] => {
    if (!raw) return [];
    return String(raw)
      .split(/[,;|]/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t && t !== 'easysocial' && t !== 'direct' && t !== 'unknown');
  };

  const TOP_N_TAGS = 6;
  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    enrichedLeads.forEach((l: any) => {
      splitTags(l.traffic_source).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N_TAGS)
      .map(([name]) => name);
  }, [enrichedLeads]);

  const tagsOverTime = useMemo(() => {
    if (topTags.length === 0) return [];
    const useHourly = range === '1h' || range === '24h';
    const fmt = (d: Date) => useHourly
      ? `${d.getHours().toString().padStart(2, '0')}:00`
      : `${d.getMonth() + 1}/${d.getDate()}`;
    const buckets = new Map<string, Record<string, number>>();
    enrichedLeads.forEach((l: any) => {
      const tags = splitTags(l.traffic_source).filter((t) => topTags.includes(t));
      if (tags.length === 0) return;
      const d = new Date(l.created_at);
      if (useHourly) d.setMinutes(0, 0, 0); else d.setHours(0, 0, 0, 0);
      const key = fmt(d);
      const row = buckets.get(key) || {};
      tags.forEach((t) => { row[t] = (row[t] || 0) + 1; });
      buckets.set(key, row);
    });
    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, row]) => {
        const filled: Record<string, any> = { label };
        topTags.forEach((t) => { filled[t] = row[t] || 0; });
        return filled;
      });
  }, [enrichedLeads, topTags, range]);

  const tagConversion = useMemo(() => {
    const stats = new Map<string, { tag: string; leads: number; submitted: number }>();
    enrichedLeads.forEach((l: any) => {
      splitTags(l.traffic_source).forEach((t) => {
        const row = stats.get(t) || { tag: t, leads: 0, submitted: 0 };
        row.leads += 1;
        if (l._submitted) row.submitted += 1;
        stats.set(t, row);
      });
    });
    return Array.from(stats.values())
      .map((r) => ({ ...r, conversion: r.leads > 0 ? (r.submitted / r.leads) * 100 : 0 }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10);
  }, [enrichedLeads]);

  // App Outcome Breakdown — Submitted vs Pre-Approved vs Declined/Blacklisted
  const appOutcomeStats = useMemo(() => {
    const SUBMITTED = new Set(['pending', 'application_submitted', 'sent_to_banks', 'validations_pending', 'revision_submitted', 'documents_received', 'validations_complete']);
    const PRE_APPROVED = new Set(['pre_approved', 'approved', 'vehicle_selected', 'contract_sent', 'contract_signed', 'vehicle_delivered', 'finalized', 'delivered']);
    const DECLINED = new Set(['declined', 'declined_conditional', 'blacklisted']);

    let submitted = 0, preApproved = 0, declined = 0;
    apps.forEach((a) => {
      const s = String(a.status || '').toLowerCase().trim();
      if (PRE_APPROVED.has(s)) preApproved += 1;
      else if (DECLINED.has(s)) declined += 1;
      else if (SUBMITTED.has(s)) submitted += 1;
    });
    const total = submitted + preApproved + declined;
    return {
      total,
      submitted,
      preApproved,
      declined,
      data: [
        { name: 'Apps Submitted', value: submitted, fill: VIBRANT.electricBlue },
        { name: 'Pre-Approved', value: preApproved, fill: VIBRANT.neonGreen },
        { name: 'Declined / Blacklisted', value: declined, fill: VIBRANT.crimson },
      ],
    };
  }, [apps]);


  // Force light text on dark background — Recharts default tooltip text inherits
  // OS color and renders unreadable against the dark admin theme.
  const tooltipStyle = {
    backgroundColor: '#111111',
    border: '1px solid #333333',
    borderRadius: 8,
    color: '#ffffff',
    fontSize: 12,
  };
  const tooltipItemStyle = { color: '#ffffff' };
  const tooltipLabelStyle = { color: '#aaaaaa', marginBottom: 4 };

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
            {/* Headline KPI strip — high-contrast, premium minimal */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={MessageCircle} label="Total Messages" value={messageCount.toLocaleString()} accent />
              <KpiCard icon={Users} label="Unique Contacts (Messaged)" value={uniqueContactCount.toLocaleString()} accent />
              <KpiCard
                icon={Activity}
                label="Avg Msgs / Lead Before App"
                value={messagesPerLeadStats.avg.toFixed(1)}
              />
              <KpiCard icon={Users} label="Total New Leads" value={totalLeads.toLocaleString()} />
              <KpiCard icon={FileCheck2} label="Total Applications" value={totalApps.toLocaleString()} />
              <KpiCard icon={Percent} label="Lead → App Conversion" value={`${conversion.toFixed(1)}%`} />
              <KpiCard
                icon={TrendingUp}
                label="Approval Rate"
                value={`${(apps.length > 0 ? (apps.filter(a => ['approved','vehicle_selected'].includes(String(a.status))).length / apps.length) * 100 : 0).toFixed(1)}%`}
              />
              <KpiCard
                icon={ShieldAlert}
                label="Decline Rate"
                value={`${(apps.length > 0 ? (apps.filter(a => String(a.status) === 'declined').length / apps.length) * 100 : 0).toFixed(1)}%`}
              />
            </div>

            {/* Application Outcome Breakdown — Submitted vs Pre-Approved vs Declined/Blacklisted */}
            <ChartCard
              icon={FileCheck2}
              title="Application Outcomes"
              subtitle="Submitted vs Pre-Approved vs Declined / Blacklisted"
            >
              {appOutcomeStats.total === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
                  <div className="lg:col-span-2 space-y-3">
                    {appOutcomeStats.data.map((row) => {
                      const pct = appOutcomeStats.total > 0 ? (row.value / appOutcomeStats.total) * 100 : 0;
                      return (
                        <div key={row.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.fill }} />
                              {row.name}
                            </span>
                            <span className="font-mono font-semibold" style={{ color: row.fill }}>
                              {row.value.toLocaleString()}
                              <span className="ml-2 text-[10px] text-muted-foreground">{pct.toFixed(1)}%</span>
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: row.fill }} />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-2 mt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Total tracked</span>
                      <span className="font-mono text-foreground">{appOutcomeStats.total.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="lg:col-span-3">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={appOutcomeStats.data} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: 'hsl(var(--muted) / 0.2)' }} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {appOutcomeStats.data.map((row, i) => (
                            <Cell key={i} fill={row.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </ChartCard>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard icon={TrendingUp} title="Pipeline Funnel" subtitle="Leads → Apps → Bank stages">
                {!funnelHasData ? (
                  <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                    No data available for this date range.
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    {funnelData.map((row, i) => {
                      const max = funnelData[0].value || 1;
                      const widthPct = Math.max(8, (row.value / max) * 100);
                      return (
                        <div key={row.stage} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground/90 font-medium">{row.stage}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {row.value}
                              {i > 0 && (
                                <span className="ml-2 text-[10px] text-muted-foreground/70">
                                  {row.conversion.toFixed(1)}%
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="h-7 w-full rounded-md bg-muted/30 overflow-hidden border border-border/50">
                            <div
                              className="h-full rounded-md transition-all"
                              style={{
                                width: `${widthPct}%`,
                                background: `linear-gradient(90deg, ${row.fill}33, ${row.fill})`,
                                boxShadow: `0 0 12px ${row.fill}40`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ChartCard>

              <ChartCard icon={Activity} title="Lead Velocity" subtitle={`Volume over ${RANGE_LABELS[range].toLowerCase()}`}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={velocityData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} />
                    <Line
                      type="monotone"
                      dataKey="Leads"
                      stroke={VIBRANT.neonGreen}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: VIBRANT.neonGreen, stroke: VIBRANT.neonGreen }}
                      activeDot={{ r: 6, fill: VIBRANT.neonGreen }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Application Funnel KPIs */}
            {(() => {
              const totalSubmitted = apps.length;
              const activeDrafts = drafts.filter((d: any) => !d.submitted);
              const totalDrafts = activeDrafts.length;
              const landedOnly = activeDrafts.filter((d: any) => (d.step_number ?? 0) === 0).length;
              const engagedDrafts = activeDrafts.filter((d: any) => (d.step_number ?? 0) > 0).length;
              const totalStarted = totalSubmitted + totalDrafts;
              const totalLandings = totalSubmitted + totalDrafts; // every record = a landing
              const engagementRate = totalLandings > 0
                ? ((totalSubmitted + engagedDrafts) / totalLandings) * 100
                : 0;
              const completionRate = totalStarted > 0 ? (totalSubmitted / totalStarted) * 100 : 0;
              const unqualifiedDropoffs = activeDrafts.filter((d: any) =>
                Array.isArray(d.abandonment_flags) && d.abandonment_flags.length > 0
              ).length;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-1">
                  <div className="rounded-xl border border-border/60 bg-zinc-950/60 backdrop-blur p-4">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Landings</div>
                    <div className="mt-1 text-2xl font-bold text-foreground">{totalLandings.toLocaleString()}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">All form page views</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-zinc-950/60 backdrop-blur p-4">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Apps Started</div>
                    <div className="mt-1 text-2xl font-bold text-foreground">{totalStarted.toLocaleString()}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Submitted + drafts</div>
                  </div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur p-4">
                    <div className="text-[11px] uppercase tracking-wider text-emerald-300/80">Total Apps Submitted</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-400">{totalSubmitted.toLocaleString()}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Finalized applications</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-zinc-950/60 backdrop-blur p-4">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Abandoned</div>
                    <div className="mt-1 text-2xl font-bold text-foreground">{totalDrafts.toLocaleString()}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{completionRate.toFixed(1)}% completion</div>
                  </div>
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 backdrop-blur p-4">
                    <div className="text-[11px] uppercase tracking-wider text-rose-300/80">Unqualified Dropoffs</div>
                    <div className="mt-1 text-2xl font-bold text-rose-400">{unqualifiedDropoffs.toLocaleString()}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Negative flag triggered</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-zinc-950/60 backdrop-blur p-4">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Engagement Rate</div>
                    <div className="mt-1 text-2xl font-bold text-foreground">{engagementRate.toFixed(1)}%</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{landedOnly.toLocaleString()} landed only</div>
                  </div>
                </div>
              );
            })()}

            {/* Application Form Abandonment */}
            <ChartCard
              icon={AlertTriangle}
              title="Application Form Abandonment"
              subtitle="Where applicants give up in the multi-step form (submitted sessions excluded)"
            >
              {!abandonmentHasData ? (
                <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                  No abandonment data available for this date range.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={abandonmentData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="shortStep" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                      labelStyle={tooltipLabelStyle}
                      cursor={{ fill: 'hsl(var(--muted) / 0.2)' }}
                      labelFormatter={(_l, payload: any) => payload?.[0]?.payload?.step ?? _l}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
                    <Bar dataKey="clean" name="Clean Dropoff" stackId="a" fill={ABANDON_COLORS.clean} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Blacklisted" name="Blacklisted" stackId="a" fill={ABANDON_COLORS.Blacklisted} />
                    <Bar dataKey="Bad Credit" name="Bad Credit" stackId="a" fill={ABANDON_COLORS['Bad Credit']} />
                    <Bar dataKey="No Licence" name="No Licence" stackId="a" fill={ABANDON_COLORS['No Licence']} />
                    <Bar dataKey="Low Income" name="Low Income" stackId="a" fill={ABANDON_COLORS['Low Income']} radius={[6, 6, 0, 0]}>
                      <LabelList
                        dataKey="abandoned"
                        position="top"
                        style={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 700 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Time analysis + Credit risk */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard icon={Clock} title="Time Analysis" subtitle="Average minutes spent in form (sessions > 24h excluded)">
                <div className="space-y-4 pt-2">
                  {timeAnalysis.map((row, idx) => {
                    const color = idx === 0 ? VIBRANT.crimson : VIBRANT.neonGreen;
                    return (
                      <div key={row.label} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className="font-mono font-semibold" style={{ color }}>
                            {row.minutes} min
                            <span className="ml-2 text-[10px] text-muted-foreground">n={(row as any).sample ?? 0}</span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(100, row.minutes * 4)}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
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
                          <Cell key={i} fill={VIBRANT_PALETTE[i % VIBRANT_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} />
                      <Legend wrapperStyle={{ fontSize: 11, color: MUTED }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            {/* Traffic source */}
            <ChartCard icon={Globe} title="Traffic Source / Channel" subtitle="Submitted vs abandoned by source (EasySocial bot + UTM)">
              {trafficSourceData.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trafficSourceData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="source" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: 'hsl(var(--muted) / 0.2)' }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: MUTED }} />
                    <Bar dataKey="Submitted" stackId="a" fill={VIBRANT.neonGreen} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Abandoned" stackId="a" fill={VIBRANT.crimson} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Lead Quality by Platform — driven by EasySocial CRM lead_create events */}
            <ChartCard icon={Tag} title="Lead Quality by Platform" subtitle="Submitted vs abandoned per EasySocial platform">
              {leadsByPlatform.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={leadsByPlatform} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="platform" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: 'hsl(var(--muted) / 0.2)' }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: MUTED }} />
                    <Bar dataKey="Submitted" stackId="a" fill={VIBRANT.neonGreen} />
                    <Bar dataKey="Abandoned" stackId="a" fill={VIBRANT.crimson} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Message Time-Matrix + Origins Pie */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <ChartCard icon={Clock} title="Message Volume by Time & Platform" subtitle="Hourly distribution of inbound WhatsApp messages by origin">
                  {messages.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={messagesByHourPlatform} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="hour"
                          stroke={MUTED}
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={30}
                          tickFormatter={(v: string) => {
                            // Display only HH:MM, drop seconds if present
                            const m = String(v).match(/^(\d{1,2}:\d{2})/);
                            return m ? m[1] : String(v);
                          }}
                          type="category"
                        />
                        <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          itemStyle={tooltipItemStyle}
                          labelStyle={tooltipLabelStyle}
                          cursor={{ stroke: 'hsl(var(--muted-foreground) / 0.4)', strokeWidth: 1 }}
                          formatter={(v: any, n: any) => [`${v} msg`, n]}
                          labelFormatter={(l) => `Hour: ${l}`}
                        />
                        <Legend content={renderInteractiveLegend} />
                        <Line type="monotone" dataKey="Facebook" stroke={PLATFORM_COLOR.Facebook} strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 5 }} hide={hiddenSeries.Facebook} />
                        <Line type="monotone" dataKey="Instagram" stroke={PLATFORM_COLOR.Instagram} strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 5 }} hide={hiddenSeries.Instagram} />
                        <Line type="monotone" dataKey="TikTok" stroke={PLATFORM_COLOR.TikTok} strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 5 }} hide={hiddenSeries.TikTok} />
                        <Line type="monotone" dataKey="Website Form" stroke={PLATFORM_COLOR['Website Form']} strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 5 }} hide={hiddenSeries['Website Form']} />
                        <Line type="monotone" dataKey="Direct/Unknown" stroke={PLATFORM_COLOR['Direct/Unknown']} strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 5 }} hide={hiddenSeries['Direct/Unknown']} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>
              <ChartCard icon={Globe} title="Message Origins" subtitle="Overall split across the selected window">
                {messageOriginsPie.length === 0 ? (
                  <EmptyState />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={messageOriginsPie}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                        stroke={SURFACE}
                      >
                        {messageOriginsPie.map((entry, i) => (
                          <Cell key={i} fill={PLATFORM_COLOR[entry.name] || VIBRANT_PALETTE[i % VIBRANT_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        itemStyle={tooltipItemStyle}
                        labelStyle={tooltipLabelStyle}
                        formatter={(v: any, n: any) => [`${v} msg`, n]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: MUTED }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            {/* Top Tags / Lead → App by Tag charts removed — depended on EasySocial inbound tag enrichment that is not currently flowing. */}
          </>
        )}

        {/* Full Lead Record X-Ray (diagnostic) */}
        <div className="mt-8 pt-4 border-t border-border/30">
          <p className="text-[10px] text-zinc-500/80 font-mono tracking-tight mb-2">
            Full Lead Record X-Ray:
          </p>
          <pre className="text-xs text-zinc-500 whitespace-pre-wrap break-words bg-zinc-950/50 rounded-lg p-3 border border-border/20">
            {leads.length > 0 ? JSON.stringify(leads[0], null, 2) : '[no leads loaded]'}
          </pre>
        </div>
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
