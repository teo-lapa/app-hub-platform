'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

// Types
export type PeriodFilter = 'week' | 'month' | 'quarter' | 'year';

export interface VendorInfo {
  id: number;
  name: string;
  revenue: number;
  orders: number;
  customers: number;
}

interface MaestroFiltersContextType {
  // Period filter
  period: PeriodFilter;
  setPeriod: (period: PeriodFilter) => void;

  // Vendor filter
  selectedVendor: VendorInfo | null;
  setSelectedVendor: (vendor: VendorInfo | null) => void;
  clearVendorFilter: () => void;
  isVendorSelected: (vendorId: number) => boolean;

  // Helper
  getPeriodLabel: (period: PeriodFilter) => string;
}

const MaestroFiltersContext = createContext<MaestroFiltersContextType | undefined>(undefined);

export function MaestroFiltersProvider({ children }: { children: React.ReactNode }) {
  // Default period is 'week' as requested
  const [period, setPeriod] = useState<PeriodFilter>('week');
  const [selectedVendor, setSelectedVendor] = useState<VendorInfo | null>(null);

  const clearVendorFilter = useCallback(() => {
    setSelectedVendor(null);
  }, []);

  const isVendorSelected = useCallback((vendorId: number): boolean => {
    return selectedVendor?.id === vendorId;
  }, [selectedVendor]);

  const getPeriodLabel = useCallback((period: PeriodFilter): string => {
    switch (period) {
      case 'week': return 'Settimana';
      case 'month': return 'Mese';
      case 'quarter': return '3 Mesi';
      case 'year': return 'Anno';
    }
  }, []);

  return (
    <MaestroFiltersContext.Provider
      value={{
        period,
        setPeriod,
        selectedVendor,
        setSelectedVendor,
        clearVendorFilter,
        isVendorSelected,
        getPeriodLabel,
      }}
    >
      {children}
    </MaestroFiltersContext.Provider>
  );
}

export function useMaestroFilters() {
  const context = useContext(MaestroFiltersContext);
  if (context === undefined) {
    throw new Error('useMaestroFilters must be used within a MaestroFiltersProvider');
  }
  return context;
}
