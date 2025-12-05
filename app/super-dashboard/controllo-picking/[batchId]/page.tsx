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
  Video,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import ZoneTimeline from '@/components/controllo-picking/ZoneTimeline';
import VideoGallery from '@/components/controllo-picking/VideoGallery';
import ProblemiList from '@/components/controllo-picking/ProblemiList';
import VideoAnalysisResult from '@/components/controllo-picking/VideoAnalysisResult';

type TabType = 'riepilogo' | 'prelievi' | 'controlli' | 'video' | 'problemi';

// Types matching the API response
interface ParsedPrelievo {
  type: 'prelievo';
  zona: string;
  operatore: string;
  data: string;
  tempoTotale: string;
  prodottiPrelevati: number;
  quantitaTotale: number;
  ubicazioniVisitate: number;
}

interface ControlloErrore {
  prodotto: string;
  tipo: string;
  nota: string;
}

interface ParsedControllo {
  type: 'controllo';
  zona: string;
  operatore: string;
  data: string;
  prodottiOk: number;
  prodottiErrore: number;
  prodottiOkList?: string[];
  errori?: ControlloErrore[];
}

interface ParsedVideo {
  type: 'video';
  durata: string;
  data: string;
  operatore: string;
  dimensioneMB: number;
  url: string;
  zona?: string;
}

interface ParsedProblema {
  type: 'problema';
  tipoProblema: string;
  prodotto: string;
  zona: string;
  nota: string;
}

interface TimelineItem {
  time: string;
  event: string;
  user: string;
  type: 'prelievo' | 'controllo' | 'video' | 'problema';
}

interface APIResponse {
  success: boolean;
  batch: {
    id: number;
    name: string;
    state: string;
    scheduled_date: string | null;
  };
  messages: {
    prelievi: ParsedPrelievo[];
    controlli: ParsedControllo[];
    video: ParsedVideo[];
    problemi: ParsedProblema[];
  };
  timeline: TimelineItem[];
  error?: string;
}

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.batchId as string;

  const [activeTab, setActiveTab] = useState<TabType>('riepilogo');
  const [data, setData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Video analysis state
  const [analyzingVideoUrl, setAnalyzingVideoUrl] = useState<string | null>(null);
  const [videoAnalysis, setVideoAnalysis] = useState<any | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const fetchBatchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/controllo-picking/batch/${batchId}`);
      const result: APIResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Errore nel caricamento dei dati del batch');
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatchData();
  }, [batchId]);

  // Handler for video analysis
  const handleAnalyzeVideo = async (video: { url: string; zona?: string }) => {
    if (!data) return;

    setAnalyzingVideoUrl(video.url);
    setVideoAnalysis(null);
    setAnalysisError(null);

    try {
      // Build product list from controlli data for the video's zone
      // We use the products that were controlled in this zone
      const controllo = data.messages.controlli.find(c =>
        c.zona.toLowerCase() === (video.zona || '').toLowerCase()
      );

      // Build expected products list from prodottiOkList
      const products = (controllo?.prodottiOkList || []).map((name, i) => ({
        productId: i,
        productName: name,
        quantity: 1,
        unit: 'PZ',
        customers: [],
      }));

      // Add products from errors too
      (controllo?.errori || []).forEach((err, i) => {
        products.push({
          productId: products.length + i,
          productName: err.prodotto,
          quantity: 1,
          unit: 'PZ',
          customers: [],
        });
      });

      if (products.length === 0) {
        setAnalysisError('Nessun prodotto trovato per questa zona. Impossibile analizzare il video.');
        setAnalyzingVideoUrl(null);
        return;
      }

      console.log(`[VideoAnalysis] Analyzing video for zone ${video.zona} with ${products.length} products`);

      const response = await fetch('/api/controllo-picking/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: video.url,
          zoneName: video.zona || 'Non specificata',
          products,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Errore durante l\'analisi');
      }

      setVideoAnalysis(result.analysis);
    } catch (err) {
      console.error('[VideoAnalysis] Error:', err);
      setAnalysisError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setAnalyzingVideoUrl(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const parseTempoToMinutes = (tempo: string): number => {
    if (!tempo) return 0;
    const hoursMatch = tempo.match(/(\d+)h/);
    const minutesMatch = tempo.match(/(\d+)m/);
    const secondsMatch = tempo.match(/(\d+)s/);
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
    const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
    const seconds = secondsMatch ? parseInt(secondsMatch[1]) : 0;
    return hours * 60 + minutes + Math.round(seconds / 60);
  };

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getStats = () => {
    if (!data) return null;
    const { messages } = data;

    const operatorsSet = new Set<string>();
    messages.prelievi.forEach(p => p.operatore && operatorsSet.add(p.operatore));
    messages.controlli.forEach(c => c.operatore && operatorsSet.add(c.operatore));
    messages.video.forEach(v => v.operatore && operatorsSet.add(v.operatore));

    let tempoTotale = 0;
    messages.prelievi.forEach(p => {
      if (p.tempoTotale) {
        tempoTotale += parseTempoToMinutes(p.tempoTotale);
      }
    });

    return {
      prelievi_count: messages.prelievi.length,
      controlli_count: messages.controlli.length,
      video_count: messages.video.length,
      problemi_count: messages.problemi.length,
      operatori: Array.from(operatorsSet),
      tempo_totale_minuti: tempoTotale,
    };
  };

  // Calculate total problems count (from both problemi messages and control errors)
  const problemiCount = data
    ? (data.messages.problemi.length +
       data.messages.controlli.reduce((acc, c) => acc + (c.errori?.length || 0), 0))
    : 0;

  const tabs: Array<{ key: TabType; label: string; count?: number }> = [
    { key: 'riepilogo', label: 'Riepilogo' },
    { key: 'prelievi', label: 'Prelievi', count: data?.messages.prelievi.length },
    { key: 'controlli', label: 'Controlli', count: data?.messages.controlli.length },
    { key: 'video', label: 'Video', count: data?.messages.video.length },
    { key: 'problemi', label: 'Problemi', count: problemiCount },
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

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Nessun dato disponibile</p>
        </div>
      </div>
    );
  }

  const stats = getStats();
  const { batch, messages, timeline } = data;

  const videosForGallery = messages.video.map(v => ({
    url: v.url,
    durata: v.durata,
    operatore: v.operatore,
    data: new Date(v.data),
    dimensioneMB: v.dimensioneMB,
    zona: v.zona || '',
  }));

  // Combine problemi from dedicated messages AND errors extracted from controlli
  const allProblemi = [
    // Original problemi messages
    ...messages.problemi.map(p => ({
      tipoProblema: p.tipoProblema,
      prodotto: p.prodotto,
      zona: p.zona,
      nota: p.nota,
    })),
    // Errors extracted from controlli
    ...messages.controlli.flatMap(c =>
      (c.errori || []).map(err => ({
        tipoProblema: err.tipo,
        prodotto: err.prodotto,
        zona: c.zona,
        nota: err.nota,
      }))
    ),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
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
              {batch.name}
            </h1>
            <div className="flex items-center gap-3 text-gray-600">
              <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-medium text-sm">
                {batch.state}
              </span>
              <span>{formatDate(batch.scheduled_date)}</span>
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
        {activeTab === 'riepilogo' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.prelievi_count}</div>
                    <div className="text-sm text-gray-600">Prelievi</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.controlli_count}</div>
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
                    <div className="text-2xl font-bold text-gray-900">{stats.operatori.length}</div>
                    <div className="text-sm text-gray-600">Operatori</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {stats.operatori.slice(0, 3).join(', ')}{stats.operatori.length > 3 ? '...' : ''}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Clock className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{formatDuration(stats.tempo_totale_minuti)}</div>
                    <div className="text-sm text-gray-600">Tempo Totale</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Timeline Attività</h2>
              {timeline.length > 0 ? (
                <ZoneTimeline timeline={timeline} />
              ) : (
                <p className="text-gray-500 text-center py-8">Nessuna attività registrata</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'prelievi' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Prelievi Completati</h2>
            {messages.prelievi.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Nessun prelievo registrato</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.prelievi.map((prelievo, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <MapPin className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{prelievo.zona}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <User className="w-4 h-4" />
                            <span>{prelievo.operatore}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{prelievo.tempoTotale || '--'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Prodotti:</span>
                        <span className="ml-2 font-semibold text-gray-900">{prelievo.prodottiPrelevati}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Quantità:</span>
                        <span className="ml-2 font-semibold text-gray-900">{prelievo.quantitaTotale}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Ubicazioni:</span>
                        <span className="ml-2 font-semibold text-gray-900">{prelievo.ubicazioniVisitate}</span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {prelievo.data ? new Date(prelievo.data).toLocaleString('it-IT') : '--'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'controlli' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Controlli Effettuati</h2>
            {messages.controlli.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Nessun controllo registrato</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.controlli.map((controllo, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <MapPin className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{controllo.zona}</h3>
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
                          <div className="text-2xl font-bold text-green-600">{controllo.prodottiOk}</div>
                          <div className="text-xs text-gray-600">Articoli OK</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <div>
                          <div className="text-2xl font-bold text-red-600">{controllo.prodottiErrore}</div>
                          <div className="text-xs text-gray-600">Errori</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${controllo.prodottiOk + controllo.prodottiErrore > 0
                              ? (controllo.prodottiOk / (controllo.prodottiOk + controllo.prodottiErrore)) * 100
                              : 0}%`,
                          }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {controllo.data ? new Date(controllo.data).toLocaleString('it-IT') : '--'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'video' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Video Registrati</h2>
              {messages.video.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Video className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>Nessun video registrato</p>
                </div>
              ) : (
                <VideoGallery
                  videos={videosForGallery}
                  batchName={batch.name}
                  onAnalyzeVideo={handleAnalyzeVideo}
                  analyzingVideoUrl={analyzingVideoUrl}
                />
              )}
            </div>

            {/* Analysis Error */}
            {analysisError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Errore Analisi</span>
                </div>
                <p className="text-red-600 mt-2">{analysisError}</p>
                <button
                  onClick={() => setAnalysisError(null)}
                  className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Chiudi
                </button>
              </div>
            )}

            {/* Analysis in Progress */}
            {analyzingVideoUrl && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                  <div>
                    <p className="font-medium text-purple-900">Analisi AI in corso...</p>
                    <p className="text-sm text-purple-700 mt-1">
                      Gemini sta analizzando il video per identificare i prodotti. Questo potrebbe richiedere 1-2 minuti.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Analysis Results */}
            {videoAnalysis && (
              <VideoAnalysisResult
                analysis={videoAnalysis}
                onClose={() => setVideoAnalysis(null)}
              />
            )}
          </div>
        )}

        {activeTab === 'problemi' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <ProblemiList problemi={allProblemi} />
          </div>
        )}
      </div>
    </div>
  );
}
