import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useRef } from 'react';

interface AnalyticsEvent {
  event_type: string;
  event_data?: Record<string, any>;
  page_path?: string;
  session_id?: string;
  user_id?: string;
}

// Generate or retrieve session ID
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
};

export const useTrackEvent = () => {
  return useMutation({
    mutationFn: async (event: AnalyticsEvent) => {
      const { error } = await supabase
        .from('analytics_events')
        .insert({
          event_type: event.event_type,
          event_data: event.event_data || {},
          page_path: event.page_path || window.location.pathname,
          session_id: event.session_id || getSessionId(),
          user_id: event.user_id || null,
        } as any);
      
      if (error) throw error;
    },
    onError: (error) => {
      console.error('Analytics tracking error:', error);
    },
  });
};

// Hook to track page views
export const usePageView = (pagePath?: string) => {
  const trackEvent = useTrackEvent();
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    trackEvent.mutate({
      event_type: 'page_view',
      page_path: pagePath || window.location.pathname,
    });
  }, [pagePath]);
};

// Hook to track time on page
export const useTrackTimeOnPage = (pagePath?: string) => {
  const trackEvent = useTrackEvent();
  const startTime = useRef(Date.now());

  useEffect(() => {
    const path = pagePath || window.location.pathname;
    startTime.current = Date.now();

    return () => {
      const timeSpent = Math.round((Date.now() - startTime.current) / 1000);
      if (timeSpent > 2) { // Only track if > 2 seconds
        trackEvent.mutate({
          event_type: 'time_on_page',
          page_path: path,
          event_data: { seconds: timeSpent },
        });
      }
    };
  }, [pagePath]);
};

// Hook to get analytics data (admin only)
export const useAnalyticsData = (days: number = 7) => {
  return useQuery({
    queryKey: ['analytics', days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};

// Hook to get vehicle stats (excludes 'sourcing' and 'hidden' from counts)
export const useVehicleStats = () => {
  return useQuery({
    queryKey: ['vehicleStats'],
    queryFn: async () => {
      const { data: vehicles, error } = await supabase
        .from('vehicles')
        .select('status, price');
      
      if (error) throw error;

      // Total vehicles count - exclude 'sourcing', 'hidden', and 'sold'
      const countableStatuses = ['available', 'reserved', 'incoming'];
      const totalVehicles = vehicles?.filter(v => 
        countableStatuses.includes(v.status)
      ).length || 0;

      // Total stock value - only 'available' and 'reserved' (actual sellable stock)
      const valueStatuses = ['available', 'reserved'];
      const totalStockValue = vehicles
        ?.filter(v => valueStatuses.includes(v.status))
        .reduce((sum, v) => sum + (v.price || 0), 0) || 0;

      return { totalVehicles, totalStockValue };
    },
  });
};

// Compute analytics summary
export const useAnalyticsSummary = (days: number = 7) => {
  const { data: events = [], isLoading } = useAnalyticsData(days);

  const pageViews = events.filter((e: any) => e.event_type === 'page_view');
  const timeEvents = events.filter((e: any) => e.event_type === 'time_on_page');
  const enquiryEvents = events.filter((e: any) => e.event_type === 'enquiry');

  // Most viewed vehicle
  const vehicleViews = pageViews.filter((e: any) => 
    e.page_path?.startsWith('/vehicle/')
  );
  const vehicleViewCounts: Record<string, number> = {};
  vehicleViews.forEach((e: any) => {
    const path = e.page_path;
    vehicleViewCounts[path] = (vehicleViewCounts[path] || 0) + 1;
  });
  const mostViewedPath = Object.entries(vehicleViewCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0];

  // Average time on site
  const totalTime = timeEvents.reduce((sum: number, e: any) => 
    sum + (e.event_data?.seconds || 0), 0
  );
  const avgTimeOnSite = timeEvents.length > 0 
    ? Math.round(totalTime / timeEvents.length) 
    : 0;

  // Views vs Enquiries by day
  const viewsByDay: Record<string, number> = {};
  const enquiriesByDay: Record<string, number> = {};
  
  pageViews.forEach((e: any) => {
    const day = new Date(e.created_at).toLocaleDateString('en-US', { weekday: 'short' });
    viewsByDay[day] = (viewsByDay[day] || 0) + 1;
  });

  enquiryEvents.forEach((e: any) => {
    const day = new Date(e.created_at).toLocaleDateString('en-US', { weekday: 'short' });
    enquiriesByDay[day] = (enquiriesByDay[day] || 0) + 1;
  });

  const chartData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
    day,
    views: viewsByDay[day] || 0,
    enquiries: enquiriesByDay[day] || 0,
  }));

  return {
    isLoading,
    totalPageViews: pageViews.length,
    avgTimeOnSite,
    mostViewedPath,
    chartData,
    enquiryCount: enquiryEvents.length,
  };
};
