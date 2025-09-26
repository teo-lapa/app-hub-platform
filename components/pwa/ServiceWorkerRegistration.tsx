'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registered successfully:', registration.scope);

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('🔄 New service worker available, refresh to update');

                  // You can show a toast or prompt user to refresh
                  if (confirm('Nuova versione disponibile! Vuoi aggiornare?')) {
                    window.location.reload();
                  }
                }
              });
            }
          });

          // Handle service worker messages
          navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('📨 Message from service worker:', event.data);
          });
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });

      // Handle service worker updates
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('🔄 Service Worker updated, reloading page');
          window.location.reload();
        }
      });
    }
  }, []);

  return null; // This component doesn't render anything
}

// Utility functions for PWA features
export const PWAUtils = {
  // Check if app is installed
  isInstalled: (): boolean => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    return isStandalone || isIOSStandalone;
  },

  // Check if running in PWA mode
  isPWA: (): boolean => {
    return PWAUtils.isInstalled();
  },

  // Get install prompt
  getInstallPrompt: (): Promise<any> => {
    return new Promise((resolve) => {
      const handler = (e: Event) => {
        e.preventDefault();
        window.removeEventListener('beforeinstallprompt', handler);
        resolve(e);
      };
      window.addEventListener('beforeinstallprompt', handler);
    });
  },

  // Check if device supports PWA
  supportsPWA: (): boolean => {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  },

  // Request notification permission
  requestNotificationPermission: async (): Promise<NotificationPermission> => {
    if ('Notification' in window) {
      return await Notification.requestPermission();
    }
    return 'denied';
  },

  // Send notification
  sendNotification: (title: string, options?: NotificationOptions): void => {
    if ('Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          ...options,
        });
      });
    }
  },
};