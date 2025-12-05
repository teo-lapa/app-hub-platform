'use client';

import { AlertTriangle, Package, MapPin } from 'lucide-react';
import { useState } from 'react';

interface ProblemiListProps {
  problemi: Array<{
    tipoProblema: string;
    prodotto: string;
    zona: string;
    nota: string;
  }>;
}

export default function ProblemiList({ problemi }: ProblemiListProps) {
  const [sortBy, setSortBy] = useState<'zona' | 'tipo'>('zona');

  const sortedProblemi = [...problemi].sort((a, b) => {
    if (sortBy === 'zona') {
      return a.zona.localeCompare(b.zona);
    } else {
      return a.tipoProblema.localeCompare(b.tipoProblema);
    }
  });

  // Group by zone for better visualization
  const groupedByZone = sortedProblemi.reduce((acc, problema) => {
    if (!acc[problema.zona]) {
      acc[problema.zona] = [];
    }
    acc[problema.zona].push(problema);
    return acc;
  }, {} as Record<string, typeof problemi>);

  if (problemi.length === 0) {
    return (
      <div className="text-center py-12 bg-green-50 rounded-lg border-2 border-dashed border-green-200">
        <AlertTriangle className="w-12 h-12 text-green-400 mx-auto mb-3" />
        <p className="text-green-700 font-medium">Nessun problema rilevato</p>
        <p className="text-green-600 text-sm mt-1">Tutti i controlli sono stati completati con successo</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with sort controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Problemi Rilevati ({problemi.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Ordina per:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'zona' | 'tipo')}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="zona">Zona</option>
            <option value="tipo">Tipo Problema</option>
          </select>
        </div>
      </div>

      {/* Problemi List */}
      {sortBy === 'zona' ? (
        // Grouped by zone
        <div className="space-y-4">
          {Object.entries(groupedByZone).map(([zona, problemiInZona]) => (
            <div key={zona} className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <h4 className="font-semibold text-gray-700">Zona {zona}</h4>
                <span className="text-sm text-gray-500">({problemiInZona.length})</span>
              </div>
              <div className="space-y-2 ml-6">
                {problemiInZona.map((problema, index) => (
                  <ProblemaCard key={index} problema={problema} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Simple list sorted by type
        <div className="space-y-2">
          {sortedProblemi.map((problema, index) => (
            <ProblemaCard key={index} problema={problema} showZona />
          ))}
        </div>
      )}
    </div>
  );
}

function ProblemaCard({
  problema,
  showZona = false,
}: {
  problema: {
    tipoProblema: string;
    prodotto: string;
    zona: string;
    nota: string;
  };
  showZona?: boolean;
}) {
  const getSeverityColor = (tipo: string) => {
    const lowerTipo = tipo.toLowerCase();
    if (lowerTipo.includes('critico') || lowerTipo.includes('grave')) {
      return 'bg-red-100 border-red-300 text-red-900';
    } else if (lowerTipo.includes('medio') || lowerTipo.includes('attenzione')) {
      return 'bg-amber-100 border-amber-300 text-amber-900';
    } else {
      return 'bg-yellow-100 border-yellow-300 text-yellow-900';
    }
  };

  return (
    <div
      className={`rounded-lg border-l-4 p-4 ${getSeverityColor(problema.tipoProblema)}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-sm uppercase tracking-wide">
              {problema.tipoProblema}
            </span>
            {showZona && (
              <>
                <span className="text-gray-400">•</span>
                <div className="flex items-center gap-1 text-sm">
                  <MapPin className="w-3 h-3" />
                  <span>Zona {problema.zona}</span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4" />
            <span className="font-medium">{problema.prodotto}</span>
          </div>
          {problema.nota && (
            <div className="mt-2 text-sm opacity-90">
              <strong>Nota:</strong> {problema.nota}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
