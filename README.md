# 🚀 App Hub Platform

Una piattaforma moderna e responsive per gestire multiple applicazioni con sistema di autenticazione, controllo degli accessi, design glassmorphism e integrazione Odoo 17.

## ✨ Caratteristiche Principali

### 🎨 Design Moderno
- **Glassmorphism effects** con Tailwind CSS personalizzato
- **Animazioni fluide** con Framer Motion e React Spring
- **Dark/Light mode** con tema automatico e transizioni
- **Design responsive** mobile-first ottimizzato
- **Scroll animations** e intersection observer
- **Gradients dinamici** e effetti hover avanzati

### 🔐 Sistema di Autenticazione Completo
- **JWT Authentication** con cookie HttpOnly sicuri
- **Sistema ruoli avanzato**: Visitor, Free User, PRO User, Admin, Enterprise
- **Controllo accessi granulare** basato sui ruoli
- **Forms animati** di login/registrazione con validazione
- **Account demo preconfigurati** per testing
- **Session management** automatico
- **Password hashing** con bcryptjs

### 🏗️ Architettura Moderna
- **Next.js 14** con App Router e Server Components
- **TypeScript** completo con types sicuri
- **Zustand** per state management reattivo
- **API Routes RESTful** per backend
- **Middleware di autenticazione** custom
- **Error boundaries** e handling robusto

### 🔌 Integrazione Odoo 17
- **Client Odoo completo** con autenticazione
- **API wrapper** per tutte le operazioni CRUD
- **Sincronizzazione dati** in tempo reale
- **Gestione errori** e fallback
- **Environment variables** configurabili
- **Servizi specializzati** per menu e prenotazioni

### 📱 App Complete Incluse
1. **🍽️ Menu App** (FREE) - Gestione completa menu ristorante con:
   - Categorie dinamiche (Antipasti, Primi, Secondi, Dolci, Bevande)
   - Filtri dietetici (Vegetariano, Vegano, Senza Glutine, Piccante)
   - Ricerca avanzata per nome/ingredienti
   - Cards animate con informazioni nutrizionali
   - Gestione allergeni e calorie
   - UI responsive per mobile

2. **📅 Booking System** (PRO) - Sistema prenotazioni avanzato
3. **🤖 AI Chat** (PRO) - Chatbot intelligente
4. **📊 Analytics Dashboard** (FREE) - Dashboard analytics
5. **✅ Task Manager** (FREE) - Gestione progetti e task
6. **🧾 Invoice Generator** (COMING SOON) - Generatore fatture

### 💰 Sistema Pricing
- **Pagina prezzi** professionale con 3 tier
- **Piano Gratuito** con app essenziali
- **Piano PRO** (€29/mese) con funzionalità avanzate
- **Piano Enterprise** (€99/mese) con integrazione completa
- **Toggle mensile/annuale** con sconto
- **FAQ** e call-to-action integrate

## 🚀 Setup Locale Completo

### Prerequisites
- **Node.js 18+** (consigliato 20.x)
- **npm** o **yarn** o **pnpm**
- **Git** per version control

### 1. Clona e Setup del Progetto

\`\`\`bash
# Clona il repository
git clone https://github.com/your-username/app-hub-platform.git
cd app-hub-platform

# Installa le dipendenze
npm install

# Copia e configura environment variables
cp .env.example .env.local
\`\`\`

### 2. Configurazione Environment Variables

Modifica il file \`.env.local\` con le tue configurazioni:

\`\`\`env
# JWT Secret - CAMBIA QUESTO IN PRODUZIONE!
JWT_SECRET=your-super-secret-jwt-key-make-it-very-long-and-random-for-production

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Odoo 17 Integration (opzionale per development)
ODOO_HOST=your-odoo-server.com
ODOO_DATABASE=your-database-name
ODOO_USERNAME=your-odoo-username
ODOO_PASSWORD=your-odoo-password
ODOO_PORT=8069
ODOO_PROTOCOL=https
\`\`\`

### 3. Avvio Development Server

\`\`\`bash
# Avvia il server di sviluppo
npm run dev

# Server disponibile su http://localhost:3000
\`\`\`

### 4. Build e Produzione

\`\`\`bash
# Build per produzione
npm run build

# Avvia server di produzione
npm run start

# Type checking
npm run type-check

# Linting
npm run lint
\`\`\`

## 🔑 Account Demo

Per testare la piattaforma, usa questi account preconfigurati:

| Ruolo | Email | Password | Accesso |
|-------|-------|----------|---------|
| **Admin** | admin@apphub.com | admin123 | Tutte le app |
| **PRO User** | pro@apphub.com | pro123 | App FREE + PRO |
| **Free User** | free@apphub.com | free123 | Solo app FREE |

## 📦 Struttura del Progetto

\`\`\`
app-hub-platform/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── apps/              # App pages
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Home page
├── components/            # React components
│   ├── auth/             # Authentication components
│   ├── layout/           # Layout components
│   ├── providers/        # Context providers
│   └── ui/               # UI components
├── data/                 # Mock data
├── lib/                  # Utility functions
├── stores/               # Zustand stores
├── types/                # TypeScript types
└── ...config files
\`\`\`

## 🛠️ Scripts Disponibili

\`\`\`bash
npm run dev          # Avvia development server
npm run build        # Build per produzione
npm run start        # Avvia production server
npm run lint         # Linting del codice
npm run type-check   # Type checking TypeScript
\`\`\`

## 📦 Setup GitHub Repository

### 1. Inizializzazione Repository Locale

\`\`\`bash
# Inizializza git repository
git init

# Aggiungi tutti i file
git add .

# Primo commit
git commit -m "🚀 Initial commit: App Hub Platform with Menu App, Odoo integration, and Pricing page

Features:
- Complete authentication system with JWT
- Role-based access control (visitor, free_user, pro_user, admin)
- Working Menu App with categories and dietary filters
- Odoo 17 integration preparation
- Pricing page with subscription tiers
- Modern glassmorphism UI with animations
- Dark/light mode theme
- Mobile-first responsive design
- TypeScript and Next.js 14 App Router"
\`\`\`

### 2. Creazione Repository su GitHub

\`\`\`bash
# Crea repository su GitHub (tramite GitHub CLI)
gh repo create app-hub-platform --public --description "🚀 Modern App Hub Platform with Odoo integration"

# Oppure manualmente:
# 1. Vai su https://github.com/new
# 2. Nome repository: app-hub-platform
# 3. Descrizione: 🚀 Modern App Hub Platform with Odoo integration
# 4. Pubblico
# 5. NON inizializzare con README (abbiamo già tutto)

# Aggiungi remote origin
git remote add origin https://github.com/your-username/app-hub-platform.git

# Push del codice
git branch -M main
git push -u origin main
\`\`\`

### 3. Configurazione Repository

\`\`\`bash
# Crea branch development
git checkout -b development
git push -u origin development

# Crea branch feature per future modifiche
git checkout -b feature/your-feature-name
\`\`\`

## 🌐 Deployment Vercel (Production)

### 1. Deployment Automatico da GitHub

1. **Connetti a Vercel**
   - Vai su [vercel.com](https://vercel.com)
   - Fai login con il tuo account GitHub
   - Clicca "New Project"
   - Seleziona il repository \`app-hub-platform\`

2. **Configurazione Build Settings**
   ```
   Framework Preset: Next.js
   Build Command: npm run build
   Output Directory: .next (automatico)
   Install Command: npm install
   ```

### 2. Environment Variables su Vercel

Nel dashboard Vercel, vai in **Settings → Environment Variables** e aggiungi:

\`\`\`env
# Production JWT Secret (GENERA UNA NUOVA STRINGA LUNGA E CASUALE)
JWT_SECRET=your-production-jwt-secret-very-long-and-random-string-123456789

# App URL (sarà il dominio Vercel)
NEXT_PUBLIC_APP_URL=https://your-app-name.vercel.app

# Odoo Production (se disponibile)
ODOO_HOST=your-production-odoo-server.com
ODOO_DATABASE=production-database
ODOO_USERNAME=production-user
ODOO_PASSWORD=production-password
ODOO_PORT=8069
ODOO_PROTOCOL=https
\`\`\`

### 3. Dominio Personalizzato (Opzionale)

1. Nel dashboard Vercel, vai in **Settings → Domains**
2. Aggiungi il tuo dominio personalizzato
3. Configura i DNS records come indicato
4. Aggiorna \`NEXT_PUBLIC_APP_URL\` con il nuovo dominio

### 4. Deploy Automatici

- **Main branch** → Deploy automatico in produzione
- **Development branch** → Deploy su environment di preview
- **Pull Requests** → Deploy preview per ogni PR

## 🔄 Workflow di Sviluppo

\`\`\`bash
# 1. Crea feature branch
git checkout development
git pull origin development
git checkout -b feature/new-feature

# 2. Sviluppa la feature
# ... fai le tue modifiche ...

# 3. Commit e push
git add .
git commit -m "✨ Add new feature: description"
git push -u origin feature/new-feature

# 4. Crea Pull Request su GitHub
gh pr create --title "✨ Add new feature" --body "Description of changes"

# 5. Dopo review e merge, cleanup
git checkout development
git pull origin development
git branch -d feature/new-feature
\`\`\`

## 🔧 Personalizzazione

### Aggiungere Nuove App
1. Aggiungi l'app in \`data/apps.ts\`
2. Crea la pagina in \`app/apps/[app-name]/page.tsx\`
3. Configura il ruolo richiesto e badge

### Modificare Temi
- Colori: \`tailwind.config.js\`
- CSS custom: \`app/globals.css\`
- Componenti tema: \`components/ui/ThemeToggle.tsx\`

### Sistema di Ruoli
Modifica \`lib/auth.ts\` per personalizzare:
- Gerarchia ruoli
- Controllo accessi
- Validazioni

## 🔒 Sicurezza

- ✅ JWT tokens con expire
- ✅ HttpOnly cookies
- ✅ CSRF protection
- ✅ Input validation
- ✅ Security headers
- ✅ Password hashing (bcryptjs)

## 🚀 Performance

- ✅ Server-side rendering (SSR)
- ✅ Static generation dove possibile
- ✅ Image optimization
- ✅ Code splitting automatico
- ✅ Lazy loading components
- ✅ Optimized fonts (Inter)

## 🤝 Contributing

1. Fork il progetto
2. Crea un feature branch (\`git checkout -b feature/AmazingFeature\`)
3. Commit le modifiche (\`git commit -m 'Add some AmazingFeature'\`)
4. Push al branch (\`git push origin feature/AmazingFeature\`)
5. Apri una Pull Request

## 📝 License

Distribuito sotto licenza MIT. Vedi \`LICENSE\` per maggiori informazioni.

## 🆘 Support

Per supporto:
- 📖 Consulta la documentazione
- 🐛 Apri un issue su GitHub
- 💬 Contattaci via email

---

⭐ Se questo progetto ti è stato utile, lascia una stella!