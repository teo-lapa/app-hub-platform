'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CadenceWithMetadata,
  CreateCadenceRequest,
  UpdateCadenceRequest,
  CadenceFilters,
} from '@/lib/types/supplier-cadence';

// API Response types
interface CadenceListResponse {
  suppliers: CadenceWithMetadata[];
  stats: {
    total_active: number;
    total_inactive: number;
    due_today: number;
    due_this_week: number;
    overdue: number;
  };
  count: number;
}

interface CadenceResponse {
  success: boolean;
  supplier: CadenceWithMetadata;
}

interface DeleteResponse {
  success: boolean;
  message: string;
}

/**
 * Fetch all supplier cadences with optional filters
 */
async function fetchCadences(filters?: CadenceFilters): Promise<CadenceWithMetadata[]> {
  const params = new URLSearchParams();

  if (filters?.is_active !== undefined) {
    params.append('is_active', String(filters.is_active));
  }
  if (filters?.cadence_type) {
    params.append('cadence_type', filters.cadence_type);
  }
  if (filters?.search) {
    params.append('search', filters.search);
  }

  const url = `/api/supplier-cadence${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch cadences');
  }

  const result: CadenceListResponse = await response.json();
  return result.suppliers;
}

/**
 * Fetch single cadence by ID
 */
async function fetchCadenceById(id: number): Promise<CadenceWithMetadata> {
  const response = await fetch(`/api/supplier-cadence/${id}`);

  if (!response.ok) {
    throw new Error('Failed to fetch cadence');
  }

  const result: CadenceResponse = await response.json();
  return result.supplier;
}

/**
 * Create new cadence
 */
async function createCadence(data: CreateCadenceRequest): Promise<CadenceWithMetadata> {
  const response = await fetch('/api/supplier-cadence', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create cadence');
  }

  const result: CadenceResponse = await response.json();
  return result.supplier;
}

/**
 * Update existing cadence
 */
async function updateCadence(
  id: number,
  data: UpdateCadenceRequest
): Promise<CadenceWithMetadata> {
  const response = await fetch(`/api/supplier-cadence/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update cadence');
  }

  const result: CadenceResponse = await response.json();
  return result.supplier;
}

/**
 * Delete cadence (soft delete)
 */
async function deleteCadence(id: number): Promise<DeleteResponse> {
  const response = await fetch(`/api/supplier-cadence/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete cadence');
  }

  return response.json();
}

/**
 * Hook to fetch all cadences with filters
 */
export function useSupplierCadences(filters?: CadenceFilters) {
  return useQuery({
    queryKey: ['supplier-cadences', filters],
    queryFn: () => fetchCadences(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch single cadence by ID
 */
export function useSupplierCadence(id: number) {
  return useQuery({
    queryKey: ['supplier-cadence', id],
    queryFn: () => fetchCadenceById(id),
    enabled: !!id,
  });
}

/**
 * Hook to create new cadence
 */
export function useCreateCadence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCadence,
    onSuccess: () => {
      // Invalidate and refetch cadences list
      queryClient.invalidateQueries({ queryKey: ['supplier-cadences'] });
    },
  });
}

/**
 * Hook to update cadence with optimistic updates
 */
export function useUpdateCadence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCadenceRequest }) =>
      updateCadence(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['supplier-cadences'] });
      await queryClient.cancelQueries({ queryKey: ['supplier-cadence', id] });

      // Snapshot previous values
      const previousCadences = queryClient.getQueryData(['supplier-cadences']);
      const previousCadence = queryClient.getQueryData(['supplier-cadence', id]);

      // Optimistically update
      queryClient.setQueryData(['supplier-cadences'], (old: CadenceWithMetadata[] | undefined) => {
        if (!old) return old;
        return old.map((cadence) =>
          cadence.id === id ? { ...cadence, ...data, updated_at: new Date().toISOString() } : cadence
        );
      });

      return { previousCadences, previousCadence };
    },
    onError: (err, variables, context) => {
      // Revert optimistic update on error
      if (context?.previousCadences) {
        queryClient.setQueryData(['supplier-cadences'], context.previousCadences);
      }
      if (context?.previousCadence) {
        queryClient.setQueryData(['supplier-cadence', variables.id], context.previousCadence);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['supplier-cadences'] });
    },
  });
}

/**
 * Hook to delete cadence
 */
export function useDeleteCadence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCadence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-cadences'] });
    },
  });
}

/**
 * Hook to compute cadence statistics (for dashboard KPIs)
 */
export function useCadenceStats(cadences?: CadenceWithMetadata[]) {
  if (!cadences) {
    return {
      totalActive: 0,
      dueToday: 0,
      dueThisWeek: 0,
      overdue: 0,
    };
  }

  const totalActive = cadences.filter((c) => c.is_active).length;

  const dueToday = cadences.filter(
    (c) => c.is_active && c.days_until_next_order !== null && c.days_until_next_order === 0
  ).length;

  const dueThisWeek = cadences.filter(
    (c) =>
      c.is_active &&
      c.days_until_next_order !== null &&
      c.days_until_next_order >= 0 &&
      c.days_until_next_order <= 7
  ).length;

  const overdue = cadences.filter((c) => c.is_active && c.days_overdue > 0).length;

  return {
    totalActive,
    dueToday,
    dueThisWeek,
    overdue,
  };
}
