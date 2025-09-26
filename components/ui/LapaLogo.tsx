'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface LapaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { width: 32, height: 32, textClass: 'text-sm' },
  md: { width: 48, height: 48, textClass: 'text-lg' },
  lg: { width: 64, height: 64, textClass: 'text-xl' },
  xl: { width: 80, height: 80, textClass: 'text-2xl' },
};

export function LapaLogo({ size = 'md', showText = true, className = '' }: LapaLogoProps) {
  const { width, height, textClass } = sizeMap[size];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, type: 'spring' }}
      className={`flex items-center gap-3 ${className}`}
    >
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative flex-shrink-0"
      >
        <Image
          src="/lapa-logo.jpeg"
          alt="LAPA Logo"
          width={width}
          height={height}
          className="rounded-lg shadow-lg"
          priority
        />
      </motion.div>

      {showText && (
        <div className="flex flex-col">
          <motion.h1
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={`font-bold text-red-600 dark:text-red-400 ${textClass}`}
          >
            LAPA
          </motion.h1>
          <motion.p
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-xs text-muted-foreground font-medium"
          >
            Fornitore Ristoranti
          </motion.p>
        </div>
      )}
    </motion.div>
  );
}