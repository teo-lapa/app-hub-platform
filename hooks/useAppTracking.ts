import { useEffect, useRef } from 'react';

/**
 * Hook per tracking LEGGERO dell'utilizzo app
 * NON blocca rendering o navigazione
 */

interface TrackingOptions {
  appId: string;
  appName: string;
  enabled?: boolean;
}

let sessionId = '';

// Genera session ID unico al caricamento del modulo
if (typeof window !== 'undefined') {
  sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useAppTracking({ appId, appName, enabled = true }: TrackingOptions) {
  const sessionStartTime = useRef<number>(0);
  const trackingEnabled = useRef(enabled);

  useEffect(() => {
    if (!trackingEnabled.current || !appId) return;

    // Traccia apertura app (asincrono, non blocca)
    sessionStartTime.current = Date.now();

    // Fire and forget - non aspetta risposta
    fetch('/api/track-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId,
        appName,
        action: 'open',
        sessionId,
      }),
      keepalive: true, // Invia anche se l'utente naviga via
    }).catch(() => {}); // Ignora errori

    // Cleanup: traccia chiusura quando l'utente esce
    return () => {
      const duration = Date.now() - sessionStartTime.current;

      // Solo se la sessione è durata almeno 1 secondo
      if (duration > 1000) {
        // Navigator.sendBeacon per garantire invio anche durante unload
        const data = JSON.stringify({
          appId,
          appName,
          action: 'close',
          sessionId,
          duration,
        });

        if (navigator.sendBeacon) {
          const blob = new Blob([data], { type: 'application/json' });
          navigator.sendBeacon('/api/track-usage', blob);
        } else {
          // Fallback per browser vecchi
          fetch('/api/track-usage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
            keepalive: true,
          }).catch(() => {});
        }
      }
    };
  }, [appId, appName]);

  return {
    sessionId,
    trackingEnabled: trackingEnabled.current,
  };
}

/**
 * Funzione standalone per tracciare click su card/link
 * Uso: onClick={() => trackAppClick('app-id', 'App Name')}
 */
export function trackAppClick(appId: string, appName: string) {
  if (!appId) return;

  // Fire and forget
  fetch('/api/track-usage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId,
      appName,
      action: 'open',
      sessionId: `click-${Date.now()}`,
    }),
    keepalive: true,
  }).catch(() => {});
}
