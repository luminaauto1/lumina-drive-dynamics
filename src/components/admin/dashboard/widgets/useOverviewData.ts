import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, subMonths, format, parseISO } from 'date-fns';
import { isFinalizedDeal, dealNetProfit, dealReportDate } from '@/lib/dealMetrics';

/**
 * Overview data for the KPI tiles + Pipeline Spread + Revenue Trend widgets.
 *
 * This is the EXACT computation that AdminAnalytics.tsx used to run in a page-level
 * useEffect — lifted into a single React Query so every overview widget that calls
 * this hook shares ONE fetch (deduped by query key) and reports identical numbers.
 */

const STAGES = [
  { id: 'new', label: 'NEW' },
  { id: 'contacted', label: 'CONTACTED' },
  { id: 'finance', label: 'FINANCE' },
  { id: 'approved', label: 'APPROVED' },
  { id: 'cold', label: 'COLD' },
] as const;

export interface OverviewData {
  stats: {
    totalLeads: number;
    activeLeads: number;
    totalDeals: number;
    conversionRate: number;
    totalProfit: number;
  };
  pipelineData: { name: string; count: number }[];
  revenueTrend: { month: string; profit: number; deals: number }[];
}

async function fetchOverview(): Promise<OverviewData> {
  // Exact COUNT queries (head:true) for lead totals — PostgREST caps returned ROWS
  // at 1000, so counting fetched rows would silently truncate. Counts are not capped.
  const [
    { count: totalLeads },
    { count: activeLeads },
    { data: deals },
    ...stageResults
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .not('is_archived', 'is', true)
      .or('pipeline_stage.neq.cold,pipeline_stage.is.null'),
    supabase.from('deal_records').select('*').limit(20000),
    ...STAGES.map((s) =>
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('pipeline_stage', s.id),
    ),
  ]);

  const leadTotal = totalLeads || 0;
  const finalizedDeals = (deals ?? []).filter(isFinalizedDeal);
  const conversion = leadTotal > 0 ? (finalizedDeals.length / leadTotal) * 100 : 0;
  // Net profit = the stored gross_profit column (already net of costs & splits).
  const profit = finalizedDeals.reduce((sum, deal) => sum + dealNetProfit(deal), 0);

  const pipelineData = STAGES.map((s, i) => ({
    name: s.label,
    count: stageResults[i]?.count || 0,
  }));

  // Revenue trend — last 6 months (SAST-agnostic month buckets, matches original).
  const last6 = Array.from({ length: 6 })
    .map((_, i) => {
      const d = subMonths(new Date(), i);
      return { month: format(d, 'MMM yy'), rawDate: startOfMonth(d), profit: 0, deals: 0 };
    })
    .reverse();

  finalizedDeals.forEach((deal) => {
    const reportDate = dealReportDate(deal);
    if (!reportDate) return;
    const dealMonth = startOfMonth(parseISO(reportDate));
    const bucket = last6.find((m) => m.rawDate.getTime() === dealMonth.getTime());
    if (bucket) {
      bucket.profit += dealNetProfit(deal);
      bucket.deals += 1;
    }
  });

  return {
    stats: {
      totalLeads: leadTotal,
      activeLeads: activeLeads || 0,
      totalDeals: finalizedDeals.length,
      conversionRate: conversion,
      totalProfit: profit,
    },
    pipelineData,
    revenueTrend: last6.map(({ month, profit: p, deals: d }) => ({ month, profit: p, deals: d })),
  };
}

export function useOverviewData() {
  return useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: fetchOverview,
    staleTime: 60_000,
  });
}
