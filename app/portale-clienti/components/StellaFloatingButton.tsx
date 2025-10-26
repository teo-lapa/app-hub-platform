'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import Link from 'next/link';

export function StellaFloatingButton() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link href="/stella-assistant">
      <motion.div
        className="fixed bottom-6 right-6 z-50"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: 'spring', stiffness: 260, damping: 20 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="relative bg-gradient-to-br from-pink-500 to-purple-600 text-white rounded-full shadow-2xl hover:shadow-pink-500/50 transition-all duration-300 group"
        >
          {/* Main button */}
          <div className="w-16 h-16 flex items-center justify-center relative overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-pink-400 via-purple-500 to-pink-400 animate-gradient bg-[length:200%_auto]" />

            {/* Icon */}
            <Sparkles className="w-8 h-8 relative z-10 group-hover:rotate-12 transition-transform duration-300" />

            {/* Pulse effect */}
            <span className="absolute inset-0 rounded-full bg-pink-400 opacity-75 animate-ping" />
          </div>

          {/* Tooltip */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg whitespace-nowrap shadow-xl"
              >
                <span className="text-sm font-medium">🌟 Chatta con Stella</span>
                <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Badge "AI" */}
          <div className="absolute -top-1 -right-1 bg-white text-pink-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-pink-500 shadow-lg">
            AI
          </div>
        </motion.button>

        {/* Sparkle particles animation */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-yellow-300 rounded-full"
              style={{
                top: '50%',
                left: '50%',
              }}
              animate={{
                x: [0, (i - 1) * 30],
                y: [0, -20 + i * 10],
                opacity: [1, 0],
                scale: [1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.3,
              }}
            />
          ))}
        </div>
      </motion.div>
    </Link>
  );
}
