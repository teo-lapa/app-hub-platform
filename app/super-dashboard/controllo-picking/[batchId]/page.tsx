'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  User,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import ZoneTimeline from '@/components/controllo-picking/ZoneTimeline';
import VideoGallery from '@/components/controllo-picking/VideoGallery';
import ProblemiList from '@/components/controllo-picking/ProblemiList';

type TabType = 'riepilogo' | 'prelievi' | 'controlli' | 'video' | 'problemi';

interface Prelievo {
  zona: string;
  operatore: string;
  tempoMinuti: number;
  prodotti: number;
  ubicazioni: string[];
  timestamp: string;
}

interface Controllo {
  zona: string;
  operatore: string;
  articoliOk: number;
  articoliErrore: number;
  timestamp: string;
}

interface BatchData {
  id: number;
  name: string;
  scheduled_date: string;
  state: string;
  timeline: Array<{
    time: string;
    event: string;
    user: string;
    type: 'prelievo' | 'controllo' | 'video' | 'problema';
  }>;
  stats: {
    prelievi_count: number;
    controlli_count: number;
    video_count: number;
    problemi_count: number;
    operatori: string[];
    tempo_totale_minuti: number;
    zone_completate: number;
    zone_totali: number;
  };
  prelievi: Prelievo[];
  controlli: Controllo[];
  videos: Array<{
    url: string;
    durata: string;
    operatore: string;
    data: Date;
    dimensioneMB: number;
  }>;
  problemi: Array<{
    tipoProblema: string;
    prodotto: string;
    zona: string;
    nota: string;
  }>;
}

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.batchId as string;

  const [activeTab, setActiveTab] = useState<TabType>('riepilogo');
  const [batchData, setBatchData] = useState<BatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/controllo-picking/batch/${batchId}`);

      if (!response.ok) {
        throw new Error('Errore nel caricamento dei dati del batch');
      }

      const data = await response.json();
      setBatchData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatchData();
  }, [batchId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const tabs: Array<{ key: TabType; label: string; count?: number }> = [
    { key: 'riepilogo', label: 'Riepilogo' },
    { key: 'prelievi', label: 'Prelievi', count: batchData?.prelievi.length },
    { key: 'controlli', label: 'Controlli', count: batchData?.controlli.length },
    { key: 'video', label: 'Video', count: batchData?.stats.video_count },
    { key: 'problemi', label: 'Problemi', count: batchData?.stats.problemi_count },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Caricamento dati del batch...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Errore</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={fetchBatchData}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Riprova
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!batchData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Nessun dato disponibile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Back Button and Title */}
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Indietro</span>
            </button>
          </div>

          <div className="mb-4">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {batchData.name}
            </h1>
            <div className="flex items-center gap-3 text-gray-600">
              <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-medium text-sm">
                {batchData.state}
              </span>
              <span>{formatDate(batchData.scheduled_date)}</span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      activeTab === tab.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'riepilogo' && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {batchData.stats.prelievi_count}
                    </div>
                    <div className="text-sm text-gray-600">Prelievi</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {batchData.stats.zone_completate}/{batchData.stats.zone_totali} zone
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {batchData.stats.controlli_count}
                    </div>
                    <div className="text-sm text-gray-600">Controlli</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <User className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {batchData.stats.operatori.length}
                    </div>
                    <div className="text-sm text-gray-600">Operatori</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {batchData.stats.operatori.join(', ')}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Clock className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatDuration(batchData.stats.tempo_totale_minuti)}
                    </div>
                    <div className="text-sm text-gray-600">Tempo Totale</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Timeline Attività
              </h2>
              <ZoneTimeline timeline={batchData.timeline} />
            </div>
          </div>
        )}

        {activeTab === 'prelievi' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Prelievi Completati
            </h2>
            {batchData.prelievi.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Nessun prelievo registrato</p>
              </div>
            ) : (
              <div className="space-y-4">
                {batchData.prelievi.map((prelievo, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <MapPin className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            Zona {prelievo.zona}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <User className="w-4 h-4" />
                            <span>{prelievo.operatore}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{formatDuration(prelievo.tempoMinuti)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Prodotti:</span>
                        <span className="ml-2 font-semibold text-gray-900">
                          {prelievo.prodotti}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Ubicazioni:</span>
                        <span className="ml-2 font-semibold text-gray-900">
                          {prelievo.ubicazioni.length}
                        </span>
                      </div>
                    </div>

                    {prelievo.ubicazioni.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-600 mb-2">Ubicazioni:</div>
                        <div className="flex flex-wrap gap-2">
                          {prelievo.ubicazioni.map((ubicazione, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono"
                            >
                              {ubicazione}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-2 text-xs text-gray-500">
                      {new Date(prelievo.timestamp).toLocaleString('it-IT')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'controlli' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Controlli Effettuati
            </h2>
            {batchData.controlli.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Nessun controllo registrato</p>
              </div>
            ) : (
              <div className="space-y-4">
                {batchData.controlli.map((controllo, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <MapPin className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            Zona {controllo.zona}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <User className="w-4 h-4" />
                            <span>{controllo.operatore}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <div>
                          <div className="text-2xl font-bold text-green-600">
                            {controllo.articoliOk}
                          </div>
                          <div className="text-xs text-gray-600">Articoli OK</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <div>
                          <div className="text-2xl font-bold text-red-600">
                            {controllo.articoliErrore}
                          </div>
                          <div className="text-xs text-gray-600">Errori</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${
                              controllo.articoliOk + controllo.articoliErrore > 0
                                ? (controllo.articoliOk /
                                    (controllo.articoliOk + controllo.articoliErrore)) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {new Date(controllo.timestamp).toLocaleString('it-IT')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'video' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Video Registrati
            </h2>
            <VideoGallery videos={batchData.videos} />
          </div>
        )}

        {activeTab === 'problemi' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <ProblemiList problemi={batchData.problemi} />
          </div>
        )}
      </div>
    </div>
  );
}
