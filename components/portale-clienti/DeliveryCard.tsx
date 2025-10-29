'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, MapPin, Clock, Truck, ChevronRight } from 'lucide-react';

interface DeliveryCardProps {
  delivery: {
    id: number;
    name: string;
    scheduled_date: string;
    state: string;
    partner_name: string;
    partner_city?: string;
    move_lines: Array<{
      product_id: [number, string];
      product_qty: number;
    }>;
    delivery_status?: string;
    estimated_arrival?: string;
  };
}

export default function DeliveryCard({ delivery }: DeliveryCardProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  // Calcola totale articoli
  const totalItems = delivery.move_lines.reduce(
    (sum, line) => sum + (line.product_qty || 0),
    0
  );

  // Calcola ETA in minuti
  const getETA = () => {
    if (!delivery.estimated_arrival) return null;
    const eta = new Date(delivery.estimated_arrival);
    const now = new Date();
    const diffMs = eta.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return 'In arrivo';
    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  // Status badge
  const getStatusConfig = () => {
    switch (delivery.delivery_status) {
      case 'in_transit':
        return {
          label: 'In transito',
          color: 'bg-blue-100 text-blue-700',
          icon: Truck,
        };
      case 'near_destination':
        return {
          label: 'Vicino',
          color: 'bg-green-100 text-green-700',
          icon: MapPin,
        };
      case 'preparing':
        return {
          label: 'In preparazione',
          color: 'bg-yellow-100 text-yellow-700',
          icon: Package,
        };
      default:
        return {
          label: 'Programmata',
          color: 'bg-gray-100 text-gray-700',
          icon: Clock,
        };
    }
  };

  const status = getStatusConfig();
  const StatusIcon = status.icon;
  const eta = getETA();

  return (
    <div
      className={`
        relative bg-white rounded-lg border-2 p-4
        cursor-pointer transition-all duration-200
        ${
          isHovered
            ? 'border-blue-400 shadow-lg scale-[1.02]'
            : 'border-gray-200 shadow-sm hover:shadow-md'
        }
      `}
      onClick={() => router.push(`/portale-clienti/consegne/${delivery.id}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {delivery.name}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {delivery.partner_city || 'Consegna programmata'}
          </p>
        </div>
        <ChevronRight
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isHovered ? 'translate-x-1' : ''
          }`}
        />
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${status.color}`}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          {status.label}
        </span>
        {delivery.delivery_status === 'in_transit' && eta && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
            <Clock className="w-3.5 h-3.5" />
            ETA: {eta}
          </span>
        )}
      </div>

      {/* Products Preview */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Articoli totali:</span>
          <span className="font-semibold text-gray-900">{totalItems}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Prodotti diversi:</span>
          <span className="font-semibold text-gray-900">
            {delivery.move_lines.length}
          </span>
        </div>
      </div>

      {/* Products List */}
      {delivery.move_lines.length > 0 && (
        <div className="border-t border-gray-100 pt-3 mt-3">
          <p className="text-xs text-gray-500 mb-2">Prodotti:</p>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {delivery.move_lines.slice(0, 3).map((line, idx) => (
              <div key={idx} className="text-sm flex items-center justify-between">
                <span className="text-gray-700 truncate flex-1">
                  {line.product_id[1]}
                </span>
                <span className="text-gray-500 ml-2 font-medium">
                  x{line.product_qty}
                </span>
              </div>
            ))}
            {delivery.move_lines.length > 3 && (
              <p className="text-xs text-gray-400 italic">
                +{delivery.move_lines.length - 3} altri prodotti
              </p>
            )}
          </div>
        </div>
      )}

      {/* Track Button */}
      {delivery.delivery_status === 'in_transit' && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button
            className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/portale-clienti/consegne/${delivery.id}`);
            }}
          >
            <MapPin className="w-4 h-4" />
            Traccia consegna
          </button>
        </div>
      )}
    </div>
  );
}
