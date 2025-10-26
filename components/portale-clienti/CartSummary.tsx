'use client';

import { motion } from 'framer-motion';
import {
  ShoppingBag,
  TrendingUp,
  Gift,
  Truck,
  CreditCard,
  Sparkles,
  Target,
  Award,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CartSummaryProps {
  subtotal: number;
  totalItems: number;
  onCheckout: () => void;
  isCheckingOut?: boolean;
}

// Gamification thresholds
const FREE_SHIPPING_THRESHOLD = 100; // CHF
const DISCOUNT_THRESHOLD = 200; // CHF
const PREMIUM_THRESHOLD = 500; // CHF

export function CartSummary({
  subtotal,
  totalItems,
  onCheckout,
  isCheckingOut = false,
}: CartSummaryProps) {
  const router = useRouter();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('it-CH', {
      style: 'currency',
      currency: 'CHF',
    }).format(price);
  };

  // Calculate progress percentages
  const freeShippingProgress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const discountProgress = Math.min((subtotal / DISCOUNT_THRESHOLD) * 100, 100);
  const premiumProgress = Math.min((subtotal / PREMIUM_THRESHOLD) * 100, 100);

  // Determine current tier
  const currentTier =
    subtotal >= PREMIUM_THRESHOLD ? 'premium' :
    subtotal >= DISCOUNT_THRESHOLD ? 'discount' :
    subtotal >= FREE_SHIPPING_THRESHOLD ? 'free-shipping' : 'base';

  // Calculate milestones
  const milestones = [
    {
      id: 'shipping',
      icon: Truck,
      title: 'Spedizione Gratuita',
      threshold: FREE_SHIPPING_THRESHOLD,
      progress: freeShippingProgress,
      achieved: subtotal >= FREE_SHIPPING_THRESHOLD,
      color: 'emerald',
      remaining: Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal),
    },
    {
      id: 'discount',
      icon: Gift,
      title: 'Sconto 5%',
      threshold: DISCOUNT_THRESHOLD,
      progress: discountProgress,
      achieved: subtotal >= DISCOUNT_THRESHOLD,
      color: 'blue',
      remaining: Math.max(0, DISCOUNT_THRESHOLD - subtotal),
    },
    {
      id: 'premium',
      icon: Award,
      title: 'Cliente Premium',
      threshold: PREMIUM_THRESHOLD,
      progress: premiumProgress,
      achieved: subtotal >= PREMIUM_THRESHOLD,
      color: 'yellow',
      remaining: Math.max(0, PREMIUM_THRESHOLD - subtotal),
    },
  ];

  // Calculate discount if applicable
  const discountPercentage = subtotal >= DISCOUNT_THRESHOLD ? 5 : 0;
  const discountAmount = (subtotal * discountPercentage) / 100;
  const total = subtotal - discountAmount;

  // Loyalty points simulation
  const loyaltyPoints = Math.floor(subtotal / 10);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-4"
    >
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-600/50 overflow-hidden shadow-2xl">
        {/* Header with current tier */}
        <div className="relative p-6 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border-b border-slate-600/50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-white">Riepilogo Ordine</h2>
            {currentTier !== 'base' && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full"
              >
                <Sparkles className="h-4 w-4 text-white" />
                <span className="text-sm font-bold text-white uppercase">
                  {currentTier === 'premium' ? 'Premium' : currentTier === 'discount' ? 'Sconto' : 'Free Ship'}
                </span>
              </motion.div>
            )}
          </div>
          <p className="text-slate-300 text-sm">
            {totalItems} {totalItems === 1 ? 'prodotto' : 'prodotti'}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Gamification Progress */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-5 w-5 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">
                Obiettivi Ordine
              </h3>
            </div>

            {milestones.map((milestone, index) => {
              const Icon = milestone.icon;
              const colorClasses = {
                emerald: 'from-emerald-500 to-green-500',
                blue: 'from-blue-500 to-cyan-500',
                yellow: 'from-yellow-500 to-orange-500',
              }[milestone.color];

              return (
                <motion.div
                  key={milestone.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${
                        milestone.achieved ? 'text-' + milestone.color + '-400' : 'text-slate-500'
                      }`} />
                      <span className={
                        milestone.achieved ? 'text-white font-medium' : 'text-slate-400'
                      }>
                        {milestone.title}
                      </span>
                    </div>
                    {milestone.achieved ? (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-emerald-400 font-bold"
                      >
                        ✓ Sbloccato!
                      </motion.span>
                    ) : (
                      <span className="text-slate-400 text-xs">
                        mancano {formatPrice(milestone.remaining)}
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${milestone.progress}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={`absolute inset-y-0 left-0 bg-gradient-to-r ${colorClasses} rounded-full`}
                    />
                    {milestone.achieved && (
                      <motion.div
                        animate={{
                          x: ['0%', '100%', '0%'],
                          opacity: [0.5, 0.8, 0.5],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Loyalty Points Preview */}
          {loyaltyPoints > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-400" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    Punti Fedeltà
                  </p>
                  <p className="text-xs text-slate-400">
                    Guadagnerai con questo ordine
                  </p>
                </div>
              </div>
              <div className="text-right">
                <motion.p
                  key={loyaltyPoints}
                  initial={{ scale: 1.3, color: '#a78bfa' }}
                  animate={{ scale: 1, color: '#c084fc' }}
                  className="text-2xl font-bold text-purple-400"
                >
                  +{loyaltyPoints}
                </motion.p>
              </div>
            </motion.div>
          )}

          {/* Price Breakdown */}
          <div className="space-y-3 pt-4 border-t border-slate-600/50">
            <div className="flex items-center justify-between text-slate-300">
              <span>Subtotale</span>
              <span className="font-medium">{formatPrice(subtotal)}</span>
            </div>

            {subtotal >= FREE_SHIPPING_THRESHOLD && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between text-emerald-400"
              >
                <div className="flex items-center gap-1.5">
                  <Truck className="h-4 w-4" />
                  <span className="text-sm font-medium">Spedizione</span>
                </div>
                <span className="font-bold">GRATIS</span>
              </motion.div>
            )}

            {discountPercentage > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between text-blue-400"
              >
                <div className="flex items-center gap-1.5">
                  <Gift className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Sconto {discountPercentage}%
                  </span>
                </div>
                <span className="font-bold">-{formatPrice(discountAmount)}</span>
              </motion.div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-600/50">
              <span className="text-xl font-bold text-white">Totale</span>
              <motion.div
                key={total}
                initial={{ scale: 1.2, color: '#fbbf24' }}
                animate={{ scale: 1, color: '#fbbf24' }}
                transition={{ duration: 0.3 }}
                className="text-3xl font-bold text-yellow-400"
              >
                {formatPrice(total)}
              </motion.div>
            </div>
          </div>

          {/* Checkout Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCheckout}
            disabled={isCheckingOut || totalItems === 0}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <CreditCard className="h-6 w-6" />
            {isCheckingOut ? 'Elaborazione...' : 'Procedi al Checkout'}
          </motion.button>

          {/* Continue Shopping Link */}
          <button
            onClick={() => router.push('/portale-clienti/catalogo')}
            className="w-full text-center text-slate-400 hover:text-white text-sm font-medium transition-colors"
          >
            ← Continua gli acquisti
          </button>
        </div>
      </div>

      {/* Achievement Banner */}
      {currentTier === 'premium' && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring', bounce: 0.5 }}
          className="mt-4 p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl"
        >
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500/20 rounded-full p-2">
              <Award className="h-6 w-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-yellow-400">
                🎉 Achievement Unlocked!
              </p>
              <p className="text-xs text-slate-300">
                Sei diventato Cliente Premium!
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
