// Quick test file for ProductAnalysisDashboard
// You can copy this into a test page to quickly verify the component

'use client';

import { useState } from 'react';
import { ProductAnalysisDashboard } from './ProductAnalysisDashboard';
import { generateMockProductData, MOCK_SCENARIOS } from './ProductAnalysisDashboard.mock';

export default function ProductAnalysisTestPage() {
  const [scenario, setScenario] = useState<'optimal' | 'critical' | 'normal' | 'loading' | 'error'>(
    'normal'
  );

  // Generate data based on selected scenario
  const getData = () => {
    switch (scenario) {
      case 'optimal':
        return MOCK_SCENARIOS.optimal();
      case 'critical':
        return MOCK_SCENARIOS.critical();
      case 'normal':
        return MOCK_SCENARIOS.normal();
      case 'loading':
        return null;
      case 'error':
        return null;
      default:
        return generateMockProductData();
    }
  };

  const data = getData();
  const isLoading = scenario === 'loading';
  const error = scenario === 'error' ? 'Errore di test: impossibile caricare i dati' : null;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Test Controls */}
      <div className="sticky top-0 z-50 bg-slate-800 border-b border-slate-700 p-4">
        <div className="max-w-[1800px] mx-auto">
          <h1 className="text-2xl font-bold text-white mb-4">
            ProductAnalysisDashboard - Test Page
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-white font-semibold">Test Scenario:</span>
            <button
              onClick={() => setScenario('optimal')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                scenario === 'optimal'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Optimal (Verde)
            </button>
            <button
              onClick={() => setScenario('normal')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                scenario === 'normal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Normal (Blu)
            </button>
            <button
              onClick={() => setScenario('critical')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                scenario === 'critical'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Critical (Rosso)
            </button>
            <button
              onClick={() => setScenario('loading')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                scenario === 'loading'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Loading
            </button>
            <button
              onClick={() => setScenario('error')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                scenario === 'error'
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Error
            </button>
          </div>

          {/* Scenario Description */}
          <div className="mt-4 p-3 bg-slate-700 rounded-lg">
            <p className="text-sm text-slate-300">
              {scenario === 'optimal' && (
                <>
                  <strong className="text-green-400">Scenario Ottimale:</strong> Stock alto (180
                  pz), margini eccellenti (40%+), trend positivi, nessun riordino necessario.
                </>
              )}
              {scenario === 'normal' && (
                <>
                  <strong className="text-blue-400">Scenario Normale:</strong> Stock adeguato (120
                  pz), margini buoni (40%), situazione stabile.
                </>
              )}
              {scenario === 'critical' && (
                <>
                  <strong className="text-red-400">Scenario Critico:</strong> Stock basso (35 pz),
                  sotto punto di riordino, necessario ordine urgente.
                </>
              )}
              {scenario === 'loading' && (
                <>
                  <strong className="text-purple-400">Loading State:</strong> Simula il caricamento
                  iniziale dei dati.
                </>
              )}
              {scenario === 'error' && (
                <>
                  <strong className="text-orange-400">Error State:</strong> Simula un errore nel
                  caricamento dei dati.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Component Under Test */}
      <ProductAnalysisDashboard data={data} isLoading={isLoading} error={error} />

      {/* Debug Info (Optional) */}
      {data && (
        <div className="max-w-[1800px] mx-auto px-6 py-8">
          <details className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <summary className="text-white font-bold cursor-pointer hover:text-purple-400 transition-colors">
              Debug: Raw Data (Click to expand)
            </summary>
            <pre className="mt-4 text-xs text-slate-300 overflow-auto max-h-96">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

// Alternative: Simple inline test (copy-paste into any page)
export function QuickTest() {
  return (
    <ProductAnalysisDashboard
      data={generateMockProductData()}
      isLoading={false}
      error={null}
    />
  );
}

// Test with all scenarios sequentially
export function AllScenariosTest() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const scenarios = [
    { name: 'Optimal', data: MOCK_SCENARIOS.optimal() },
    { name: 'Normal', data: MOCK_SCENARIOS.normal() },
    { name: 'Critical', data: MOCK_SCENARIOS.critical() },
  ];

  const current = scenarios[currentIndex];

  return (
    <div>
      <div className="bg-slate-800 p-4 text-center">
        <h2 className="text-white text-xl font-bold mb-4">
          Scenario {currentIndex + 1}/{scenarios.length}: {current.name}
        </h2>
        <button
          onClick={() => setCurrentIndex((prev) => (prev + 1) % scenarios.length)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-semibold"
        >
          Next Scenario →
        </button>
      </div>
      <ProductAnalysisDashboard data={current.data} isLoading={false} error={null} />
    </div>
  );
}
