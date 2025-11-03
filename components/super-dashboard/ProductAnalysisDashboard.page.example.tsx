// Example Next.js page using ProductAnalysisDashboard
// Path: app/super-dashboard/products/[productId]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProductAnalysisDashboard } from '@/components/super-dashboard';
import { ArrowLeft, Download, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function ProductAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.productId as string;

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  useEffect(() => {
    async function fetchProductAnalysis() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/products/${productId}/analysis?period=${selectedPeriod}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.data) {
          setData(result.data);
        } else {
          throw new Error(result.error || 'Failed to load product analysis');
        }
      } catch (err: any) {
        console.error('Error fetching product analysis:', err);
        setError(err.message || 'Failed to load product analysis');
      } finally {
        setIsLoading(false);
      }
    }

    if (productId) {
      fetchProductAnalysis();
    }
  }, [productId, selectedPeriod]);

  const handleExport = () => {
    // Export functionality
    console.log('Exporting product analysis...');
    // TODO: Implement PDF/Excel export
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-purple-500/20">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/super-dashboard">
                <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-all">
                  <ArrowLeft className="w-4 h-4" />
                  Torna alla Dashboard
                </button>
              </Link>
            </div>

            <div className="flex items-center gap-4">
              {/* Period Selector */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="bg-slate-800/50 border border-slate-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={isLoading}
                >
                  <option value="today">Oggi</option>
                  <option value="week">Questa Settimana</option>
                  <option value="month">Questo Mese</option>
                  <option value="quarter">Questo Trimestre</option>
                  <option value="year">Quest'Anno</option>
                  <option value="custom">Personalizzato</option>
                </select>
              </div>

              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={isLoading || !data}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" />
                Esporta PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Component */}
      <ProductAnalysisDashboard data={data} isLoading={isLoading} error={error} />
    </div>
  );
}

// Alternative: With Suspense and Server Components (App Router)
// Path: app/super-dashboard/products/[productId]/page.tsx

import { Suspense } from 'react';
import { ProductAnalysisDashboard } from '@/components/super-dashboard';

async function getProductAnalysis(productId: string, period: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/products/${productId}/analysis?period=${period}`,
    {
      cache: 'no-store', // Always fetch fresh data
      // or: next: { revalidate: 300 } // Revalidate every 5 minutes
    }
  );

  if (!res.ok) {
    throw new Error('Failed to fetch product analysis');
  }

  const result = await res.json();
  return result.data;
}

export default async function ProductAnalysisServerPage({
  params,
  searchParams,
}: {
  params: { productId: string };
  searchParams: { period?: string };
}) {
  const period = searchParams.period || 'month';

  return (
    <Suspense
      fallback={
        <ProductAnalysisDashboard data={null} isLoading={true} error={null} />
      }
    >
      <ProductAnalysisContent productId={params.productId} period={period} />
    </Suspense>
  );
}

async function ProductAnalysisContent({
  productId,
  period,
}: {
  productId: string;
  period: string;
}) {
  try {
    const data = await getProductAnalysis(productId, period);
    return <ProductAnalysisDashboard data={data} isLoading={false} error={null} />;
  } catch (error: any) {
    return (
      <ProductAnalysisDashboard
        data={null}
        isLoading={false}
        error={error.message || 'Failed to load product analysis'}
      />
    );
  }
}

// Example: With React Query for caching and refetching
import { useQuery } from '@tanstack/react-query';

export function ProductAnalysisWithReactQuery({ productId }: { productId: string }) {
  const {
    data: result,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['productAnalysis', productId],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}/analysis`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  return (
    <div>
      <button
        onClick={() => refetch()}
        className="mb-4 px-4 py-2 bg-purple-600 text-white rounded-lg"
      >
        Aggiorna Dati
      </button>
      <ProductAnalysisDashboard
        data={result?.data || null}
        isLoading={isLoading}
        error={error?.message || null}
      />
    </div>
  );
}

// Example: With period comparison (multiple periods side by side)
export function ProductAnalysisComparisonPage() {
  const [productId] = useState('PROD-001');
  const [period1] = useState('month');
  const [period2] = useState('quarter');

  // Fetch both periods
  const { data: data1, isLoading: loading1 } = useProductAnalysis(productId, period1);
  const { data: data2, isLoading: loading2 } = useProductAnalysis(productId, period2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Confronto Periodi</h1>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Period 1 */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Questo Mese</h2>
            <div className="scale-90 origin-top-left">
              <ProductAnalysisDashboard data={data1} isLoading={loading1} error={null} />
            </div>
          </div>

          {/* Period 2 */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Questo Trimestre</h2>
            <div className="scale-90 origin-top-right">
              <ProductAnalysisDashboard data={data2} isLoading={loading2} error={null} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Custom hook for fetching product analysis
function useProductAnalysis(productId: string, period: string) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/products/${productId}/analysis?period=${period}`);
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [productId, period]);

  return { data, isLoading, error };
}
