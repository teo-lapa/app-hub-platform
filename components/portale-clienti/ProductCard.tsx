'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingCart, Package, AlertCircle, Tag, Bell, X } from 'lucide-react';
import { ProductReservationModal, ReservationData } from './ProductReservationModal';
import toast from 'react-hot-toast';

interface Product {
  id: number;
  name: string;
  code: string | null;
  price: number;
  originalPrice: number;
  hasCustomPrice: boolean;
  quantity: number;
  available: boolean;
  image: string;
  category: { id: number; name: string } | null;
  unit: string;
  description: string | null;
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: number, quantity: number) => void;
  cartQuantity?: number; // Quantità già nel carrello
}

export function ProductCard({ product, onAddToCart, cartQuantity = 0 }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isInCart = cartQuantity > 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      await onAddToCart(product.id, quantity);
      setQuantity(1); // Reset quantity after adding
    } finally {
      setIsAdding(false);
    }
  };

  const handleReservation = async (data: ReservationData) => {
    try {
      const formData = new FormData();
      formData.append('productId', data.productId.toString());
      formData.append('textNote', data.textNote);

      if (data.audioFile) {
        formData.append('audioFile', data.audioFile);
      }

      if (data.imageFile) {
        formData.append('imageFile', data.imageFile);
      }

      const response = await fetch('/api/portale-clienti/reservations', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success('Prenotazione inviata con successo!');
    } catch (error: any) {
      console.error('Error creating reservation:', error);
      throw error;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('it-CH', {
      style: 'currency',
      currency: 'CHF',
    }).format(price);
  };

  // Estrai prima categoria (FRIGO, SECCO, etc.) dal path completo
  const getCategoryBadge = () => {
    if (!product.category) return null;
    const categoryName = product.category.name.split('/')[0].trim();
    return categoryName;
  };

  // Modal component to render in portal
  const productDetailModal = mounted && isDetailModalOpen && (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => setIsDetailModalOpen(false)}
    >
      <div
        className="bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con immagine */}
        <div className="relative">
          <div className="aspect-video bg-slate-700/30 relative overflow-hidden">
            {product.image !== '/placeholder-product.png' ? (
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-24 w-24 text-slate-500" />
              </div>
            )}
          </div>

          {/* Pulsante chiudi */}
          <button
            onClick={() => setIsDetailModalOpen(false)}
            className="absolute top-4 right-4 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Contenuto */}
        <div className="p-6">
          {/* Nome prodotto */}
          <h2 className="text-2xl font-bold text-white mb-4">{product.name}</h2>

          {/* Informazioni principali */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Codice prodotto */}
            {product.code && (
              <div className="bg-slate-700/30 rounded-lg p-3">
                <div className="text-slate-400 text-sm mb-1">Codice Prodotto</div>
                <div className="text-white font-semibold">{product.code}</div>
              </div>
            )}

            {/* Prezzo */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              <div className="text-emerald-400 text-sm mb-1">Prezzo di Listino</div>
              <div className="text-white font-bold text-xl">
                {formatPrice(product.price)}
                <span className="text-slate-400 text-base font-normal ml-1">
                  / {product.unit}
                </span>
              </div>
              {product.hasCustomPrice && product.originalPrice > product.price && (
                <div className="text-slate-500 text-sm line-through mt-1">
                  {formatPrice(product.originalPrice)}
                </div>
              )}
            </div>

            {/* Categoria */}
            {product.category && (
              <div className="bg-slate-700/30 rounded-lg p-3">
                <div className="text-slate-400 text-sm mb-1">Categoria</div>
                <div className="text-white font-semibold">{product.category.name}</div>
              </div>
            )}

            {/* Disponibilità */}
            <div className={`rounded-lg p-3 ${
              product.available
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}>
              <div className={`text-sm mb-1 ${
                product.available ? 'text-green-400' : 'text-red-400'
              }`}>
                Disponibilità
              </div>
              <div className="text-white font-bold text-xl">
                {product.available ? (
                  <span className="text-green-400">{product.quantity} {product.unit} disponibili</span>
                ) : (
                  <span className="text-red-400">Esaurito</span>
                )}
              </div>
            </div>
          </div>

          {/* Descrizione */}
          {product.description && (
            <div className="mb-6">
              <div className="text-slate-400 text-sm mb-2">Descrizione</div>
              <p className="text-white leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {/* Pulsanti azione */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <button
              onClick={() => setIsDetailModalOpen(false)}
              className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
            >
              Chiudi
            </button>
            {product.available ? (
              <button
                onClick={() => {
                  setIsDetailModalOpen(false);
                  handleAddToCart();
                }}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <ShoppingCart className="h-4 w-4" />
                Aggiungi al Carrello
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setIsReservationModalOpen(true);
                }}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <Bell className="h-4 w-4" />
                Prenota Prodotto
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <article className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 overflow-hidden hover:border-emerald-500/50 transition-all duration-300 group">
      {/* Immagine prodotto */}
      <div
        className="aspect-square bg-slate-700/30 relative overflow-hidden cursor-pointer hover:bg-slate-700/50 transition-colors"
        onClick={() => setIsDetailModalOpen(true)}
      >
        {product.image && product.image !== '/placeholder-product.png' ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              console.error('Image load error for product:', product.name, product.id);
              (e.target as HTMLImageElement).style.display = 'none';
            }}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-8 w-8 text-slate-500" />
          </div>
        )}

        {/* Badge categoria madre (prima categoria) - STILE CATALOGO LAPA */}
        {getCategoryBadge() && (
          <div className="absolute top-1.5 left-1.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/90 text-white">
              {getCategoryBadge()}
            </span>
          </div>
        )}

        {/* Badge disponibilità piccolo - STILE CATALOGO LAPA */}
        <div className="absolute top-1.5 right-1.5">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
            product.available
              ? 'bg-green-500/90 text-white'
              : 'bg-red-500/90 text-white'
          }`}>
            {product.available ? '✓' : '✗'}
          </span>
        </div>

        {/* Badge prezzo speciale se presente */}
        {product.hasCustomPrice && (
          <div className="absolute bottom-1.5 left-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-blue-500/90 text-white">
              <Tag className="h-2.5 w-2.5" />
              Offerta
            </span>
          </div>
        )}
      </div>

      {/* Contenuto card */}
      <div className="p-2">
        <h3 className="text-xs font-semibold text-white mb-1 line-clamp-2 leading-tight group-hover:text-emerald-400 transition-colors">
          {product.name}
        </h3>

        {/* Codice prodotto */}
        {product.code && (
          <div className="text-slate-400 text-[10px] mb-1 truncate">
            {product.code}
          </div>
        )}

        {/* Footer card */}
        <div className="pt-1.5 mt-1 border-t border-slate-600/50 space-y-1">
          {/* Prezzo e Unità */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-emerald-400">
                {formatPrice(product.price)}
              </span>
              {product.hasCustomPrice && product.originalPrice > product.price && (
                <span className="text-[9px] text-slate-500 line-through ml-1">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
            </div>
            {/* Badge Unità di misura */}
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {product.unit}
            </span>
          </div>

          {/* Quantità disponibile */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400">Disponibili:</span>
            <span className={`font-semibold ${
              product.available ? 'text-green-400' : 'text-red-400'
            }`}>
              {product.quantity}
            </span>
          </div>
        </div>

        {/* Sezione Add to Cart - MANTIENE FUNZIONALITÀ E-COMMERCE */}
        {product.available ? (
          <div className="mt-2 pt-2 border-t border-slate-600/50 space-y-2">
            {/* Quantity Selector */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-2 min-h-[44px] bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                aria-label="Diminuisci quantita"
              >
                -
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 text-center bg-slate-700 text-white text-sm py-2 min-h-[44px] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                min="1"
                max={product.quantity}
              />
              <button
                onClick={() => setQuantity(Math.min(product.quantity, quantity + 1))}
                className="px-3 py-2 min-h-[44px] bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                aria-label="Aumenta quantita"
              >
                +
              </button>
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={handleAddToCart}
              disabled={isAdding}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isInCart
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
                  : 'bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white'
              }`}
              aria-label={isInCart ? 'Già nel carrello' : 'Aggiungi al carrello'}
            >
              <ShoppingCart className="h-4 w-4" />
              {isAdding
                ? 'Aggiunta...'
                : isInCart
                  ? `Nel carrello (${cartQuantity})`
                  : 'Aggiungi al Carrello'
              }
            </button>
          </div>
        ) : (
          <div className="mt-2 pt-2 border-t border-slate-600/50">
            <button
              onClick={() => setIsReservationModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-3 min-h-[48px] rounded-lg text-sm font-medium transition-all active:scale-[0.98]"
            >
              <Bell className="h-4 w-4" />
              Prenota Prodotto
            </button>
          </div>
        )}
      </div>

      {/* Reservation Modal */}
      <ProductReservationModal
        isOpen={isReservationModalOpen}
        onClose={() => setIsReservationModalOpen(false)}
        product={{
          id: product.id,
          name: product.name,
          code: product.code,
          image: product.image,
          unit: product.unit,
        }}
        onSubmit={handleReservation}
      />
    </article>

    {/* Render modal in portal outside article */}
    {mounted && productDetailModal && createPortal(productDetailModal, document.body)}
  </>
  );
}
