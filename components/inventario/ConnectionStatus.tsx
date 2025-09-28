'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/health', {
          method: 'HEAD',
          cache: 'no-cache'
        });
        setIsOnline(response.ok);
      } catch {
        setIsOnline(false);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
    };

    // Check iniziale
    checkConnection();

    // Setup event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check periodico ogni 30 secondi
    const interval = setInterval(checkConnection, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      {/* Indicatore fisso in alto a destra */}
      <div className="fixed top-4 right-4 z-50">
        <div className={`glass rounded-full px-3 py-2 flex items-center gap-2 ${
          isOnline ? 'border-green-500/50' : 'border-red-500/50'
        } border`}>
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-500">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-500" />
              <span className="text-xs text-red-500">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Notifica di cambio stato */}
      <AnimatePresence>
        {showStatus && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className={`glass-strong rounded-xl px-6 py-3 shadow-lg ${
              isOnline ? 'border-green-500' : 'border-red-500'
            } border`}>
              <div className="flex items-center gap-3">
                {isOnline ? (
                  <>
                    <Wifi className="w-5 h-5 text-green-500" />
                    <span className="text-green-500 font-semibold">
                      Connessione ripristinata
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-5 h-5 text-red-500" />
                    <span className="text-red-500 font-semibold">
                      Connessione persa - Modalità offline
                    </span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}