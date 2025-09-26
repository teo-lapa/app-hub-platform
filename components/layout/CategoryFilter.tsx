'use client';

import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/appStore';
import { categories } from '@/data/apps';

export function CategoryFilter() {
  const { selectedCategory, setCategory } = useAppStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap gap-2 justify-center mb-8"
    >
      {categories.map((category, index) => (
        <motion.button
          key={category}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCategory(category)}
          className={`px-6 py-3 rounded-full font-medium transition-all duration-300 ${
            selectedCategory === category
              ? 'gradient-primary text-white shadow-lg shadow-blue-500/25'
              : 'glass-strong hover:bg-white/20 dark:hover:bg-black/20 border border-white/20'
          }`}
        >
          {category}
        </motion.button>
      ))}
    </motion.div>
  );
}