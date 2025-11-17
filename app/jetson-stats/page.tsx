'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Activity, TrendingUp, Zap, HardDrive } from 'lucide-react';
import Link from 'next/link';

export default function JetsonStats() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch('/api/jetson/ocr')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error(err));
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/jetson-monitor">
            <button className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
              <Activity className="w-8 h-8" />
              Statistiche Utilizzo
            </h1>
            <p className="text-gray-300 mt-1">Monitoraggio prestazioni Jetson OCR Server</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">

          {/* Uptime */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-green-400" />
              <h3 className="text-lg font-semibold text-green-300">Uptime</h3>
            </div>
            <div className="text-3xl font-bold text-white">
              {stats?.jetson?.uptime ? formatUptime(stats.jetson.uptime) : 'N/A'}
            </div>
            <p className="text-green-200 text-sm mt-2">Server online senza interruzioni</p>
          </div>

          {/* Status */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-6 h-6 text-blue-400" />
              <h3 className="text-lg font-semibold text-blue-300">Status</h3>
            </div>
            <div className="text-3xl font-bold text-white capitalize">
              {stats?.jetson?.status || 'Unknown'}
            </div>
            <p className="text-blue-200 text-sm mt-2">Stato corrente del server</p>
          </div>

          {/* Storage */}
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <HardDrive className="w-6 h-6 text-purple-400" />
              <h3 className="text-lg font-semibold text-purple-300">Storage</h3>
            </div>
            <div className="text-3xl font-bold text-white">
              {stats?.jetson?.storage?.used || 'N/A'}
            </div>
            <p className="text-purple-200 text-sm mt-2">Spazio utilizzato</p>
          </div>
        </div>

        {/* Services Status */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">Servizi Attivi</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats?.jetson?.services && Object.entries(stats.jetson.services)
              .filter(([name]) => name !== 'kimiK2') // Nascondi Kimi K2
              .map(([name, status]: [string, any]) => (
              <div key={name} className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold capitalize">
                    {name === 'tesseract' ? 'Tesseract OCR' : name === 'redis' ? 'Redis Cache' : name}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    status === 'ok' || status === 'configured'
                      ? 'bg-green-500 text-white'
                      : 'bg-red-500 text-white'
                  }`}>
                    {status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-4">Informazioni Sistema</h2>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-gray-300">Versione Server:</span>
              <span className="text-white font-mono">{stats?.jetson?.version || 'N/A'}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-gray-300">Storage Path:</span>
              <span className="text-white font-mono text-sm">{stats?.jetson?.storage?.path || 'N/A'}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-gray-300">Tunnel Status:</span>
              <span className={`font-bold ${
                stats?.tunnel?.status === 'online' ? 'text-green-400' : 'text-red-400'
              }`}>
                {stats?.tunnel?.status || 'N/A'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-gray-300">Tunnel URL:</span>
              <span className="text-white font-mono text-xs truncate max-w-md">
                {stats?.tunnel?.url?.trim() || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-blue-200 text-sm">
            Statistiche aggiornate in tempo reale dal server Jetson Orin Nano
          </p>
        </div>
      </div>
    </div>
  );
}
