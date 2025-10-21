'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Edit, Trash2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MenuApp() {
  const router = useRouter();

  const menuItems = [
    { id: 1, name: 'Spaghetti Carbonara', price: '€12.50', category: 'Primi Piatti', image: '🍝' },
    { id: 2, name: 'Margherita Pizza', price: '€8.00', category: 'Pizze', image: '🍕' },
    { id: 3, name: 'Caesar Salad', price: '€9.50', category: 'Insalate', image: '🥗' },
    { id: 4, name: 'Tiramisu', price: '€6.00', category: 'Dolci', image: '🍰' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/dashboard')}
            className="glass-strong p-3 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>

          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              🍽️ Menu App
              <span className="px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-400 border border-green-500/30">
                GRATIS
              </span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Gestisci il menu del tuo ristorante con facilità
            </p>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-4 mb-8"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="glass-strong px-6 py-3 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors flex items-center gap-2 font-medium gradient-primary text-white"
          >
            <Plus className="w-4 h-4" />
            Aggiungi Piatto
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="glass-strong px-6 py-3 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Importa Menu
          </motion.button>
        </motion.div>

        {/* Menu Items Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {menuItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -4 }}
              className="glass-strong rounded-2xl p-6 border border-white/20 hover:border-white/30 transition-all group"
            >
              <div className="text-center mb-4">
                <div className="text-4xl mb-3">{item.image}</div>
                <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                <p className="text-sm text-muted-foreground mb-2">{item.category}</p>
                <p className="text-2xl font-bold gradient-primary bg-clip-text text-transparent">
                  {item.price}
                </p>
              </div>

              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 glass p-2 rounded-lg hover:bg-blue-500/20 hover:text-blue-400 transition-colors flex items-center justify-center"
                >
                  <Edit className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 glass p-2 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Demo Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 glass-strong rounded-2xl p-6 border border-yellow-500/20 text-center"
        >
          <div className="text-3xl mb-4">🎭</div>
          <h3 className="text-xl font-semibold mb-2">Questa è una demo</h3>
          <p className="text-muted-foreground">
            Questa è una versione dimostrativa dell'app Menu. Nella versione completa potresti
            aggiungere, modificare ed eliminare piatti, caricare immagini reali, gestire categorie e molto altro.
          </p>
        </motion.div>
      </div>
    </div>
  );
}