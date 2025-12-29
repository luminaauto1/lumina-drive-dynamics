import { useState, useCallback } from 'react';

const MAX_COMPARE = 3;

export const useCompare = () => {
  const [compareList, setCompareList] = useState<string[]>([]);

  const addToCompare = useCallback((vehicleId: string) => {
    setCompareList((prev) => {
      if (prev.includes(vehicleId)) return prev;
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, vehicleId];
    });
  }, []);

  const removeFromCompare = useCallback((vehicleId: string) => {
    setCompareList((prev) => prev.filter((id) => id !== vehicleId));
  }, []);

  const toggleCompare = useCallback((vehicleId: string) => {
    setCompareList((prev) => {
      if (prev.includes(vehicleId)) {
        return prev.filter((id) => id !== vehicleId);
      }
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, vehicleId];
    });
  }, []);

  const isInCompare = useCallback(
    (vehicleId: string) => compareList.includes(vehicleId),
    [compareList]
  );

  const clearCompare = useCallback(() => {
    setCompareList([]);
  }, []);

  const canAddMore = compareList.length < MAX_COMPARE;

  return {
    compareList,
    addToCompare,
    removeFromCompare,
    toggleCompare,
    isInCompare,
    clearCompare,
    canAddMore,
    maxCompare: MAX_COMPARE,
  };
};
