'use client';

import { useState } from 'react';
import { OfflineIndicator } from '@/components/maestro/OfflineIndicator';
import { PullToRefresh } from '@/components/maestro/PullToRefresh';
import { useMobileOptimizations } from '@/hooks/useMobileOptimizations';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { Smartphone, Wifi, WifiOff, RefreshCw, Database, Vibrate } from 'lucide-react';

export default function TestMobilePage() {
  const [refreshCount, setRefreshCount] = useState(0);
  const [cacheData, setCacheData] = useState({ test: 'data', timestamp: Date.now() });

  const { isOnline, vibrate } = useMobileOptimizations({
    enableHapticFeedback: true
  });

  const { cachedData, clearCache } = useOfflineCache({
    key: 'test-data',
    data: cacheData
  });

  const handleRefresh = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshCount(prev => prev + 1);
    setCacheData({ test: 'refreshed', timestamp: Date.now() });
  };

  return (
    <>
      <OfflineIndicator />
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="text-center">
              <Smartphone className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Mobile PWA Test
              </h1>
              <p className="text-sm text-slate-400">
                Test mobile optimizations and PWA features
              </p>
            </div>

            {/* Online Status */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isOnline ? (
                    <Wifi className="h-6 w-6 text-green-500" />
                  ) : (
                    <WifiOff className="h-6 w-6 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium text-white">Connection Status</p>
                    <p className="text-sm text-slate-400">
                      {isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isOnline ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {isOnline ? 'Connected' : 'Disconnected'}
                </div>
              </div>
            </div>

            {/* Pull to Refresh */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <RefreshCw className="h-5 w-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-white">Pull to Refresh</h2>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Pull down from the top of the page to trigger refresh
              </p>
              <div className="bg-slate-900 rounded p-4">
                <p className="text-white font-mono">
                  Refresh count: <span className="text-blue-400">{refreshCount}</span>
                </p>
              </div>
            </div>

            {/* Offline Cache */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Database className="h-5 w-5 text-purple-500" />
                <h2 className="text-lg font-semibold text-white">Offline Cache</h2>
              </div>
              <div className="space-y-3">
                <div className="bg-slate-900 rounded p-4">
                  <p className="text-sm text-slate-400 mb-2">Cached Data:</p>
                  <pre className="text-xs text-white font-mono overflow-x-auto">
                    {JSON.stringify(cachedData, null, 2)}
                  </pre>
                </div>
                <button
                  onClick={clearCache}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors min-h-[44px]"
                >
                  Clear Cache
                </button>
              </div>
            </div>

            {/* Haptic Feedback */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Vibrate className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-white">Haptic Feedback</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => vibrate(50)}
                  className="px-4 py-3 bg-slate-900 hover:bg-slate-700 text-white rounded-lg transition-colors min-h-[44px]"
                >
                  Short (50ms)
                </button>
                <button
                  onClick={() => vibrate(200)}
                  className="px-4 py-3 bg-slate-900 hover:bg-slate-700 text-white rounded-lg transition-colors min-h-[44px]"
                >
                  Long (200ms)
                </button>
                <button
                  onClick={() => vibrate([50, 100, 50])}
                  className="px-4 py-3 bg-slate-900 hover:bg-slate-700 text-white rounded-lg transition-colors min-h-[44px] col-span-2"
                >
                  Pattern [50, 100, 50]
                </button>
              </div>
            </div>

            {/* Touch Targets */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Touch Targets (44x44px minimum)
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <button
                    key={i}
                    onClick={() => vibrate(10)}
                    className="aspect-square min-h-[44px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg transition-colors flex items-center justify-center font-bold"
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            {/* Responsive Grid */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Responsive Grid
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {['Mobile: 2', 'Cols', 'Desktop: 4', 'Cols'].map((text, i) => (
                  <div
                    key={i}
                    className="bg-slate-900 rounded p-4 text-center text-sm text-white"
                  >
                    {text}
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
              <h3 className="font-semibold text-blue-400 mb-2">Testing Instructions</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>✓ Pull down from top to refresh</li>
                <li>✓ Toggle airplane mode to test offline</li>
                <li>✓ Test haptic feedback buttons</li>
                <li>✓ Verify 44px minimum touch targets</li>
                <li>✓ Check responsive grid on different sizes</li>
                <li>✓ Install as PWA from browser menu</li>
              </ul>
            </div>
          </div>
        </div>
      </PullToRefresh>
    </>
  );
}
