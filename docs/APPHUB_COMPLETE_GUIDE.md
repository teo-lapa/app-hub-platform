# APPHUB PLATFORM - Documentazione Completa

## Indice
1. Panoramica della Piattaforma
2. Struttura del Progetto
3. Come Creare una Nuova App
4. Integrazione Odoo
5. Autenticazione e Permessi
6. API Calls a Odoo
7. Esempi di App Esistenti
8. Stack Tecnologico

---

## Panoramica della Piattaforma

AppHub Platform è una piattaforma moderna Next.js 14 per gestire multiple applicazioni con:

### Caratteristiche Principali

- Autenticazione JWT completa con session management
- Sistema di Ruoli avanzato: Visitor → Free User → PRO User → Admin → Enterprise
- Integrazione Odoo 17 nativa con API RPC
- Design Glassmorphism responsive mobile-first
- Dark/Light mode con tema automatico
- TypeScript strict con type safety completo
- PWA-ready con offline support
- Zustand per state management
- Next.js 14 App Router con server/client components

### URL Principale

NEXT_PUBLIC_APP_URL=http://localhost:3000

---

## Struttura del Progetto

### Directory Root

```
app-hub-platform/
├── app/                           # Next.js App Router
│   ├── api/                       # API routes
│   │   ├── auth/                  # Autenticazione
│   │   ├── odoo/                  # Integrazione Odoo
│   │   └── [app-name]/            # API per singola app
│   ├── maestro-ai/               # App MAESTRO AI
│   ├── product-creator/          # App Product Creator
│   ├── dashboard-venditori/      # App Dashboard Venditori
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
│
├── components/                    # React components
│   ├── auth/                      # Auth components
│   ├── maestro/                   # MAESTRO AI components
│   └── providers/                 # Context providers
│
├── lib/                           # Utility functions
│   ├── odoo/                      # Odoo integration
│   │   ├── client.ts              # OdooClient
│   │   ├── rpcClient.ts           # RPC client
│   │   ├── sessionManager.ts      # Session management
│   │   └── config.ts              # Configuration
│   ├── maestro/                   # MAESTRO AI logic
│   ├── store/                     # Zustand stores
│   └── utils.ts                   # Global utilities
│
├── hooks/                         # Custom hooks
└── types/                         # TypeScript types
```


---

## Come Creare una Nuova App

### Step 1: Creazione Directory

mkdir -p app/my-new-app
touch app/my-new-app/page.tsx
touch app/my-new-app/layout.tsx
touch app/my-new-app/README.md

### Step 2: Page Principale (page.tsx)

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/lib/store/authStore';
import { useRouter } from 'next/navigation';

export default function MyNewApp() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user && !['admin', 'pro_user'].includes(user.role)) {
      router.push('/');
    }
  }, [user, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold mb-4">My New App</h1>
        <p className="text-slate-400">Welcome, {user?.name}!</p>
      </motion.div>
    </div>
  );
}

### Step 3: Layout (layout.tsx)

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My New App | AppHub Platform',
  description: 'Description of my new app',
};

export default function MyNewAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

### Step 4: API Route (Opzionale)

mkdir -p app/api/my-new-app
touch app/api/my-new-app/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fai logica
    const data = { /* ... */ };

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

---

## Integrazione Odoo

### Configurazione Environment (.env.local)

ODOO_HOST=your-odoo-instance.odoo.com
ODOO_DATABASE=your-database
ODOO_USERNAME=your-username
ODOO_PASSWORD=your-password
ODOO_PORT=8069
ODOO_PROTOCOL=https
NEXT_PUBLIC_ODOO_URL=https://your-odoo-instance.odoo.com

### OdooClient - Autenticazione

import { OdooClient } from '@/lib/odoo/client';

const client = new OdooClient('https://odoo-url.com', 'database-name');

const authResult = await client.authenticate('email@example.com', 'password');
if (authResult) {
  const { session, authResult: userData } = authResult;
  const user = await client.getUserInfo(session, userData);
  console.log('Logged in as:', user.name);
}

### OdooRPCClient - RPC Calls

import { OdooRPCClient } from '@/lib/odoo/rpcClient';

const client = new OdooRPCClient();

// Search and Read
const partners = await client.searchRead(
  'res.partner',
  [['customer_rank', '>', 0]],
  ['id', 'name', 'email', 'phone'],
  50,
  'name asc'
);

// Callkw - Metodo generico
const result = await client.callKw(
  'sale.order',
  'search_read',
  [[['state', '=', 'sale']]],
  { fields: ['id', 'name', 'partner_id', 'amount_total'], limit: 10 }
);

// Create
const newProductId = await client.callKw(
  'product.product',
  'create',
  [{ name: 'New Product', type: 'product' }]
);

// Update
await client.callKw(
  'res.partner',
  'write',
  [[partner_id], { name: 'New Name' }]
);


---

## Autenticazione e Permessi

### Sistema di Ruoli

type UserRole = 'visitor' | 'free_user' | 'pro_user' | 'admin' | 'enterprise';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isAuthenticated: boolean;
}

### Auth Store (Zustand)

import { useAuthStore } from '@/lib/store/authStore';

const { user, isAuthenticated, login, logout } = useAuthStore();

if (user?.role === 'admin') {
  // Admin only
}

### Protezione Routes

'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { useEffect } from 'react';

export default function ProtectedPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!['pro_user', 'admin'].includes(user?.role)) {
      router.push('/pricing');
      return;
    }
  }, [isAuthenticated, user, router]);

  return <div>Protected content</div>;
}

---

## API Calls a Odoo - Pattern Completo

### Pattern 1: Simple Search-Read

// Backend API Route
import { OdooRPCClient } from '@/lib/odoo/rpcClient';

export async function GET(request: NextRequest) {
  try {
    const client = new OdooRPCClient();
    
    const partners = await client.searchRead(
      'res.partner',
      [['customer_rank', '>', 0]],
      ['id', 'name', 'email', 'phone'],
      100,
      'name asc'
    );

    return NextResponse.json({ success: true, data: partners });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    );
  }
}

// Frontend Hook
'use client';
import { useEffect, useState } from 'react';

export function usePartners() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/partners')
      .then(r => r.json())
      .then(r => setData(r.data || []))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

### Pattern 2: Domain Filters Complessi

const domain = [
  '&',
  ['customer_rank', '>', 0],
  ['is_company', '=', true],
  '|',
  ['city', 'ilike', 'Milano'],
  ['city', 'ilike', 'Roma']
];

const results = await client.searchRead(
  'res.partner',
  domain,
  ['id', 'name', 'city'],
  0,
  'name asc'
);

### Pattern 3: Create con Validazione

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Nome obbligatorio' },
        { status: 400 }
      );
    }

    const client = new OdooRPCClient();

    const partnerId = await client.callKw(
      'res.partner',
      'create',
      [{
        name,
        email,
        phone,
        type: 'contact',
        is_company: true
      }]
    );

    return NextResponse.json({
      success: true,
      data: { id: partnerId }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    );
  }
}

### Pattern 4: Batch Operations

export async function POST(request: NextRequest) {
  try {
    const { partners } = await request.json();
    const client = new OdooRPCClient();
    
    const results = [];

    for (const partner of partners) {
      try {
        const id = await client.callKw('res.partner', 'create', [partner]);
        results.push({ success: true, id });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      created: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    );
  }
}


---

## Esempi di App Esistenti

### 1. MAESTRO AI Dashboard

Path: /maestro-ai
Ruolo richiesto: ADMIN / PRO_USER
Funzionalità: Analytics, Customer Intelligence, Daily Planning

File Principali:
- app/maestro-ai/page.tsx - Manager Dashboard
- app/maestro-ai/daily-plan/page.tsx - Daily Plan Venditore
- app/maestro-ai/customers/[id]/page.tsx - Customer Detail
- lib/maestro/sync-odoo-v2.ts - Sync engine
- lib/maestro/types.ts - TypeScript types

Integrazione Odoo:

import { syncCustomersFromOdoo } from '@/lib/maestro/sync-odoo-v2';

const result = await syncCustomersFromOdoo({
  monthsBack: 4,      // Ultimi 4 mesi
  maxCustomers: 0,    // 0 = tutti
  dryRun: false
});

console.log(`Synced ${result.synced} customers`);

API Endpoints:
- GET /api/maestro/dashboard - KPIs e analytics
- GET /api/maestro/analytics - Dati dettagliati
- GET /api/maestro/daily-plan?salesperson_id={id} - Piano giornaliero
- GET /api/maestro/customers/{id} - Dettaglio cliente

### 2. Product Creator

Path: /product-creator
Ruolo richiesto: PRO_USER / ADMIN
Funzionalità: AI-powered invoice parsing, product creation

Workflow:
1. Upload PDF/Immagine fattura
2. AI estrae prodotti (Claude Vision)
3. Enrichment automatico con Odoo context
4. Creazione prodotti in Odoo
5. Generazione immagini con Gemini AI

API Calls Odoo:

// Recupera categorie
const categories = await client.callKw('product.category', 'search_read', [[]], {
  fields: ['id', 'name', 'parent_id']
});

// Recupera UoM
const uoms = await client.callKw('uom.uom', 'search_read', [[]], {
  fields: ['id', 'name']
});

// Crea prodotto
const productId = await client.callKw('product.product', 'create', [{
  name: product.nome,
  type: 'product',
  categ_id: category_id,
  uom_id: uom_id,
  list_price: price
}]);

### 3. Dashboard Venditori

Path: /dashboard-venditori
Ruolo richiesto: ADMIN / PRO_USER
Funzionalità: Gestione clienti, metriche team, health score

Permessi:

const USER_TEAM_PERMISSIONS = {
  407: [1],     // User ID → Team IDs allowed
  249: 'ALL',   // Super admin
};

Odoo Models:
- res.partner - Clienti
- crm.team - Team vendite
- sale.order - Ordini
- account.move - Fatture

---

## Stack Tecnologico

### Frontend
- Framework: Next.js 14 con App Router
- UI Library: React 18
- Styling: Tailwind CSS 3
- Animations: Framer Motion
- Icons: Lucide React
- Charts: Recharts
- Notifications: React Hot Toast
- Language: TypeScript 5

### Backend
- Runtime: Node.js 18+
- API: Next.js API Routes
- Database: Vercel Postgres (opzionale)
- Odoo Integration: Native RPC client
- Auth: JWT + Cookies HttpOnly

### DevOps
- Version Control: Git
- Package Manager: npm / pnpm
- Build: Next.js build system
- Linting: ESLint
- Type Checking: TypeScript
- Deployment: Vercel (recommended)

### Dependencies Principali

{
  "next": "^14.0.0",
  "react": "^18.0.0",
  "typescript": "^5.0.0",
  "tailwindcss": "^3.0.0",
  "framer-motion": "^11.0.0",
  "zustand": "^4.0.0",
  "react-hot-toast": "^2.0.0",
  "recharts": "^2.10.0",
  "lucide-react": "^0.294.0"
}

---

## Modelli Odoo Comunemente Usati

res.partner          # Clienti e fornitori
crm.team             # Team vendite
sale.order           # Ordini di vendita
sale.order.line      # Righe ordini
product.product      # Prodotti
product.category     # Categorie prodotti
uom.uom              # Unità di misura
account.move         # Fatture
account.move.line    # Righe fatture
hr.employee          # Dipendenti
res.users            # Utenti sistema
stock.location       # Ubicazioni magazzino
stock.picking        # Prelievi/Carichi
stock.move.line      # Righe movimenti

---

## Checklist Creazione Nuova App

- [ ] Crea directory app/my-app
- [ ] Aggiungi page.tsx con componente client
- [ ] Aggiungi layout.tsx con metadata
- [ ] Aggiungi README.md con documentazione
- [ ] (Opzionale) Aggiungi API route in app/api/my-app
- [ ] Implementa protezione ruoli in page.tsx
- [ ] Testa con account diversi (free, pro, admin)
- [ ] Aggiungi in data/apps.ts se per app hub
- [ ] Commit con messaggio descrittivo
- [ ] Apri PR su development branch

---

## Problemi Comuni e Soluzioni

ERRORE: "Session expired"
SOLUZIONE: SessionManager fa auto-reconnect automatico

ERRORE: "401 Unauthorized"
SOLUZIONE: Verifica che odoo_session_id cookie sia presente e valido

ERRORE: "Model not found"
SOLUZIONE: Verifica modello Odoo esiste e nomeclatura corretta

ERRORE: "Field not in model"
SOLUZIONE: Verifica field list con il team Odoo

ERRORE: "Timeout"
SOLUZIONE: Aumenta maxDuration in route.ts
export const maxDuration = 300; // 5 minuti

---

## Documentazione Interna

README.md - Overview progetto
docs/LOGO-SYSTEM.md - Sistema logo dinamico
app/product-creator/README.md - Product Creator app
app/dashboard-venditori/README.md - Dashboard Venditori
lib/maestro/README.md - MAESTRO AI sync engine

---

Ultima aggiornamento: Novembre 2025
Versione: 1.0.0
Licenza: Proprietaria LAPA

