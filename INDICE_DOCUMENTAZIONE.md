# Indice della Documentazione AppHub Platform

## File Creati

### 1. APPHUB_COMPLETE_GUIDE.md (PRINCIPALE)
**628 righe - 15 KB**

Documentazione COMPLETA su come creare un'app sulla piattaforma AppHub Platform.

Contiene:
- Panoramica della piattaforma
- Struttura del progetto (app/, lib/, components/)
- Come creare una nuova app (step-by-step)
- Integrazione Odoo (autenticazione, RPC calls)
- Sistema di autenticazione e permessi
- 4 pattern di API calls a Odoo:
  - Simple Search-Read
  - Domain Filters Complessi
  - Create con Validazione
  - Batch Operations
- Esempi di 3 app esistenti:
  - MAESTRO AI Dashboard
  - Product Creator
  - Dashboard Venditori
- Stack tecnologico completo
- Checklist creazione nuova app
- Problemi comuni e soluzioni

**LEGGI QUESTO PRIMO** per comprendere la piattaforma.

---

## Roadmap: Come Usare la Documentazione

### Se vuoi creare una NUOVA APP:

1. Leggi sezione "Come Creare una Nuova App" in APPHUB_COMPLETE_GUIDE.md
2. Usa i 4 template forniti:
   - page.tsx
   - layout.tsx
   - API route
   - README.md
3. Verifica con il checklist finale
4. Testa con account con ruoli diversi

### Se vuoi integrare ODOO:

1. Leggi sezione "Integrazione Odoo" in APPHUB_COMPLETE_GUIDE.md
2. Configura .env.local con:
   - ODOO_HOST
   - ODOO_DATABASE
   - ODOO_USERNAME
   - ODOO_PASSWORD
   - ODOO_PORT
   - ODOO_PROTOCOL
   - NEXT_PUBLIC_ODOO_URL
3. Usa OdooRPCClient nei tuoi endpoint
4. Segui i 4 pattern di API calls
5. Implementa error handling

### Se vuoi gestire AUTENTICAZIONE:

1. Leggi sezione "Autenticazione e Permessi" in APPHUB_COMPLETE_GUIDE.md
2. Usa useAuthStore di Zustand
3. Proteggi le tue routes con:
   - useRouter.push() se non autorizzato
   - Verifica user?.role
   - Controllo isAuthenticated
4. Implementa middleware se necessario

### Se vuoi fare API CALLS a ODOO:

1. Leggi sezione "API Calls a Odoo - Pattern Completi" in APPHUB_COMPLETE_GUIDE.md
2. Scegli il pattern adatto:
   - Search-Read per leggere
   - Create per creare
   - Write per aggiornare
   - Batch per operazioni multiple
3. Usa il template di codice
4. Aggiungi error handling
5. Testa con Postman o curl

### Se vuoi capire APP ESISTENTI:

1. Leggi sezione "Esempi di App Esistenti" in APPHUB_COMPLETE_GUIDE.md
2. Studia le 3 app:
   - MAESTRO AI: Dashboard analytics
   - Product Creator: AI invoice parsing
   - Dashboard Venditori: Gestione clienti
3. Usa come template per le tue app
4. Adatta il pattern alle tue necessità

---

## Riferimenti Rapidi

### Struttura Directory

```
app-hub-platform/
├── app/
│   ├── api/              # API routes
│   ├── maestro-ai/       # App MAESTRO AI
│   ├── product-creator/  # App Product Creator
│   └── [your-app]/       # TUA APP QUI
├── components/           # React components
├── lib/
│   ├── odoo/            # Odoo integration
│   ├── maestro/         # MAESTRO AI logic
│   ├── store/           # Zustand stores
│   └── utils.ts         # Global utilities
└── hooks/               # Custom hooks
```

### Stack Tecnologico

Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS, Framer Motion
Backend: Node.js, Next.js API Routes, JWT auth
Odoo: RPC client custom, SessionManager, auto-reconnect

### Modelli Odoo Principali

- res.partner (clienti/fornitori)
- sale.order (ordini)
- product.product (prodotti)
- account.move (fatture)
- crm.team (team vendite)

### Componenti Principali

- OdooClient: Autenticazione
- OdooRPCClient: RPC calls
- SessionManager: Session management
- useAuthStore: Auth state (Zustand)
- useOdooData: Fetch dati Odoo (hook)

---

## Checklist Rapida: Creare App

- [ ] mkdir app/my-app
- [ ] Crea page.tsx (client component)
- [ ] Crea layout.tsx (con metadata)
- [ ] Crea README.md
- [ ] (Opzionale) Crea app/api/my-app/route.ts
- [ ] Aggiungi controllo ruoli in page.tsx
- [ ] Testa con account diversi
- [ ] Aggiungi in data/apps.ts se public
- [ ] Commit con messaggio descrittivo
- [ ] Apri PR su development

---

## Best Practices

1. SEMPRE usare TypeScript (no 'any')
2. SEMPRE validare input server-side
3. SEMPRE gestire errori (try-catch)
4. SEMPRE usare environment variables
5. SEMPRE proteggere routes (controllo auth)
6. SEMPRE fare API calls via API routes (no fetch da client diretto a Odoo)
7. SEMPRE usare SessionManager per Odoo (auto-reconnect)
8. SEMPRE usare Zustand per state
9. SEMPRE memoizzare componenti expensive
10. SEMPRE testare con ruoli diversi (visitor, free, pro, admin)

---

## Risorse Interne

- README.md: Overview progetto
- docs/LOGO-SYSTEM.md: Sistema logo dinamico
- app/product-creator/README.md: Product Creator in dettaglio
- app/dashboard-venditori/README.md: Dashboard Venditori in dettaglio
- lib/maestro/README.md: MAESTRO AI sync engine in dettaglio
- lib/odoo/config.ts: Endpoints e modelli Odoo

---

## Troubleshooting

**Errore: "Session expired"**
Soluzione: SessionManager fa auto-reconnect automatico

**Errore: "401 Unauthorized"**
Soluzione: Verifica odoo_session_id cookie presente e valido

**Errore: "Model not found"**
Soluzione: Verifica nomeclatura modello Odoo corretta

**Errore: "Field not in model"**
Soluzione: Verifica field list con team Odoo

**Errore: "Timeout"**
Soluzione: export const maxDuration = 300; in route.ts

---

## Contatti e Info

Documentazione creata: Novembre 2025
Versione: 1.0.0
Licenza: Proprietaria LAPA
Ultimo update: 2025-11-08

Per domande sulla documentazione:
1. Leggi il README.md principale
2. Controlla la documentazione interna delle app
3. Studia il codice della app più simile

---

**NOTA**: Questa documentazione è auto-generata dalla analisi del codebase.
Mantienila aggiornata quando cambiano le strutture principali.

