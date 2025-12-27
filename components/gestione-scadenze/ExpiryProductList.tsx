'use client';

import { motion } from 'framer-motion';
import { Package, Calendar, AlertTriangle, CheckCircle, Camera } from 'lucide-react';

interface ExpiryProduct {
  id: number;
  quant_id?: number;
  name: string;
  code: string;
  barcode?: string;
  image?: string;
  uom: string;
  quantity: number;
  lot_id?: number;
  lot_name?: string;
  lot_expiration_date?: string;
  hasExpiry: boolean;
}

interface ExpiryProductListProps {
  products: ExpiryProduct[];
  onSelectProduct: (product: ExpiryProduct) => void;
}

export function ExpiryProductList({ products, onSelectProduct }: ExpiryProductListProps) {
  // Calcola stato scadenza
  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return 'missing';

    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 7) return 'critical';
    if (diffDays <= 30) return 'warning';
    return 'ok';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Non impostata';
    try {
      return new Date(dateString).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'expired': return 'bg-red-500/20 border-red-500/50 text-red-400';
      case 'critical': return 'bg-orange-500/20 border-orange-500/50 text-orange-400';
      case 'warning': return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
      case 'ok': return 'bg-green-500/20 border-green-500/50 text-green-400';
      case 'missing': return 'bg-gray-500/20 border-gray-500/50 text-gray-400';
      default: return 'bg-gray-500/20 border-gray-500/50 text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'expired':
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />;
      case 'warning':
        return <Calendar className="w-4 h-4" />;
      case 'ok':
        return <CheckCircle className="w-4 h-4" />;
      case 'missing':
        return <Camera className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'expired': return 'SCADUTO';
      case 'critical': return 'CRITICO';
      case 'warning': return 'ATTENZIONE';
      case 'ok': return 'OK';
      case 'missing': return 'DA INSERIRE';
      default: return '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Prodotti</h3>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-gray-500/20 text-gray-400">
            {products.filter(p => !p.hasExpiry).length} senza
          </span>
          <span className="px-2 py-1 rounded bg-green-500/20 text-green-400">
            {products.filter(p => p.hasExpiry).length} con scadenza
          </span>
        </div>
      </div>

      {products.map((product, index) => {
        const status = getExpiryStatus(product.lot_expiration_date);

        return (
          <motion.div
            key={product.quant_id || `${product.id}-${index}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onSelectProduct(product)}
            className={`glass-strong rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-all border-l-4 ${
              status === 'missing' ? 'border-gray-500' :
              status === 'expired' ? 'border-red-500' :
              status === 'critical' ? 'border-orange-500' :
              status === 'warning' ? 'border-yellow-500' :
              'border-green-500'
            }`}
          >
            <div className="flex items-center gap-4">
              {/* Product Image */}
              <div className="w-14 h-14 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-6 h-6 text-gray-400" />
                )}
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{product.name}</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <span>{product.code}</span>
                  <span>·</span>
                  <span>{product.quantity} {product.uom}</span>
                </div>

                {/* Lot and Expiry */}
                <div className="flex items-center gap-2 mt-2">
                  {product.lot_name && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                      Lotto: {product.lot_name}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${getStatusColor(status)}`}>
                    {getStatusIcon(status)}
                    {product.hasExpiry ? formatDate(product.lot_expiration_date) : 'Scadenza mancante'}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 ${getStatusColor(status)}`}>
                {getStatusIcon(status)}
                <span className="hidden sm:inline">{getStatusLabel(status)}</span>
              </div>

              {/* Camera Button */}
              <button
                className="p-3 rounded-full bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectProduct(product);
                }}
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
