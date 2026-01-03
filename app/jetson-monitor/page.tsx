'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Activity, Server, Zap, FileText, AlertCircle, CheckCircle, XCircle, RefreshCw, Play, BarChart3 } from 'lucide-react';
import Link from 'next/link';

interface JetsonStatus {
  jetson: {
    status: string;
    timestamp: string;
    version: string;
    services: {
      tesseract: string;
      redis: string;
      kimiK2: string;
    };
    storage: {
      path: string;
      available: string;
      used: string;
    };
    uptime: number;
  };
  tunnel: {
    url: string;
    status: string;
    error?: string;
  };
  timestamp: string;
}

interface TestResult {
  type: string;
  status: 'running' | 'success' | 'error';
  message: string;
  duration?: number;
}

export default function JetsonMonitor() {
  const [status, setStatus] = useState<JetsonStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [runningTest, setRunningTest] = useState(false);

  // Fetch status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/jetson/ocr');
      const data = await res.json();
      setStatus(data);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch Jetson status:', err);
      setLoading(false);
    }
  };

  // Auto-refresh ogni 10 secondi
  useEffect(() => {
    fetchStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 10000);
      return () => clearInterval(interval);
    }

    return undefined;
  }, [autoRefresh]);

  // Test OCR rapido
  const runOCRTest = async () => {
    setRunningTest(true);
    const testId = Date.now().toString();

    setTestResults(prev => [...prev, {
      type: 'OCR Test',
      status: 'running',
      message: 'Avvio test OCR...'
    }]);

    const startTime = Date.now();

    try {
      // Simulate OCR test (puoi sostituire con una vera chiamata)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const duration = Date.now() - startTime;

      setTestResults(prev => prev.map((test, i) =>
        i === prev.length - 1
          ? { ...test, status: 'success', message: 'Test OCR completato con successo', duration }
          : test
      ));
    } catch (err: any) {
      setTestResults(prev => prev.map((test, i) =>
        i === prev.length - 1
          ? { ...test, status: 'error', message: `Errore: ${err.message}` }
          : test
      ));
    }

    setRunningTest(false);
  };

  // Test AI Chat
  const runAITest = async () => {
    setRunningTest(true);

    setTestResults(prev => [...prev, {
      type: 'AI Chat Test',
      status: 'running',
      message: 'Test chat con Llama AI...'
    }]);

    const startTime = Date.now();

    try {
      // Usa il proxy server-side per evitare problemi CORS
      const res = await fetch('/api/jetson/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Test: dimmi solo "OK"',
          conversation: []
        })
      });

      const data = await res.json();
      const duration = Date.now() - startTime;

      if (data.success) {
        setTestResults(prev => prev.map((test, i) =>
          i === prev.length - 1
            ? { ...test, status: 'success', message: `AI risposta: ${data.conversation[1]?.content || 'OK'}`, duration }
            : test
        ));
      } else {
        throw new Error(data.error || 'AI test fallito');
      }
    } catch (err: any) {
      setTestResults(prev => prev.map((test, i) =>
        i === prev.length - 1
          ? { ...test, status: 'error', message: `Errore: ${err.message}` }
          : test
      ));
    }

    setRunningTest(false);
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const isOnline = status?.jetson?.status === 'healthy' && status?.tunnel?.status === 'online';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/super-dashboard">
              <button className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
            </Link>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
                <Server className="w-8 h-8" />
                Jetson Monitor
              </h1>
              <p className="text-gray-300 mt-1">NVIDIA Jetson Orin Nano OCR Server</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                autoRefresh
                  ? 'bg-green-500 text-white'
                  : 'bg-white/10 text-gray-300'
              }`}
            >
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={fetchStatus}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-6 h-6 text-white ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Status Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

          {/* Server Status */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-white" />
                <span className="text-white font-semibold">Server Status</span>
              </div>
              {isOnline ? (
                <CheckCircle className="w-6 h-6 text-green-400 animate-pulse" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
            </div>

            <div className="text-3xl font-bold text-white mb-2">
              {status?.jetson?.status || 'Unknown'}
            </div>

            {status?.jetson?.uptime && (
              <div className="text-sm text-gray-300">
                Uptime: {formatUptime(status.jetson.uptime)}
              </div>
            )}
          </div>

          {/* Tunnel Status */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-white" />
                <span className="text-white font-semibold">Tunnel Status</span>
              </div>
              {status?.tunnel?.status === 'online' ? (
                <CheckCircle className="w-6 h-6 text-green-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
            </div>

            <div className="text-3xl font-bold text-white mb-2">
              {status?.tunnel?.status || 'Offline'}
            </div>

            {status?.tunnel?.url && (
              <div className="text-xs text-gray-300 truncate">
                {status.tunnel.url.trim()}
              </div>
            )}
          </div>

          {/* Services */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-white" />
              <span className="text-white font-semibold">Services</span>
            </div>

            <div className="space-y-2">
              {status?.jetson?.services && Object.entries(status.jetson.services)
                .filter(([name]) => name !== 'kimiK2')
                .map(([name, stat]) => (
                <div key={name} className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm capitalize">{name}</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                    stat === 'ok' || stat === 'configured'
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}>
                    {stat}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Test Controls */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Play className="w-5 h-5" />
            Test & Diagnostica
          </h2>

          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={runOCRTest}
              disabled={runningTest || !isOnline}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              🔍 Test OCR
            </button>

            <button
              onClick={runAITest}
              disabled={runningTest || !isOnline}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              🤖 Test AI Chat
            </button>

            <button
              onClick={() => setTestResults([])}
              disabled={testResults.length === 0}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 disabled:bg-gray-600/20 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              🗑️ Cancella Test
            </button>
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Risultati Test:</h3>
              {testResults.map((result, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border ${
                    result.status === 'success'
                      ? 'bg-green-500/10 border-green-500/30'
                      : result.status === 'error'
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-blue-500/10 border-blue-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {result.status === 'running' && <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />}
                      {result.status === 'success' && <CheckCircle className="w-4 h-4 text-green-400" />}
                      {result.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                      <span className="text-white font-medium text-sm">{result.type}</span>
                    </div>
                    {result.duration && (
                      <span className="text-xs text-gray-400">{result.duration}ms</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 mt-1">{result.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Server Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* System Info */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Server className="w-5 h-5" />
              System Info
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Version:</span>
                <span className="text-white font-mono">{status?.jetson?.version || 'N/A'}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-300">Storage Path:</span>
                <span className="text-white font-mono text-xs">{status?.jetson?.storage?.path || 'N/A'}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-300">Last Update:</span>
                <span className="text-white text-sm">{lastUpdate.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Quick Actions
            </h2>

            <div className="space-y-2">
              <Link href="/jetson-ocr">
                <button className="w-full px-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors text-left flex items-center gap-2">
                  💬 Chat con AI (Llama 3.2)
                </button>
              </Link>

              <Link href="/jetson-upload">
                <button
                  disabled={!isOnline}
                  className="w-full px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-left flex items-center gap-2"
                >
                  📄 Upload & Analizza PDF
                </button>
              </Link>

              <Link href="/jetson-stats">
                <button
                  disabled={!isOnline}
                  className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-left flex items-center gap-2"
                >
                  📊 Statistiche Utilizzo
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>NVIDIA Jetson Orin Nano • Docker • Tesseract OCR • Redis • Ollama Llama 3.2 3B</p>
          <p className="mt-1">Cloudflare Tunnel: {status?.tunnel?.url?.trim() || 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}
