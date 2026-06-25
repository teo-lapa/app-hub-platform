'use client';

import { useEffect } from 'react';

/**
 * GUARDIANO DELLA SESSIONE
 *
 * Odoo 19 (in produzione dal 14/6) stacca la sessione utente lato server dopo poche ore.
 * Prima, in quel momento, l'HUB cadeva in silenzio sull'account di servizio ("feedback" /
 * Agente IA ChatGpt) e ogni operazione (consegna, prelievo, batch, spostamento frigo)
 * veniva scritta a nome suo → si perdeva chi aveva fatto cosa.
 *
 * Questo componente intercetta le chiamate /api: quando una fallisce perché la sessione è
 * scaduta (SESSION_EXPIRED / 401), ri-logga IN AUTOMATICO con LE STESSE credenziali
 * dell'utente loggato e riprova la chiamata UNA volta. Risultato:
 *   - l'operazione non viene MAI scritta col feedback,
 *   - l'utente non viene buttato fuori (niente dentro-fuori),
 *   - ogni operazione resta attribuita a chi l'ha fatta davvero.
 *
 * Il ritento è sicuro: la chiamata fallita è stata RIFIUTATA da Odoo all'autenticazione,
 * quindi non ha scritto nulla; la si rifà identica con la sessione rinnovata.
 */
export function SessionKeeper() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.__lapaSessionKeeperInstalled) return;
    w.__lapaSessionKeeperInstalled = true;

    const originalFetch = window.fetch.bind(window);
    let reloginInFlight: Promise<boolean> | null = null;

    function getStoredCreds(): { email: string; password: string } | null {
      try {
        const raw = localStorage.getItem('lapa-cred');
        if (!raw) return null;
        return JSON.parse(decodeURIComponent(atob(raw)));
      } catch {
        return null;
      }
    }

    async function silentRelogin(): Promise<boolean> {
      if (reloginInFlight) return reloginInFlight;
      reloginInFlight = (async () => {
        const creds = getStoredCreds();
        if (!creds?.email || !creds?.password) return false;
        try {
          const res = await originalFetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(creds),
          });
          const data = await res.json().catch(() => null);
          return !!(res.ok && data?.success);
        } catch {
          return false;
        }
      })();
      try {
        return await reloginInFlight;
      } finally {
        reloginInFlight = null;
      }
    }

    function urlOf(input: any): string {
      try {
        if (typeof input === 'string') return input;
        if (input instanceof URL) return input.href;
        if (input && typeof input.url === 'string') return input.url;
      } catch {}
      return '';
    }

    function isRetriableApi(input: any): boolean {
      const url = urlOf(input);
      // Solo chiamate API interne. Mai il login/logout (eviterebbe loop).
      // Solo input riutilizzabile (string/URL): un Request ha il body già consumato.
      const reusable = typeof input === 'string' || input instanceof URL;
      return (
        reusable &&
        url.includes('/api/') &&
        !url.includes('/api/auth/login') &&
        !url.includes('/api/auth/logout')
      );
    }

    async function isSessionExpired(res: Response): Promise<boolean> {
      if (res.status === 401) return true;
      try {
        const txt = await res.clone().text();
        return txt.includes('SESSION_EXPIRED');
      } catch {
        return false;
      }
    }

    window.fetch = async function (input: any, init?: any) {
      const res = await originalFetch(input, init);
      if (!res.ok && isRetriableApi(input) && (await isSessionExpired(res))) {
        const ok = await silentRelogin();
        if (ok) {
          return originalFetch(input, init);
        }
      }
      return res;
    } as typeof window.fetch;

    return () => {
      window.fetch = originalFetch;
      w.__lapaSessionKeeperInstalled = false;
    };
  }, []);

  return null;
}
