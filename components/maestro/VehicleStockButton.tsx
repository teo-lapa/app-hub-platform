'use client';

import { useState } from 'react';
import { Truck } from 'lucide-react';
import { motion } from 'framer-motion';
import { VehicleStockModal } from './VehicleStockModal';
import { cn } from '@/lib/utils';

interface VehicleStockButtonProps {
  vendorName?: string;
  vendorId?: number;
  className?: string;
}

export function VehicleStockButton({
  vendorName,
  vendorId,
  className
}: VehicleStockButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsModalOpen(true)}
        className={cn(
          'px-3 sm:px-4 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800',
          'text-white rounded-lg transition-colors',
          'flex items-center gap-2 min-h-[44px]',
          'shadow-lg hover:shadow-xl',
          className
        )}
      >
        <Truck className="h-4 w-4" />
        <span className="hidden sm:inline font-medium">Cosa ho in macchina</span>
        <span className="sm:hidden font-medium">Macchina</span>
      </motion.button>

      <VehicleStockModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        vendorName={vendorName}
        vendorId={vendorId}
      />
    </>
  );
}
