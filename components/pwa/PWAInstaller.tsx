'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;

    if (isStandalone || isIOSStandalone) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      console.log('📱 PWA: Install prompt available');
      e.preventDefault();
      setDeferredPrompt(e);

      // Show install prompt after 30 seconds or on user interaction
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 30000);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('✅ PWA: App installed successfully');
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // For iOS Safari - show manual instructions
      setShowInstallPrompt(true);
      return;
    }

    console.log('📱 PWA: Showing install prompt');
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    console.log(`📱 PWA: User ${outcome} the install prompt`);

    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Don't show again for this session
  };

  // Don't show if already installed
  if (isInstalled) {
    return null;
  }

  // Check if it's iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <AnimatePresence>
      {showInstallPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96"
        >
          <div className="glass-strong rounded-2xl p-4 border border-white/20 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-xl">
                <Smartphone className="w-5 h-5 text-white" />
              </div>

              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">
                  Installa LAPA App
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {isIOS
                    ? 'Tocca il pulsante condividi e seleziona "Aggiungi alla schermata Home"'
                    : 'Installa l\'app per un accesso rapido e funzionalità offline'
                  }
                </p>

                <div className="flex gap-2">
                  {!isIOS && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleInstallClick}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Installa
                    </motion.button>
                  )}

                  <button
                    onClick={handleDismiss}
                    className="glass px-3 py-2 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors"
                  >
                    {isIOS ? 'Ho capito' : 'Più tardi'}
                  </button>
                </div>
              </div>

              <button
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}