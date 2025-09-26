'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if the app is already installed using multiple methods
    const checkIfInstalled = () => {
      // Method 1: Check display mode
      const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;

      // Method 2: Check if window.navigator.standalone is true (iOS)
      const isIOSStandalone = (window.navigator as any).standalone === true;

      // Method 3: Check if the app was launched from home screen
      const isLaunchedFromHomeScreen = document.referrer === '' && window.location.protocol === 'https:';

      // Method 4: Check user agent for installed PWA indicators
      const hasInstalledIndicators = navigator.userAgent.includes('wv') || // WebView
                                   document.documentElement.classList.contains('pwa-installed') ||
                                   localStorage.getItem('pwa-installed') === 'true';

      const installed = isStandalone || isIOSStandalone || hasInstalledIndicators;
      setIsInstalled(installed);

      if (installed) {
        setShowInstallButton(false);
        localStorage.setItem('pwa-installed', 'true');
      }

      return installed;
    };

    // Check immediately
    if (checkIfInstalled()) {
      return;
    }

    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Save the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Only show if not already installed
      if (!isInstalled) {
        setShowInstallButton(true);
      }
    };

    const appInstalledHandler = () => {
      console.log('PWA app installed successfully');
      setIsInstalled(true);
      setShowInstallButton(false);
      localStorage.setItem('pwa-installed', 'true');
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', appInstalledHandler);

    // Periodic check for installation status
    const intervalId = setInterval(checkIfInstalled, 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', appInstalledHandler);
      clearInterval(intervalId);
    };
  }, [isInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Fallback for iOS or browsers that don't support install prompt
      alert('Per installare l\'app:\n\n1. Apri il menu del browser\n2. Seleziona "Aggiungi alla schermata home"\n3. Conferma l\'installazione');
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setIsInstalled(true);
      localStorage.setItem('pwa-installed', 'true');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the saved prompt since it can't be used again
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  // Only show if not installed and either prompt is available or on mobile
  const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const shouldShow = !isInstalled && (showInstallButton || (isMobile && !isInstalled));

  if (!shouldShow) {
    return null;
  }

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleInstallClick}
      className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
      title="Installa App Hub"
    >
      <Download className="w-5 h-5" />
      <span className="hidden sm:inline font-medium">Installa App</span>
      <Smartphone className="w-4 h-4 sm:hidden" />
    </motion.button>
  );
}