'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CartItem {
  id: number;
  productId: number;
  productName: string;
  productCode: string | null;
  price: number;
  quantity: number;
  maxQuantity: number;
  image: string;
  unit: string;
  category: string | null;
  packagingQty?: number | null;  // Quantità cartone (es. 5.40)
  packagingName?: string | null;  // Nome packaging (es. "Cartone")
}

interface CartItemCardProps {
  item: CartItem;
  onUpdateQuantity: (itemId: number, newQuantity: number) => Promise<void>;
  onRemove: (itemId: number) => Promise<void>;
  index: number;
}

export function CartItemCard({
  item,
  onUpdateQuantity,
  onRemove,
  index,
}: CartItemCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [localQuantity, setLocalQuantity] = useState(item.quantity.toString());

  // Sync local quantity with item.quantity when it changes from parent
  useEffect(() => {
    setLocalQuantity(item.quantity.toString());
  }, [item.quantity]);

  // Swipe to delete mechanics
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-150, 0], [0.5, 1]);
  const deleteOpacity = useTransform(x, [-150, -50, 0], [1, 0.7, 0]);
  const deleteScale = useTransform(x, [-150, -50, 0], [1.2, 1, 0.8]);

  const constraintsRef = useRef(null);

  const handleDragEnd = (event: any, info: PanInfo) => {
    if (info.offset.x < -120) {
      // Swipe threshold reached - show delete confirmation
      setShowConfirmDelete(true);
      x.set(0); // Reset position
    } else {
      // Snap back
      x.set(0);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onRemove(item.id);
      toast.success('Prodotto rimosso dal carrello', { icon: '🗑️' });
    } catch (error: any) {
      toast.error(error.message || 'Errore rimozione prodotto');
      setIsRemoving(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('it-CH', {
      style: 'currency',
      currency: 'CHF',
    }).format(price);
  };

  const itemTotal = item.price * item.quantity;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        className="relative"
        ref={constraintsRef}
      >
        {/* Swipe delete background */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-end px-6"
          style={{ opacity: deleteOpacity }}
        >
          <motion.div style={{ scale: deleteScale }}>
            <Trash2 className="h-8 w-8 text-white" />
          </motion.div>
        </motion.div>

        {/* Card content */}
        <motion.article
          drag="x"
          dragConstraints={{ left: -150, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          style={{ x, opacity }}
          className={`bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-600/50 overflow-hidden transition-all duration-300 ${
            isRemoving ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <div className="p-4">
            <div className="flex gap-4">
              {/* Product Image - Show only if available */}
              {item.image !== '/placeholder-product.png' && (
                <motion.div
                  whileHover={{ scale: 1.05, rotate: 2 }}
                  className="relative w-24 h-24 rounded-lg bg-slate-700/30 flex-shrink-0 overflow-hidden"
                >
                  <img
                    src={item.image}
                    alt={item.productName}
                    className="w-full h-full object-contain"
                  />

                  {/* Quantity Badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 bg-gradient-to-br from-emerald-500 to-blue-500 text-white text-xs font-bold rounded-full h-7 w-7 flex items-center justify-center shadow-lg border-2 border-slate-900"
                  >
                    {item.quantity}
                  </motion.div>
                </motion.div>
              )}

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white mb-1 line-clamp-2 leading-tight">
                      {item.productName}
                    </h3>
                    {item.productCode && (
                      <p className="text-xs text-slate-400 mb-2 truncate">
                        {item.productCode}
                      </p>
                    )}
                    {item.category && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {item.category.split('/')[0].trim()}
                      </span>
                    )}
                  </div>

                  {/* Desktop Delete Button */}
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 10 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowConfirmDelete(true)}
                    className="hidden md:flex items-center justify-center min-w-[48px] min-h-[48px] p-3 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    aria-label="Rimuovi prodotto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </motion.button>
                </div>

                {/* Price & Controls */}
                <div className="mt-3 flex items-end justify-between gap-4">
                  {/* Quantity Controls */}
                  <div className="flex flex-col gap-2">
                    {/* Quantity Input Row */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={localQuantity}
                        onChange={(e) => {
                          // Allow free typing - just update local state
                          setLocalQuantity(e.target.value);
                        }}
                        onBlur={async (e) => {
                          // On blur, validate and update
                          const value = e.target.value.trim();
                          let newQty = parseInt(value);

                          // Handle invalid input
                          if (isNaN(newQty) || value === '') {
                            newQty = item.quantity;
                          }

                          // Clamp to valid range
                          if (newQty < 1) {
                            newQty = 1;
                          } else if (newQty > item.maxQuantity) {
                            newQty = item.maxQuantity;
                            toast.error(`Massimo ${item.maxQuantity} unità disponibili`);
                          }

                          // Update local state
                          setLocalQuantity(newQty.toString());

                          // Only call API if quantity actually changed
                          if (newQty !== item.quantity) {
                            setIsUpdating(true);
                            try {
                              await onUpdateQuantity(item.id, newQty);
                            } catch (error: any) {
                              toast.error(error.message || 'Errore aggiornamento');
                              // Revert to original quantity on error
                              setLocalQuantity(item.quantity.toString());
                            } finally {
                              setIsUpdating(false);
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          // Submit on Enter key
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        disabled={isUpdating}
                        min="1"
                        max={item.maxQuantity}
                        className="w-24 text-center text-lg font-bold text-white bg-slate-700 hover:bg-slate-600 border-2 border-slate-600 hover:border-emerald-500 rounded-lg px-3 py-3 min-h-[48px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:opacity-50"
                      />
                      <span className="text-sm text-slate-400 font-medium">
                        {item.unit}
                      </span>
                    </div>

                    {/* Cartone Button (if packaging available) */}
                    {item.packagingQty && item.packagingQty > 0 && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
                          const cartoniQty = Math.floor(item.quantity / item.packagingQty!);
                          const newCartoni = cartoniQty + 1;
                          const newQty = Math.round(newCartoni * item.packagingQty! * 100) / 100;

                          if (newQty <= item.maxQuantity) {
                            setIsUpdating(true);
                            try {
                              await onUpdateQuantity(item.id, newQty);
                            } catch (error: any) {
                              toast.error(error.message || 'Errore aggiornamento');
                            } finally {
                              setIsUpdating(false);
                            }
                          } else {
                            toast.error(`Massimo ${item.maxQuantity} unità disponibili`);
                          }
                        }}
                        disabled={isUpdating}
                        className="px-3 py-2 min-h-[44px] bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                      >
                        <span>+ {item.packagingName || 'Cartone'}</span>
                        <span className="text-[10px] opacity-80">({item.packagingQty} {item.unit})</span>
                      </motion.button>
                    )}
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <div className="text-xs text-slate-400 mb-0.5">
                      {formatPrice(item.price)} × {item.quantity}
                    </div>
                    <motion.div
                      key={itemTotal}
                      initial={{ scale: 1.2, color: '#10b981' }}
                      animate={{ scale: 1, color: '#fbbf24' }}
                      transition={{ duration: 0.3 }}
                      className="text-lg font-bold text-yellow-400"
                    >
                      {formatPrice(itemTotal)}
                    </motion.div>
                  </div>
                </div>

                {/* Stock Warning */}
                {item.quantity >= item.maxQuantity * 0.8 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 flex items-center gap-1.5 text-xs text-yellow-400"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Disponibilità limitata: max {item.maxQuantity}</span>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile: Swipe hint */}
          <div className="md:hidden px-4 pb-2">
            <p className="text-xs text-slate-500 text-center">
              ← Scorri per eliminare
            </p>
          </div>
        </motion.article>
      </motion.div>

      {/* Confirm Delete Modal */}
      {showConfirmDelete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowConfirmDelete(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 max-w-sm w-full border border-red-500/30 shadow-2xl"
          >
            <div className="flex items-center justify-center mb-4">
              <div className="bg-red-500/20 rounded-full p-3">
                <Trash2 className="h-8 w-8 text-red-400" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-white text-center mb-2">
              Rimuovere prodotto?
            </h3>

            <p className="text-slate-400 text-center mb-6">
              Sei sicuro di voler rimuovere{' '}
              <span className="text-white font-semibold">
                {item.productName}
              </span>{' '}
              dal carrello?
            </p>

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 px-4 py-4 min-h-[48px] bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
              >
                Annulla
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRemove}
                disabled={isRemoving}
                className="flex-1 px-4 py-4 min-h-[48px] bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
              >
                {isRemoving ? 'Rimozione...' : 'Rimuovi'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
