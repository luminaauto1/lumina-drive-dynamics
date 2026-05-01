import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/pixelTracking";

/**
 * Fires Meta + TikTok PageView on every route change.
 * Mounted once globally inside <BrowserRouter>.
 */
export const usePixelPageView = () => {
  const location = useLocation();

  useEffect(() => {
    trackPageView();
  }, [location.pathname, location.search]);
};
