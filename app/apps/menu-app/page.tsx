'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ArrowLeft, Search, Filter, Star, Leaf, Wheat, Flame } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MenuItem, MenuCategory, menuCategories, menuItems, getItemsByCategory, searchItems } from '@/lib/data/menuData';

// Helper function to format prices in euros
const formatPrice = (price: number): string => `€${price.toFixed(2)}`;

export default function MenuApp() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>(menuItems);
  const [showFilters, setShowFilters] = useState(false);
  const [dietaryFilters, setDietaryFilters] = useState({
    vegetarian: false,
    vegan: false,
    glutenFree: false,
    spicy: false
  });

  // Aggiorna i piatti filtrati quando cambiano categoria, ricerca o filtri
  useEffect(() => {
    let items = selectedCategory === 'all' ? menuItems : getItemsByCategory(selectedCategory);

    if (searchQuery) {
      items = searchItems(searchQuery);
    }

    // Applica filtri dietetici
    if (dietaryFilters.vegetarian) items = items.filter(item => item.isVegetarian);
    if (dietaryFilters.vegan) items = items.filter(item => item.isVegan);
    if (dietaryFilters.glutenFree) items = items.filter(item => item.isGlutenFree);
    if (dietaryFilters.spicy) items = items.filter(item => item.isSpicy);

    setFilteredItems(items);
  }, [selectedCategory, searchQuery, dietaryFilters]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 dark:from-gray-900 dark:via-orange-900 dark:to-red-900">
      {/* Header */}
      <div className="glass-strong border-b border-white/10 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push('/dashboard')}
                className="glass-strong p-3 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>

              <div>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                  🍽️ Menu App
                  <span className="px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-400 border border-green-500/30">
                    GRATIS
                  </span>
                </h1>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cerca piatti..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full glass pl-10 pr-4 py-2 rounded-xl border border-white/20 focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all text-sm"
                />
              </div>
            </div>

            {/* Filter Toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFilters(!showFilters)}
              className={`glass-strong p-3 rounded-xl transition-colors ${showFilters ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-white/20 dark:hover:bg-black/20'}`}
            >
              <Filter className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ repeat: Infinity, duration: 6 }}
            className="text-6xl mb-4"
          >
            🍽️
          </motion.div>
          <h2 className="text-4xl font-bold mb-4 gradient-primary bg-clip-text text-transparent">
            Menu Ristorante La Bella Vista
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Scopri i nostri piatti della tradizione italiana, preparati con ingredienti freschi e di qualità
          </p>
        </motion.div>

        {/* Filtri Dietetici */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-strong rounded-2xl p-6 mb-8 border border-white/20"
            >
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtri Dietetici
              </h3>
              <div className="flex flex-wrap gap-4">
                {[
                  { key: 'vegetarian', label: 'Vegetariano', icon: <Leaf className="w-4 h-4" />, color: 'green' },
                  { key: 'vegan', label: 'Vegano', icon: <Leaf className="w-4 h-4" />, color: 'emerald' },
                  { key: 'glutenFree', label: 'Senza Glutine', icon: <Wheat className="w-4 h-4" />, color: 'yellow' },
                  { key: 'spicy', label: 'Piccante', icon: <Flame className="w-4 h-4" />, color: 'red' }
                ].map(({ key, label, icon, color }) => (
                  <motion.button
                    key={key}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setDietaryFilters(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                      dietaryFilters[key as keyof typeof dietaryFilters]
                        ? `bg-${color}-500/20 text-${color}-400 border border-${color}-500/30`
                        : 'glass hover:bg-white/10'
                    }`}
                  >
                    {icon}
                    {label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Categorie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-4 justify-center mb-12"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedCategory('all')}
            className={`px-6 py-3 rounded-full font-medium transition-all duration-300 ${
              selectedCategory === 'all'
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25'
                : 'glass-strong hover:bg-white/20 dark:hover:bg-black/20 border border-white/20'
            }`}
          >
            Tutti i Piatti
          </motion.button>

          {menuCategories.map((category, index) => (
            <motion.button
              key={category.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-6 py-3 rounded-full font-medium transition-all duration-300 flex items-center gap-2 ${
                selectedCategory === category.id
                  ? `bg-gradient-to-r ${category.color} text-white shadow-lg`
                  : 'glass-strong hover:bg-white/20 dark:hover:bg-black/20 border border-white/20'
              }`}
            >
              <span className="text-lg">{category.icon}</span>
              {category.name}
            </motion.button>
          ))}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-center gap-6 mb-8"
        >
          <div className="glass-strong px-4 py-2 rounded-xl border border-white/20">
            <span className="text-sm text-muted-foreground">
              {filteredItems.length} piatti {filteredItems.length === 1 ? 'trovato' : 'trovati'}
            </span>
          </div>

          <div className="glass-strong px-4 py-2 rounded-xl border border-white/20">
            <span className="text-sm">
              Categoria: <span className="font-semibold text-orange-400">
                {selectedCategory === 'all' ? 'Tutti' :
                 menuCategories.find(c => c.id === selectedCategory)?.name || 'Sconosciuta'}
              </span>
            </span>
          </div>
        </motion.div>

        {/* Menu Items Grid */}
        {filteredItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="text-6xl mb-4">😔</div>
            <h3 className="text-xl font-semibold mb-2">Nessun piatto trovato</h3>
            <p className="text-muted-foreground">
              Prova a modificare i filtri o la ricerca per trovare quello che cerchi.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredItems.map((item, index) => (
              <MenuItemCard key={item.id} item={item} index={index} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Componente per le card dei piatti
function MenuItemCard({ item, index }: { item: MenuItem; index: number }) {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true
  });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ delay: index * 0.1, duration: 0.6 }}
      whileHover={{ y: -8 }}
      className="glass-strong rounded-3xl p-6 border border-white/20 hover:border-orange-500/30 transition-all duration-300 group relative overflow-hidden"
    >
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Popular Badge */}
      {item.isPopular && (
        <div className="absolute top-4 right-4 bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 border border-yellow-500/30">
          <Star className="w-3 h-3 fill-current" />
          Popolare
        </div>
      )}

      <div className="relative z-10">
        {/* Image & Icons */}
        <div className="flex items-start justify-between mb-4">
          <motion.div
            whileHover={{ scale: 1.1, rotate: [0, -10, 10, 0] }}
            className="text-5xl"
          >
            {item.image}
          </motion.div>

          {/* Dietary Icons */}
          <div className="flex gap-2">
            {item.isVegetarian && (
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
                <Leaf className="w-3 h-3 text-green-400" />
              </div>
            )}
            {item.isVegan && (
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <Leaf className="w-3 h-3 text-emerald-400" />
              </div>
            )}
            {item.isGlutenFree && (
              <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30">
                <Wheat className="w-3 h-3 text-yellow-400" />
              </div>
            )}
            {item.isSpicy && (
              <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
                <Flame className="w-3 h-3 text-red-400" />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <h3 className="font-bold text-xl group-hover:text-orange-400 transition-colors">
              {item.name}
            </h3>
            <div className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
              {formatPrice(item.price)}
            </div>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed">
            {item.description}
          </p>

          {/* Ingredients */}
          {item.ingredients && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Ingredienti
              </div>
              <div className="flex flex-wrap gap-1">
                {item.ingredients.slice(0, 4).map((ingredient, i) => (
                  <span key={i} className="text-xs bg-white/10 px-2 py-1 rounded-full">
                    {ingredient}
                  </span>
                ))}
                {item.ingredients.length > 4 && (
                  <span className="text-xs text-muted-foreground">
                    +{item.ingredients.length - 4} altri
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Calories */}
          {item.calories && (
            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <span className="text-xs text-muted-foreground">Calorie</span>
              <span className="text-sm font-medium">{item.calories} kcal</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}