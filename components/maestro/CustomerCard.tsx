'use client';

import { motion } from 'framer-motion';
import { Building2, MapPin, Phone, Mail, TrendingUp, AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import { HealthScoreBadge } from './HealthScoreBadge';
import { cn, formatCurrency } from '@/lib/utils';

interface CustomerCardProps {
  customer: {
    id: number;
    name: string;
    city?: string;
    health_score: number;
    churn_risk: number;
    avg_order_value?: number;
    last_order_days?: number;
    recommendation?: string;
    suggested_products?: string[];
    priority?: 'urgent' | 'high' | 'medium' | 'low';
  };
  variant?: 'urgent' | 'opportunity' | 'default';
  onComplete?: (customerId: number) => void;
  onRemove?: () => void;
}

const variantStyles = {
  urgent: 'border-red-500/50 bg-red-500/5 hover:bg-red-500/10',
  opportunity: 'border-green-500/50 bg-green-500/5 hover:bg-green-500/10',
  default: 'border-slate-700 bg-slate-800 hover:border-slate-600'
};

export function CustomerCard({ customer, variant = 'default', onComplete, onRemove }: CustomerCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={cn(
        'border rounded-lg p-5 transition-all duration-200 relative',
        variantStyles[variant]
      )}
    >
      {/* Remove button (if onRemove provided) */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-3 right-3 p-1.5 bg-slate-700/50 hover:bg-red-600 text-slate-400 hover:text-white rounded-md transition-colors z-10"
          title="Rimuovi dalla lista"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="flex items-start justify-between gap-4">
        {/* Left: Company Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
              {customer.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <Link
                href={`/maestro-ai/customers/${customer.id}`}
                className="text-lg font-semibold text-white hover:text-blue-400 transition-colors"
              >
                {customer.name}
              </Link>
              {customer.city && (
                <p className="text-sm text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {customer.city}
                </p>
              )}
            </div>
          </div>

          {/* Health & Metrics */}
          <div className="flex items-center gap-3 mb-3">
            <HealthScoreBadge score={customer.health_score} size="sm" />
            {customer.churn_risk >= 70 && (
              <div className="flex items-center gap-1.5 text-red-400 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Rischio churn: {customer.churn_risk}%</span>
              </div>
            )}
          </div>

          {/* AI Recommendation */}
          {customer.recommendation && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 mb-3">
              <p className="text-sm text-blue-200 font-medium mb-1">AI Raccomandazione:</p>
              <p className="text-sm text-slate-300">{customer.recommendation}</p>
            </div>
          )}

          {/* Suggested Products */}
          {customer.suggested_products && customer.suggested_products.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-2">Prodotti da proporre:</p>
              <div className="flex flex-wrap gap-2">
                {customer.suggested_products.slice(0, 3).map((product, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-300"
                  >
                    <TrendingUp className="h-3 w-3" />
                    {product}
                  </span>
                ))}
                {customer.suggested_products.length > 3 && (
                  <span className="text-xs text-slate-500">
                    +{customer.suggested_products.length - 3} altri
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Last order info */}
          {customer.last_order_days !== undefined && (
            <div className="mt-3 text-xs text-slate-500">
              Ultimo ordine: {customer.last_order_days} giorni fa
              {customer.avg_order_value && (
                <span className="ml-2">
                  • Medio: {formatCurrency(customer.avg_order_value)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onComplete?.(customer.id)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Completa visita
          </button>
          <div className="flex gap-2">
            <button className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
              <Phone className="h-4 w-4" />
            </button>
            <button className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
              <Mail className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
