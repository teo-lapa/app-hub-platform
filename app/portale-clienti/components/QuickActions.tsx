'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Truck, Package, User, Sparkles, Wand2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export function QuickActions() {
  const router = useRouter();
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // Handle AI Order creation
  const handleAIOrder = async () => {
    try {
      setIsLoadingAI(true);
      toast.loading('Analisi storico ordini...', { id: 'ai-order' });

      // Get AI suggestions
      const suggestResponse = await fetch('/api/portale-clienti/ai-suggest-order', {
        credentials: 'include',
      });
      const suggestData = await suggestResponse.json();

      if (!suggestData.success || !suggestData.suggestions?.length) {
        toast.error('Nessun prodotto ricorsivo trovato. Ordina più prodotti per attivare questa funzione!', { id: 'ai-order' });
        return;
      }

      // Add all suggestions to cart
      const items = suggestData.suggestions.map((s: any) => ({
        productId: s.productId,
        quantity: s.suggestedQuantity,
      }));

      const cartResponse = await fetch('/api/portale-clienti/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items }),
      });

      const cartData = await cartResponse.json();

      if (cartData.error) {
        throw new Error(cartData.error);
      }

      toast.success(`${items.length} prodotti aggiunti al carrello!`, { id: 'ai-order' });

      // Redirect to cart
      router.push('/portale-clienti/carrello');

    } catch (err: any) {
      console.error('Failed to create AI order:', err);
      toast.error(err.message || 'Errore nella creazione ordine', { id: 'ai-order' });
    } finally {
      setIsLoadingAI(false);
    }
  };

  const actions = [
    {
      title: '🌟 Stella AI',
      description: 'Assistente personale',
      icon: Sparkles,
      href: '/stella-assistant',
      color: 'from-pink-500 to-purple-600',
      bgColor: 'bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20',
      iconColor: 'text-pink-600 dark:text-pink-400'
    },
    {
      title: 'Ordine AI',
      description: 'Basato sullo storico',
      icon: Wand2,
      onClick: handleAIOrder,
      isLoading: isLoadingAI,
      color: 'from-purple-500 to-blue-600',
      bgColor: 'bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20',
      iconColor: 'text-purple-600 dark:text-purple-400'
    },
    {
      title: 'Nuovo Ordine',
      description: 'Sfoglia il catalogo',
      icon: ShoppingCart,
      href: '/portale-clienti/catalogo',
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      iconColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: 'Tracking Consegne',
      description: 'Segui i tuoi ordini',
      icon: Truck,
      href: '/portale-clienti/consegne',
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      iconColor: 'text-green-600 dark:text-green-400'
    },
    {
      title: 'I Miei Ordini',
      description: 'Storico completo',
      icon: Package,
      href: '/portale-clienti/ordini',
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      iconColor: 'text-orange-600 dark:text-orange-400'
    },
    {
      title: 'Profilo',
      description: 'I tuoi dati',
      icon: User,
      href: '/portale-clienti/profilo',
      color: 'from-indigo-500 to-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      iconColor: 'text-indigo-600 dark:text-indigo-400'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-gray-100 dark:border-gray-700"
    >
      <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 md:mb-6">
        Azioni Rapide
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        {actions.map((action, index) => {
          const Icon = action.icon;
          const isClickAction = 'onClick' in action;

          const cardContent = (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{
                scale: action.isLoading ? 1 : 1.05,
                transition: { duration: 0.2 }
              }}
              whileTap={{ scale: action.isLoading ? 1 : 0.95 }}
              className={`relative group cursor-pointer ${action.isLoading ? 'opacity-70' : ''}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-10 rounded-xl transition-opacity duration-300`} />
              <div className={`relative p-4 min-h-[88px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 group-hover:border-transparent group-hover:shadow-lg transition-all duration-300 flex flex-col`}>
                <div className={`${action.bgColor} rounded-lg p-2 sm:p-2.5 md:p-3 w-fit mx-auto mb-2 sm:mb-2.5 md:mb-3`}>
                  {action.isLoading ? (
                    <Loader2 className={`h-5 w-5 sm:h-5 sm:w-5 md:h-6 md:w-6 ${action.iconColor} animate-spin`} />
                  ) : (
                    <Icon className={`h-5 w-5 sm:h-5 sm:w-5 md:h-6 md:w-6 ${action.iconColor}`} />
                  )}
                </div>
                <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white text-center mb-0.5 sm:mb-1">
                  {action.title}
                </h3>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 text-center">
                  {action.isLoading ? 'Caricamento...' : action.description}
                </p>
              </div>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0"
                whileHover={{
                  opacity: 0.2,
                  x: ['-100%', '100%'],
                  transition: { duration: 0.6 }
                }}
              />
            </motion.div>
          );

          // Render as button if onClick, otherwise as Link
          if (isClickAction) {
            return (
              <button
                key={action.title}
                onClick={action.onClick}
                disabled={action.isLoading}
                className="text-left"
              >
                {cardContent}
              </button>
            );
          }

          return (
            <Link key={action.title} href={action.href!}>
              {cardContent}
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
