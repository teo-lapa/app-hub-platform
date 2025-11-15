'use client';

import { useState, useEffect } from 'react';
import {
  Server,
  HardDrive,
  Cpu,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  FileCheck,
  FileX,
  Clock,
  Zap
} from 'lucide-react';

interface JetsonHealth {
  status: string;
  timestamp: string;
  version: string;
  services: {
    tesseract: string;
    redis: string;
    ollama: string;
  };
  storage: {
    total: string;
    used: string;
    available: string;
    usagePercent: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  metrics: {
    processed: number;
    failed: number;
    pending: number;
  };
  uptime: number;
}

export default function JetsonDashboard() {
  const [health, setHealth] = useState<JetsonHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchHealth = async () => {
    try {
      setError(null);
      const response = await fetch('/api/jetson/ocr');

      if (!response.ok) {
        throw new Error('Jetson offline o non raggiungibile');
      }

      const data = await response.json();
      setHealth(data.jetson);
      setLastUpdate(new Date());
    } catch (err: any) {
      console.error('Error fetching Jetson health:', err);
      setError(err.message);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
      case 'model-missing':
        return 'text-yellow-600 bg-yellow-100';
      case 'error':
      case 'offline':
      case 'unhealthy':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
      case 'healthy':
        return <CheckCircle className="w-5 h-5" />;
      case 'degraded':
      case 'model-missing':
        return <AlertTriangle className="w-5 h-5" />;
      case 'error':
      case 'offline':
      case 'unhealthy':
        return <XCircle className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Caricamento stato Jetson...</p>
        </div>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-900 mb-2">Jetson Offline</h2>
            <p className="text-red-700 mb-4">{error || 'Impossibile connettersi al server Jetson'}</p>
            <button
              onClick={fetchHealth}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Riprova Connessione
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <Server className="w-10 h-10 text-blue-600" />
              Jetson OCR Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              NVIDIA Jetson Orin Nano - Monitoraggio in tempo reale
            </p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${getStatusColor(health.status)}`}>
              {getStatusIcon(health.status)}
              <span className="uppercase">{health.status}</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Ultimo aggiornamento: {lastUpdate.toLocaleTimeString('it-IT')}
            </p>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Uptime Card */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Uptime</h3>
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatUptime(health.uptime)}</p>
            <p className="text-xs text-gray-500 mt-1">Sistema operativo</p>
          </div>

          {/* Documents Processed */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Elaborati</h3>
              <FileCheck className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{health.metrics.processed}</p>
            <p className="text-xs text-gray-500 mt-1">Documenti completati</p>
          </div>

          {/* Failed Documents */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Falliti</h3>
              <FileX className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{health.metrics.failed}</p>
            <p className="text-xs text-gray-500 mt-1">Errori di elaborazione</p>
          </div>

          {/* Pending Documents */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">In Coda</h3>
              <Loader2 className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{health.metrics.pending}</p>
            <p className="text-xs text-gray-500 mt-1">Documenti in attesa</p>
          </div>
        </div>

        {/* System Resources Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Memory Usage */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Cpu className="w-6 h-6 text-purple-600" />
                RAM
              </h3>
              <span className="text-sm font-medium text-gray-600">
                {health.memory.used} MB / {health.memory.total} MB
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
              <div
                className={`h-4 rounded-full transition-all duration-300 ${
                  health.memory.usagePercent > 80
                    ? 'bg-red-500'
                    : health.memory.usagePercent > 60
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${health.memory.usagePercent}%` }}
              />
            </div>

            <div className="flex justify-between text-sm text-gray-600">
              <span>Libera: {health.memory.free} MB</span>
              <span className="font-semibold">{health.memory.usagePercent}%</span>
            </div>
          </div>

          {/* Disk Usage */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <HardDrive className="w-6 h-6 text-indigo-600" />
                Disco
              </h3>
              <span className="text-sm font-medium text-gray-600">
                {health.storage.used} / {health.storage.total}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
              <div
                className={`h-4 rounded-full transition-all duration-300 ${
                  parseInt(health.storage.usagePercent) > 80
                    ? 'bg-red-500'
                    : parseInt(health.storage.usagePercent) > 60
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: health.storage.usagePercent }}
              />
            </div>

            <div className="flex justify-between text-sm text-gray-600">
              <span>Disponibile: {health.storage.available}</span>
              <span className="font-semibold">{health.storage.usagePercent}</span>
            </div>
          </div>
        </div>

        {/* Services Status */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-600" />
            Servizi Attivi
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tesseract OCR */}
            <div className={`p-4 rounded-lg border-2 ${
              health.services.tesseract === 'ok'
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">Tesseract OCR</p>
                  <p className="text-sm text-gray-600">Estrazione testo</p>
                </div>
                <div className={getStatusColor(health.services.tesseract)}>
                  {getStatusIcon(health.services.tesseract)}
                </div>
              </div>
              <div className="mt-2">
                <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(health.services.tesseract)}`}>
                  {health.services.tesseract.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Redis Queue */}
            <div className={`p-4 rounded-lg border-2 ${
              health.services.redis === 'ok'
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">Redis</p>
                  <p className="text-sm text-gray-600">Coda elaborazione</p>
                </div>
                <div className={getStatusColor(health.services.redis)}>
                  {getStatusIcon(health.services.redis)}
                </div>
              </div>
              <div className="mt-2">
                <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(health.services.redis)}`}>
                  {health.services.redis.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Ollama AI */}
            <div className={`p-4 rounded-lg border-2 ${
              health.services.ollama === 'ok'
                ? 'border-green-200 bg-green-50'
                : health.services.ollama === 'disabled'
                ? 'border-gray-200 bg-gray-50'
                : 'border-yellow-200 bg-yellow-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">Ollama AI</p>
                  <p className="text-sm text-gray-600">Classificazione locale</p>
                </div>
                <div className={getStatusColor(health.services.ollama)}>
                  {getStatusIcon(health.services.ollama)}
                </div>
              </div>
              <div className="mt-2">
                <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(health.services.ollama)}`}>
                  {health.services.ollama.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* System Info Footer */}
        <div className="mt-6 bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>Versione: {health.version}</span>
              <span>•</span>
              <span>Timestamp: {new Date(health.timestamp).toLocaleString('it-IT')}</span>
            </div>
            <button
              onClick={fetchHealth}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Aggiorna
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
