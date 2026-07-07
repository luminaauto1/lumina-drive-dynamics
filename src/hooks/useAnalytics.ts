import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// GA4 pageview tracker — wires React Router changes to gtag
export const useAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'page_view', {
        page_path: location.pathname + location.search,
      });
    }
  }, [location]);
};

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
