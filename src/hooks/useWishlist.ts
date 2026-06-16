import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  mileage: number;
  price: number;
  images: string[];
  transmission: string;
  fuelType: string;
  color: string;
  engineCode?: string;
  vin?: string;
  financeAvailable: boolean;
  status: 'available' | 'incoming' | 'sold';
  serviceHistory?: string;
  description?: string;
  youtubeUrl?: string;
}

const WISHLIST_KEY = 'lumina-wishlist';
// `wishlists` isn't in the generated Supabase types — cast to keep TS happy.
const db = supabase as any;

const readLocal = (): string[] => {
  try { return JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]'); } catch { return []; }
};

export const useWishlist = () => {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<string[]>(readLocal);

  // Load on mount from localStorage (guests) and keep state in sync.
  useEffect(() => {
    setWishlist(readLocal());
  }, []);

  // On sign-in, merge the device's local list with the saved server list so
  // saves follow the customer across devices. Local-only items are pushed up.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await db.from('wishlists').select('vehicle_id').eq('user_id', user.id);
      if (cancelled || error) return;
      const dbIds: string[] = (data || []).map((r: any) => r.vehicle_id);
      const local = readLocal();
      const merged = Array.from(new Set([...dbIds, ...local]));
      setWishlist(merged);
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(merged));
      const localOnly = local.filter((id) => !dbIds.includes(id));
      if (localOnly.length) {
        await db.from('wishlists').insert(localOnly.map((vehicle_id) => ({ user_id: user.id, vehicle_id })));
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const persist = useCallback((items: string[]) => {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
    setWishlist(items);
  }, []);

  const addToWishlist = useCallback((vehicleId: string) => {
    setWishlist((prev) => {
      if (prev.includes(vehicleId)) return prev;
      const updated = [...prev, vehicleId];
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
      if (user) db.from('wishlists').upsert({ user_id: user.id, vehicle_id: vehicleId }).then(() => {}, () => {});
      return updated;
    });
  }, [user?.id]);

  const removeFromWishlist = useCallback((vehicleId: string) => {
    setWishlist((prev) => {
      const updated = prev.filter((id) => id !== vehicleId);
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
      if (user) db.from('wishlists').delete().eq('user_id', user.id).eq('vehicle_id', vehicleId).then(() => {}, () => {});
      return updated;
    });
  }, [user?.id]);

  const toggleWishlist = useCallback((vehicleId: string) => {
    setWishlist((prev) => {
      const isIn = prev.includes(vehicleId);
      const updated = isIn ? prev.filter((id) => id !== vehicleId) : [...prev, vehicleId];
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
      if (user) {
        if (isIn) db.from('wishlists').delete().eq('user_id', user.id).eq('vehicle_id', vehicleId).then(() => {}, () => {});
        else db.from('wishlists').upsert({ user_id: user.id, vehicle_id: vehicleId }).then(() => {}, () => {});
      }
      return updated;
    });
  }, [user?.id]);

  const isInWishlist = useCallback(
    (vehicleId: string) => wishlist.includes(vehicleId),
    [wishlist]
  );

  const clearWishlist = useCallback(() => {
    localStorage.removeItem(WISHLIST_KEY);
    setWishlist([]);
    if (user) db.from('wishlists').delete().eq('user_id', user.id).then(() => {}, () => {});
  }, [user?.id]);

  return {
    wishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    isInWishlist,
    clearWishlist,
  };
};
