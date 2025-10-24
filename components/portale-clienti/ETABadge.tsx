'use client';

import { Clock, MapPin, TrendingDown } from 'lucide-react';

interface ETABadgeProps {
  etaMinutes: number;
  distanceKm: number;
  status?: 'on_time' | 'delayed' | 'near';
}

export default function ETABadge({
  etaMinutes,
  distanceKm,
  status = 'on_time',
}: ETABadgeProps) {
  // Format ETA
  const formatETA = (minutes: number) => {
    if (minutes < 0) return 'In arrivo';
    if (minutes < 60) return `${minutes} minuti`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 1) return mins > 0 ? `1 ora ${mins} min` : '1 ora';
    return mins > 0 ? `${hours} ore ${mins} min` : `${hours} ore`;
  };

  // Status config
  const getStatusConfig = () => {
    switch (status) {
      case 'near':
        return {
          label: 'In arrivo tra',
          color: 'bg-green-50 border-green-200 text-green-700',
          iconColor: 'text-green-600',
          icon: MapPin,
        };
      case 'delayed':
        return {
          label: 'Ritardo stimato',
          color: 'bg-red-50 border-red-200 text-red-700',
          iconColor: 'text-red-600',
          icon: Clock,
        };
      default:
        return {
          label: 'Arrivo previsto tra',
          color: 'bg-blue-50 border-blue-200 text-blue-700',
          iconColor: 'text-blue-600',
          icon: Clock,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex flex-col gap-2 px-4 py-3 rounded-lg border-2 ${config.color}`}
    >
      {/* ETA principale */}
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${config.iconColor}`} />
        <div className="flex flex-col">
          <span className="text-xs font-medium opacity-80">{config.label}</span>
          <span className="text-xl font-bold">{formatETA(etaMinutes)}</span>
        </div>
      </div>

      {/* Distanza */}
      <div className="flex items-center gap-2 text-sm">
        <TrendingDown className={`w-4 h-4 ${config.iconColor}`} />
        <span className="font-medium">
          {distanceKm < 1
            ? `${Math.round(distanceKm * 1000)} metri`
            : `${distanceKm.toFixed(1)} km`}
        </span>
      </div>
    </div>
  );
}
