import { useState, useEffect, useCallback } from 'react';

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

export const useWishlist = () => {
  const [wishlist, setWishlist] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(WISHLIST_KEY);
    if (stored) {
      try {
        setWishlist(JSON.parse(stored));
      } catch {
        setWishlist([]);
      }
    }
  }, []);

  const saveWishlist = useCallback((items: string[]) => {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
    setWishlist(items);
  }, []);

  const addToWishlist = useCallback((vehicleId: string) => {
    setWishlist((prev) => {
      if (prev.includes(vehicleId)) return prev;
      const updated = [...prev, vehicleId];
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeFromWishlist = useCallback((vehicleId: string) => {
    setWishlist((prev) => {
      const updated = prev.filter((id) => id !== vehicleId);
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const toggleWishlist = useCallback((vehicleId: string) => {
    setWishlist((prev) => {
      const isInWishlist = prev.includes(vehicleId);
      const updated = isInWishlist
        ? prev.filter((id) => id !== vehicleId)
        : [...prev, vehicleId];
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isInWishlist = useCallback(
    (vehicleId: string) => wishlist.includes(vehicleId),
    [wishlist]
  );

  const clearWishlist = useCallback(() => {
    localStorage.removeItem(WISHLIST_KEY);
    setWishlist([]);
  }, []);

  return {
    wishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    isInWishlist,
    clearWishlist,
  };
};
