'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAppTracking } from '@/hooks/useAppTracking';

/**
 * Componente globale per tracking automatico di tutte le pagine
 * Mappa automaticamente le route alle app
 */

// Mappa delle route alle app con nomi leggibili
const ROUTE_TO_APP_MAP: Record<string, { appId: string; appName: string }> = {
  '/super-dashboard': { appId: 'super-dashboard', appName: 'Super Dashboard' },
  '/super-dashboard/app-usage': { appId: 'app-usage-analytics', appName: 'App Usage Analytics' },
  '/super-dashboard/margini': { appId: 'margini-dashboard', appName: 'Analisi Margini' },
  '/super-dashboard/revenue': { appId: 'revenue-dashboard', appName: 'Revenue Dashboard' },
  '/super-dashboard/orders': { appId: 'orders-dashboard', appName: 'Orders Dashboard' },
  '/super-dashboard/customers': { appId: 'customers-dashboard', appName: 'Customers Dashboard' },

  // Dashboard e home
  '/dashboard': { appId: 'main-dashboard', appName: 'Dashboard Principale' },
  '/': { appId: 'home', appName: 'Home' },

  // App principali
  '/inventory': { appId: 'inventory', appName: 'Gestione Inventario' },
  '/delivery': { appId: 'delivery', appName: 'Delivery & Consegne' },
  '/picking': { appId: 'picking', appName: 'Picking & Preparazione Ordini' },
  '/arrivo-merce': { appId: 'arrivo-merce', appName: 'Arrivo Merce' },
  '/ubicazioni': { appId: 'ubicazioni', appName: 'Gestione Ubicazioni' },

  // Maestro AI
  '/maestro-ai': { appId: 'maestro-ai', appName: 'Maestro AI' },
  '/maestro-ai/analytics': { appId: 'maestro-analytics', appName: 'Maestro Analytics' },
  '/maestro-ai/vehicle-stock': { appId: 'vehicle-stock', appName: 'Stock Veicoli' },

  // Analisi e reporting
  '/analisi-prodotto': { appId: 'analisi-prodotto', appName: 'Analisi Prodotti' },
  '/import-movimenti-ubs': { appId: 'import-ubs', appName: 'Import Movimenti UBS' },

  // Smart ordering
  '/smart-ordering': { appId: 'smart-ordering', appName: 'Smart Ordering' },
  '/smart-ordering-v2': { appId: 'smart-ordering-v2', appName: 'Smart Ordering V2' },
  '/smart-ordering-ai': { appId: 'smart-ordering-ai', appName: 'Smart Ordering AI' },

  // Ordini fornitori
  '/ordini-fornitori': { appId: 'ordini-fornitori', appName: 'Ordini Fornitori' },

  // Validazione fatture
  '/valida-fatture': { appId: 'valida-fatture', appName: 'Validazione Fatture' },

  // Product creator
  '/product-creator': { appId: 'product-creator', appName: 'Product Creator' },

  // Admin
  '/admin': { appId: 'admin', appName: 'Amministrazione' },
  '/admin/users': { appId: 'admin-users', appName: 'Gestione Utenti' },

  // Agents e AI
  '/agents': { appId: 'agents', appName: 'AI Agents' },
  '/stella': { appId: 'stella', appName: 'Stella AI Assistant' },

  // Daily plan
  '/daily-plan': { appId: 'daily-plan', appName: 'Piano Giornaliero' },
};

// Pattern per riconoscere dinamicamente le app da route dinamiche
const DYNAMIC_PATTERNS = [
  { pattern: /^\/inventory\//, appId: 'inventory', appName: 'Gestione Inventario' },
  { pattern: /^\/delivery\//, appId: 'delivery', appName: 'Delivery & Consegne' },
  { pattern: /^\/picking\//, appId: 'picking', appName: 'Picking' },
  { pattern: /^\/maestro-ai\//, appId: 'maestro-ai', appName: 'Maestro AI' },
  { pattern: /^\/admin\//, appId: 'admin', appName: 'Amministrazione' },
];

function getAppFromRoute(pathname: string): { appId: string; appName: string } | null {
  // Cerca prima nelle route esatte
  if (ROUTE_TO_APP_MAP[pathname]) {
    return ROUTE_TO_APP_MAP[pathname];
  }

  // Cerca nei pattern dinamici
  for (const { pattern, appId, appName } of DYNAMIC_PATTERNS) {
    if (pattern.test(pathname)) {
      return { appId, appName };
    }
  }

  // Se non trovato, genera un nome generico dalla route
  if (pathname !== '/' && pathname.length > 1) {
    const segments = pathname.split('/').filter(Boolean);
    const appId = segments.join('-');
    const appName = segments
      .map(s => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '))
      .join(' - ');

    return { appId, appName };
  }

  return null;
}

export function GlobalAppTracker() {
  const pathname = usePathname();

  // Determina quale app tracciare basandosi sulla route
  const appInfo = pathname ? getAppFromRoute(pathname) : null;

  // Usa il tracking hook se abbiamo identificato un'app
  useAppTracking({
    appId: appInfo?.appId || 'unknown',
    appName: appInfo?.appName || 'Pagina Sconosciuta',
    enabled: !!appInfo, // Abilita solo se abbiamo identificato l'app
  });

  return null; // Questo componente non renderizza nulla
}
