'use client';

import { Package, User, Clock, Video, AlertTriangle, CheckCircle } from 'lucide-react';

interface BatchCardProps {
  batch: {
    id: number;
    name: string;
    state: string;
    scheduled_date: string;
    picking_count: number;
    move_line_count: number;
    stats: {
      prelievi_count: number;
      controlli_count: number;
      video_count: number;
      problemi_count: number;
      operatori: string[];
      tempo_totale_minuti: number;
    };
  };
  onClick?: () => void;
}

export default function BatchCard({ batch, onClick }: BatchCardProps) {
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const preleviProgress = batch.picking_count > 0
    ? Math.round((batch.stats.prelievi_count / batch.picking_count) * 100)
    : 0;

  const controlliProgress = batch.picking_count > 0
    ? Math.round((batch.stats.controlli_count / batch.picking_count) * 100)
    : 0;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-md p-6 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : ''
      }`}
    >
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-gray-900 mb-1">{batch.name}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="inline-block px-2 py-1 rounded-full bg-blue-100 text-blue-800 font-medium">
            {batch.state}
          </span>
          <span>{formatDate(batch.scheduled_date)}</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          <div>
            <div className="text-sm text-gray-600">Righe</div>
            <div className="text-lg font-semibold text-gray-900">{batch.move_line_count}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-green-600" />
          <div>
            <div className="text-sm text-gray-600">Operatori</div>
            <div className="text-lg font-semibold text-gray-900">{batch.stats.operatori.length}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-600" />
          <div>
            <div className="text-sm text-gray-600">Tempo</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatDuration(batch.stats.tempo_totale_minuti)}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Indicators */}
      <div className="space-y-3 mb-4">
        {/* Prelievi Progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Prelievi</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {batch.stats.prelievi_count}/{batch.picking_count} zone
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${preleviProgress}%` }}
            />
          </div>
        </div>

        {/* Controlli Progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              <span>Controlli</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {batch.stats.controlli_count}/{batch.picking_count} zone
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${controlliProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Video and Problemi Counts */}
      <div className="flex items-center gap-4 pt-3 border-t border-gray-200">
        <div className="flex items-center gap-2 text-sm">
          <Video className="w-5 h-5 text-purple-600" />
          <span className="font-medium text-gray-900">{batch.stats.video_count}</span>
          <span className="text-gray-600">video</span>
        </div>

        <div
          className={`flex items-center gap-2 text-sm ${
            batch.stats.problemi_count > 0 ? 'text-red-600' : 'text-gray-600'
          }`}
        >
          <AlertTriangle
            className={`w-5 h-5 ${
              batch.stats.problemi_count > 0 ? 'text-red-600' : 'text-gray-400'
            }`}
          />
          <span className="font-medium">{batch.stats.problemi_count}</span>
          <span>problemi</span>
        </div>
      </div>
    </div>
  );
}
