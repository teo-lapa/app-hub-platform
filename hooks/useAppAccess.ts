import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AppAccessResult {
  hasAccess: boolean;
  loading: boolean;
  reason?: string;
  app?: {
    id: string;
    name: string;
    url: string;
  };
}

/**
 * Hook per controllare se l'utente ha accesso a un'app specifica
 * Usa il sistema di gestione visibilità centralizzato
 *
 * @param appId - ID dell'app da controllare
 * @param redirectOnDenied - Se true, reindirizza a home se accesso negato
 * @returns Oggetto con hasAccess, loading, reason
 */
export function useAppAccess(appId: string, redirectOnDenied: boolean = true): AppAccessResult {
  const [result, setResult] = useState<AppAccessResult>({
    hasAccess: false,
    loading: true
  });
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function checkAccess() {
      try {
        const response = await fetch('/api/apps/check-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId })
        });

        const data = await response.json();

        if (!isMounted) return;

        if (data.success) {
          setResult({
            hasAccess: data.hasAccess,
            loading: false,
            reason: data.reason,
            app: data.app
          });

          // Se accesso negato e redirect abilitato, reindirizza
          if (!data.hasAccess && redirectOnDenied) {
            console.log(`❌ useAppAccess: Accesso negato a ${appId} - redirect a home`);
            router.push('/?error=access_denied');
          }
        } else {
          // Errore nella verifica
          setResult({
            hasAccess: false,
            loading: false,
            reason: data.reason || 'Errore di sistema'
          });

          if (redirectOnDenied) {
            router.push('/?error=access_error');
          }
        }
      } catch (error) {
        console.error('Errore useAppAccess:', error);

        if (!isMounted) return;

        setResult({
          hasAccess: false,
          loading: false,
          reason: 'Errore di connessione'
        });

        if (redirectOnDenied) {
          router.push('/?error=access_error');
        }
      }
    }

    checkAccess();

    return () => {
      isMounted = false;
    };
  }, [appId, redirectOnDenied, router]);

  return result;
}

/**
 * Hook per controllare accesso basandosi sull'URL corrente
 *
 * @param redirectOnDenied - Se true, reindirizza a home se accesso negato
 * @returns Oggetto con hasAccess, loading, reason
 */
export function useCurrentAppAccess(redirectOnDenied: boolean = true): AppAccessResult {
  const [result, setResult] = useState<AppAccessResult>({
    hasAccess: false,
    loading: true
  });
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function checkAccess() {
      try {
        // Ottieni URL corrente
        const appUrl = window.location.pathname;

        const response = await fetch('/api/apps/check-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appUrl })
        });

        const data = await response.json();

        if (!isMounted) return;

        if (data.success) {
          setResult({
            hasAccess: data.hasAccess,
            loading: false,
            reason: data.reason,
            app: data.app
          });

          if (!data.hasAccess && redirectOnDenied) {
            console.log(`❌ useCurrentAppAccess: Accesso negato a ${appUrl} - redirect a home`);
            router.push('/?error=access_denied');
          }
        } else {
          setResult({
            hasAccess: false,
            loading: false,
            reason: data.reason || 'Errore di sistema'
          });

          if (redirectOnDenied) {
            router.push('/?error=access_error');
          }
        }
      } catch (error) {
        console.error('Errore useCurrentAppAccess:', error);

        if (!isMounted) return;

        setResult({
          hasAccess: false,
          loading: false,
          reason: 'Errore di connessione'
        });

        if (redirectOnDenied) {
          router.push('/?error=access_error');
        }
      }
    }

    checkAccess();

    return () => {
      isMounted = false;
    };
  }, [redirectOnDenied, router]);

  return result;
}
