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
          whileHover={{ scale: 1.01, boxShadow: "0 10px 40px rgba(0,0,0,0.08)" }}
          className={`bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200 overflow-hidden transition-all duration-300 shadow-lg ${
            isRemoving ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <div className="p-4">
            <div className="flex gap-4">
              {/* Product Image - Show only if available */}
              {item.image !== '/placeholder-product.png' && (
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="relative w-20 h-20 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex-shrink-0 overflow-hidden border border-gray-100"
                >
                  <img
                    src={item.image}
                    alt={item.productName}
                    className="w-full h-full object-contain p-1"
                  />

                  {/* Quantity Badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    whileHover={{ scale: 1.1 }}
                    className="absolute -top-2 -right-2 bg-gradient-to-br from-red-500 to-orange-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-md"
                  >
                    {item.quantity}
                  </motion.div>
                </motion.div>
              )}

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2 leading-tight">
                      {item.productName}
                    </h3>
                    {item.productCode && (
                      <p className="text-xs text-gray-400 mb-2 truncate">
                        {item.productCode}
                      </p>
                    )}
                    {item.category && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600 border border-orange-200">
                        {item.category.split('/')[0].trim()}
                      </span>
                    )}
                  </div>

                  {/* Desktop Delete Button */}
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 10, backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowConfirmDelete(true)}
                    className="hidden md:flex items-center justify-center min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-red-50 text-red-500 hover:text-red-600 transition-colors"
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
                          setLocalQuantity(e.target.value);
                        }}
                        onBlur={async (e) => {
                          const value = e.target.value.trim();
                          let newQty = parseInt(value);

                          if (isNaN(newQty) || value === '') {
                            newQty = item.quantity;
                          }

                          if (newQty < 1) {
                            newQty = 1;
                          } else if (newQty > item.maxQuantity) {
                            newQty = item.maxQuantity;
                            toast.error(`Massimo ${item.maxQuantity} unità disponibili`);
                          }

                          setLocalQuantity(newQty.toString());

                          if (newQty !== item.quantity) {
                            setIsUpdating(true);
                            try {
                              await onUpdateQuantity(item.id, newQty);
                            } catch (error: any) {
                              toast.error(error.message || 'Errore aggiornamento');
                              setLocalQuantity(item.quantity.toString());
                            } finally {
                              setIsUpdating(false);
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        disabled={isUpdating}
                        min="1"
                        max={item.maxQuantity}
                        className="w-20 text-center text-base font-bold text-gray-900 bg-gray-50 hover:bg-white border-2 border-gray-200 hover:border-red-400 rounded-xl px-2 py-2.5 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all disabled:opacity-50"
                      />
                      <span className="text-sm text-gray-500 font-medium">
                        {item.unit}
                      </span>
                    </div>

                    {/* Cartone Button (if packaging available) */}
                    {item.packagingQty && item.packagingQty > 0 && (
                      <motion.button
                        whileHover={{ scale: 1.03, boxShadow: "0 4px 15px rgba(249, 115, 22, 0.3)" }}
                        whileTap={{ scale: 0.97 }}
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
                        className="px-3 py-2 min-h-[40px] bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 shadow-md"
                      >
                        <span>+ {item.packagingName || 'Cartone'}</span>
                        <span className="text-[10px] opacity-80">({item.packagingQty} {item.unit})</span>
                      </motion.button>
                    )}
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <div className="text-xs text-gray-400 mb-0.5">
                      {formatPrice(item.price)} × {item.quantity}
                    </div>
                    <motion.div
                      key={itemTotal}
                      initial={{ scale: 1.2, color: '#ef4444' }}
                      animate={{ scale: 1, color: '#ea580c' }}
                      transition={{ duration: 0.3 }}
                      className="text-lg font-bold text-orange-600"
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
                    className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg"
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
            <p className="text-xs text-gray-400 text-center">
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
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowConfirmDelete(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-sm w-full border border-gray-200 shadow-2xl"
          >
            <motion.div
              className="flex items-center justify-center mb-4"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <div className="bg-red-100 rounded-full p-3">
                <Trash2 className="h-8 w-8 text-red-500" />
              </div>
            </motion.div>

            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
              Rimuovere prodotto?
            </h3>

            <p className="text-gray-500 text-center mb-6">
              Sei sicuro di voler rimuovere{' '}
              <span className="text-gray-900 font-semibold">
                {item.productName}
              </span>{' '}
              dal carrello?
            </p>

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 px-4 py-3.5 min-h-[48px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                Annulla
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, boxShadow: "0 10px 25px rgba(239, 68, 68, 0.3)" }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRemove}
                disabled={isRemoving}
                className="flex-1 px-4 py-3.5 min-h-[48px] bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg"
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
