'use client';

import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Package,
  Eye,
  Sparkles,
  HelpCircle
} from 'lucide-react';

interface ProductMatch {
  productName: string;
  expectedQuantity: number;
  unit: string;
  seenInVideo: boolean;
  confidence: number;
  observations: string;
  timestampSeconds?: number;
}

interface VideoAnalysisResultProps {
  analysis: {
    success: boolean;
    analysisDate: string;
    videoDurationSeconds: number;
    zoneName: string;
    totalExpectedProducts: number;
    matchedProducts: number;
    unmatchedProducts: number;
    matches: ProductMatch[];
    additionalProductsSeen: string[];
    overallConfidence: number;
    summary: string;
    warnings: string[];
  };
  onClose?: () => void;
}

export default function VideoAnalysisResult({ analysis, onClose }: VideoAnalysisResultProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'matched' | 'unmatched'>('all');

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-green-600 bg-green-100';
    if (confidence >= 0.5) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'Molto alta';
    if (confidence >= 0.7) return 'Alta';
    if (confidence >= 0.5) return 'Media';
    if (confidence >= 0.3) return 'Bassa';
    return 'Molto bassa';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const matchPercentage = analysis.totalExpectedProducts > 0
    ? Math.round((analysis.matchedProducts / analysis.totalExpectedProducts) * 100)
    : 0;

  const filteredMatches = analysis.matches.filter(m => {
    if (filterStatus === 'matched') return m.seenInVideo && m.confidence >= 0.5;
    if (filterStatus === 'unmatched') return !m.seenInVideo || m.confidence < 0.5;
    return true;
  });

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-semibold text-lg">Analisi AI Video</h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-purple-100 text-sm mt-1">
          Zona: {analysis.zoneName} | Durata: {formatDuration(analysis.videoDurationSeconds)}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border-b">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{analysis.matchedProducts}</div>
          <div className="text-xs text-gray-600 flex items-center justify-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            Trovati
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{analysis.unmatchedProducts}</div>
          <div className="text-xs text-gray-600 flex items-center justify-center gap-1">
            <XCircle className="w-3 h-3 text-red-500" />
            Non trovati
          </div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-bold ${matchPercentage >= 70 ? 'text-green-600' : matchPercentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
            {matchPercentage}%
          </div>
          <div className="text-xs text-gray-600 flex items-center justify-center gap-1">
            <Eye className="w-3 h-3" />
            Match
          </div>
        </div>
      </div>

      {/* Confidence Bar */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">Confidenza analisi</span>
          <span className={`text-sm font-medium px-2 py-0.5 rounded ${getConfidenceColor(analysis.overallConfidence)}`}>
            {getConfidenceLabel(analysis.overallConfidence)} ({Math.round(analysis.overallConfidence * 100)}%)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              analysis.overallConfidence >= 0.7 ? 'bg-green-500' :
              analysis.overallConfidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${analysis.overallConfidence * 100}%` }}
          />
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 border-b">
        <p className="text-gray-700 text-sm">{analysis.summary}</p>
      </div>

      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <div className="px-4 py-3 bg-amber-50 border-b">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              {analysis.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Additional Products */}
      {analysis.additionalProductsSeen.length > 0 && (
        <div className="px-4 py-3 bg-blue-50 border-b">
          <div className="flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Prodotti aggiuntivi visti nel video:</strong>
              <ul className="mt-1 ml-4 list-disc">
                {analysis.additionalProductsSeen.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">
          Dettaglio prodotti ({analysis.matches.length})
        </span>
        {showDetails ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {/* Product Details */}
      {showDetails && (
        <div className="border-t">
          {/* Filter */}
          <div className="px-4 py-2 bg-gray-50 border-b flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filterStatus === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Tutti ({analysis.matches.length})
            </button>
            <button
              onClick={() => setFilterStatus('matched')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filterStatus === 'matched'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              Trovati ({analysis.matchedProducts})
            </button>
            <button
              onClick={() => setFilterStatus('unmatched')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filterStatus === 'unmatched'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              Non trovati ({analysis.unmatchedProducts})
            </button>
          </div>

          {/* Product List */}
          <div className="max-h-80 overflow-y-auto">
            {filteredMatches.map((match, index) => (
              <div
                key={index}
                className={`px-4 py-3 border-b last:border-b-0 ${
                  match.seenInVideo && match.confidence >= 0.5
                    ? 'bg-green-50/50'
                    : 'bg-red-50/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {match.seenInVideo && match.confidence >= 0.5 ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">
                        {match.productName}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getConfidenceColor(match.confidence)}`}>
                        {Math.round(match.confidence * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {match.expectedQuantity} {match.unit}
                      </span>
                      {match.timestampSeconds !== undefined && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(match.timestampSeconds)}
                        </span>
                      )}
                    </div>
                    {match.observations && (
                      <p className="mt-1 text-xs text-gray-500 italic">
                        {match.observations}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 text-center">
        Analisi effettuata il {new Date(analysis.analysisDate).toLocaleString('it-IT')}
      </div>
    </div>
  );
}
