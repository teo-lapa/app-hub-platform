'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  ClipboardCheck,
  Video,
  AlertTriangle,
  Calendar,
  Loader2
} from 'lucide-react';
import { BatchCard } from '@/components/controllo-picking/BatchCard';

interface KPIData {
  batchCount: number;
  prelieviCount: number;
  controlliCount: number;
  videoCount: number;
  problemiCount: number;
}

interface Batch {
  id: string;
  batchNumber: string;
  createdAt: string;
  status: string;
  prelieviCount: number;
  controlliCount: number;
  videoCount: number;
  problemiCount: number;
}

interface BatchesResponse {
  batches: Batch[];
  kpis: KPIData;
}

export default function ControlloPickingPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [data, setData] = useState<BatchesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = async (date: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/controllo-picking/batches?date=${date}`);

      if (!response.ok) {
        throw new Error('Failed to fetch batches');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches(selectedDate);
  }, [selectedDate]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const handleBatchClick = (batchId: string) => {
    router.push(`/super-dashboard/controllo-picking/${batchId}`);
  };

  const handleRetry = () => {
    fetchBatches(selectedDate);
  };

  const handleBack = () => {
    router.push('/super-dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">Super Dashboard</span>
              </button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2 text-gray-900">
                <Package className="w-5 h-5" />
                <h1 className="text-xl font-semibold">Controllo Picking</h1>
              </div>
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Caricamento batches...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Errore nel caricamento
              </h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Riprova
              </button>
            </div>
          </div>
        )}

        {/* Success State */}
        {!isLoading && !error && data && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {/* Batch Count */}
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <Package className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {data.kpis.batchCount}
                </div>
                <div className="text-sm text-gray-600">Batch</div>
              </div>

              {/* Prelievi Count */}
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <ClipboardCheck className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {data.kpis.prelieviCount}
                </div>
                <div className="text-sm text-gray-600">Prelievi</div>
              </div>

              {/* Controlli Count */}
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <ClipboardCheck className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {data.kpis.controlliCount}
                </div>
                <div className="text-sm text-gray-600">Controlli</div>
              </div>

              {/* Video Count */}
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <Video className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {data.kpis.videoCount}
                </div>
                <div className="text-sm text-gray-600">Video</div>
              </div>

              {/* Problemi Count */}
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {data.kpis.problemiCount}
                </div>
                <div className="text-sm text-gray-600">Problemi</div>
              </div>
            </div>

            {/* Empty State */}
            {data.batches.length === 0 && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Nessun batch trovato
                  </h3>
                  <p className="text-gray-600">
                    Non ci sono batch per la data selezionata.
                  </p>
                </div>
              </div>
            )}

            {/* Batch List */}
            {data.batches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Lista Batch ({data.batches.length})
                </h2>
                <div className="space-y-4">
                  {data.batches.map((batch) => (
                    <BatchCard
                      key={batch.id}
                      batch={batch}
                      onClick={() => handleBatchClick(batch.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
