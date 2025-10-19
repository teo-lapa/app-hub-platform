'use client';

import { Home } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

/**
 * Fixed Home Button Component
 *
 * Floating home icon button that appears on all Maestro AI pages
 * for quick navigation back to the main dashboard.
 *
 * Features:
 * - Fixed to bottom-right corner
 * - Blue/purple gradient with drop shadow
 * - Smooth hover animations
 * - High z-index to stay above content
 * - Responsive and touch-friendly (min 44px for mobile)
 */
export function HomeButton() {
  return (
    <Link href="/maestro-ai">
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
          delay: 0.3
        }}
        whileHover={{
          scale: 1.1,
          rotate: 5,
          transition: { duration: 0.2 }
        }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-24 z-[9999] h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 shadow-2xl shadow-blue-500/30 flex items-center justify-center group hover:shadow-blue-500/50 transition-shadow"
        aria-label="Torna alla Dashboard"
        title="Torna alla Dashboard"
      >
        <Home className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />

        {/* Ripple effect on hover */}
        <span className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
      </motion.button>
    </Link>
  );
}
