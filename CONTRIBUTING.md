# 🤝 Guida per Contribuire al Progetto

## 🚨 REGOLA NUMERO 1: Leggi ODOO_AUTH_SYSTEM.md

**PRIMA di scrivere qualsiasi codice che interagisce con Odoo**, leggi:
👉 [ODOO_AUTH_SYSTEM.md](./ODOO_AUTH_SYSTEM.md)

---

## ✅ Checklist Prima di Ogni Commit

- [ ] Ho letto ODOO_AUTH_SYSTEM.md
- [ ] Il mio codice NON contiene credenziali hardcoded
- [ ] Le mie API usano `getOdooSession()` e `callOdoo()`
- [ ] Le mie API ritornano 401 se l'utente non è loggato
- [ ] NON ho usato `lib/odoo-client.ts` (è deprecato)
- [ ] I test di compliance passano

---

## 🔒 Sistema di Autenticazione Odoo

### ❌ NON FARE MAI QUESTO

```typescript
// ❌ SBAGLIATO - Credenziali hardcoded
const ODOO_LOGIN = 'admin@example.com';
const ODOO_PASSWORD = 'password123';

// ❌ SBAGLIATO - Fallback con credenziali
const login = process.env.ODOO_USERNAME || 'admin';

// ❌ SBAGLIATO - Usa odoo-client.ts deprecato
import { getOdooClient } from '@/lib/odoo-client';
```

### ✅ FARE SEMPRE QUESTO

```typescript
// ✅ CORRETTO - Usa odoo-auth.ts
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    // 1. Prendi cookie dell'utente
    const userCookies = cookies().toString();

    // 2. Ottieni sessione Odoo (lancia errore se utente non loggato)
    const { cookies: odooCookies } = await getOdooSession(userCookies);

    // 3. Chiama Odoo con sessione utente
    const data = await callOdoo(
      odooCookies,
      'res.partner',
      'search_read',
      [],
      {
        domain: [['customer_rank', '>', 0]],
        fields: ['id', 'name', 'email'],
        limit: 10
      }
    );

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    // 4. Gestisci errore di autenticazione
    if (error.message?.includes('non autenticato')) {
      return NextResponse.json(
        { success: false, error: 'Devi fare login' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Errore server' },
      { status: 500 }
    );
  }
}
```

---

## 🛡️ Protezioni Automatiche

Il progetto ha 3 livelli di protezione:

### 1️⃣ Pre-Commit Hook
Quando fai `git commit`, controlla automaticamente:
- ❌ Credenziali hardcoded
- ❌ Uso di `odoo-client.ts`
- ⚠️  Mancanza di gestione cookie

**Se trova problemi → BLOCCA il commit**

### 2️⃣ Test Automatici
Esegui `npm test` per verificare:
- Nessuna credenziale nel codice
- API conformi a ODOO_AUTH_SYSTEM.md
- Documentazione aggiornata

### 3️⃣ GitHub Action
Ad ogni push/PR verifica:
- Compliance con ODOO_AUTH_SYSTEM.md
- Nessun file deprecato usato
- Test passano

---

## 🚀 Setup Ambiente di Sviluppo

### 1. Clona il repository
```bash
git clone https://github.com/teo-lapa/app-hub-platform.git
cd app-hub-platform
```

### 2. Installa dipendenze
```bash
npm install
```

### 3. Configura variabili d'ambiente
```bash
# Copia .env.example in .env.local
cp .env.example .env.local

# Modifica .env.local con le tue credenziali
```

⚠️ **IMPORTANTE**: NON committare mai file `.env*` con credenziali!

### 4. Installa Husky (pre-commit hooks)
```bash
npx husky install
```

### 5. Avvia in sviluppo
```bash
npm run dev
```

---

## 🧪 Eseguire i Test

```bash
# Test di compliance ODOO_AUTH_SYSTEM.md
npm test odoo-auth-compliance

# Tutti i test
npm test

# TypeScript type check
npm run type-check
```

---

## 📝 Creare una Nuova API

### Template Base
```typescript
// app/api/my-feature/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    // Validazione input
    const { param1, param2 } = await req.json();
    if (!param1) {
      return NextResponse.json(
        { success: false, error: 'param1 richiesto' },
        { status: 400 }
      );
    }

    // Autenticazione utente
    const userCookies = cookies().toString();
    const { cookies: odooCookies } = await getOdooSession(userCookies);

    // Chiamata Odoo
    const result = await callOdoo(
      odooCookies,
      'your.model',
      'your_method',
      [param1, param2],
      { /* kwargs */ }
    );

    return NextResponse.json({ success: true, data: result });

  } catch (error: any) {
    console.error('[MY-FEATURE] Error:', error);

    // Gestione 401
    if (error.message?.includes('non autenticato') ||
        error.message?.includes('Devi fare login')) {
      return NextResponse.json(
        { success: false, error: 'Devi fare login' },
        { status: 401 }
      );
    }

    // Errore generico
    return NextResponse.json(
      { success: false, error: 'Errore server' },
      { status: 500 }
    );
  }
}
```

---

## 🆘 Aiuto e Supporto

### Documenti Importanti
- [ODOO_AUTH_SYSTEM.md](./ODOO_AUTH_SYSTEM.md) - **LEGGERE PRIMA DI TUTTO**
- [README.md](./README.md) - Panoramica progetto
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guida deploy

### Problemi Comuni

**Q: Il pre-commit hook blocca il mio commit**
A: Il tuo codice viola ODOO_AUTH_SYSTEM.md. Leggi l'errore e correggi.

**Q: Dove trovo le credenziali Odoo?**
A: Le credenziali sono nelle variabili d'ambiente su Vercel. NON metterle nel codice!

**Q: Posso usare `lib/odoo-client.ts`?**
A: NO! È deprecato. Usa `lib/odoo-auth.ts`.

**Q: Come testo localmente senza autenticazione?**
A: Devi fare login nell'app locale. Non ci sono credenziali di fallback.

---

## 🎯 Principi Fondamentali

1. **Sicurezza First**: Nessuna credenziale hardcoded, mai.
2. **Utente Loggato**: Ogni chiamata Odoo usa le credenziali dell'utente loggato.
3. **401 Unauthorized**: Se non c'è cookie → butta fuori.
4. **No Fallback**: Nessun sistema di fallback con credenziali di backup.
5. **Test Everything**: Se non è testato, non funziona.

---

## 📞 Contatti

Per domande o problemi:
- Apri una Issue su GitHub
- Consulta ODOO_AUTH_SYSTEM.md
- Chiedi al team prima di committare codice non conforme

---

**Ricorda**: Rispettare ODOO_AUTH_SYSTEM.md non è opzionale, è obbligatorio! 🔒
