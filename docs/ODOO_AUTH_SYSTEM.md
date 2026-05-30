# ðŸš¨ðŸš¨ðŸš¨ SISTEMA DI AUTENTICAZIONE ODOO - REGOLA ASSOLUTA ðŸš¨ðŸš¨ðŸš¨

## â›”â›”â›” LEGGI QUESTO PRIMA DI FARE QUALSIASI COSA â›”â›”â›”

# âŒâŒâŒ NON ESISTONO FALLBACK âŒâŒâŒ
# âŒâŒâŒ NON ESISTONO CREDENZIALI HARDCODED âŒâŒâŒ
# âŒâŒâŒ SE L'UTENTE NON Ãˆ LOGGATO â†’ BUTTA FUORI âŒâŒâŒ

---

## ðŸ”´ REGOLA NUMERO UNO (NON NEGOZIABILE)

### **SE L'UTENTE NON Ãˆ LOGGATO SULLA PIATTAFORMA = NON PUÃ’ ACCEDERE A NIENTE**

```
NESSUN LOGIN = NESSUN ACCESSO
NESSUNA ECCEZIONE
NESSUN FALLBACK
NESSUNA CREDENZIALE HARDCODED
```

**PUNTO. FINE. STOP.**

---

## ðŸ“‹ COME FUNZIONA (VERSIONE SEMPLICE)

### 1. **L'utente fa login sulla piattaforma**
- Email: `mario@lapa.ch`
- Password: `mario123`

### 2. **Il sistema fa login ANCHE su Odoo con le STESSE credenziali**
- Email: `mario@lapa.ch` (UGUALE)
- Password: `mario123` (UGUALE)

### 3. **Salva il session_id di Odoo in un cookie**
- Cookie name: `odoo_session_id`
- Questo cookie viene usato per TUTTE le chiamate a Odoo

### 4. **Se l'utente NON Ã¨ loggato**
- âŒ Nessun cookie `odoo_session_id`
- âŒ Nessuna chiamata a Odoo funziona
- âŒ Errore 401 Unauthorized
- âŒ **L'UTENTE VIENE BUTTATO FUORI**

---

## ðŸ”¥ REGOLE FERREE

### âœ… **GIUSTO**

```typescript
// 1. Controlla se l'utente ha il cookie
const sessionId = cookies().get('odoo_session_id')?.value;

// 2. Se NON ce l'ha â†’ 401
if (!sessionId) {
  return NextResponse.json(
    { error: 'Devi fare login' },
    { status: 401 }
  );
}

// 3. Se ce l'ha â†’ usa quel session_id
const result = await makeOdooCall(model, method, args, sessionId);
```

### âŒ **SBAGLIATO - MAI FARE QUESTO**

```typescript
// âŒâŒâŒ MAI MAI MAI âŒâŒâŒ
const FALLBACK_LOGIN = 'paul@lapa.ch';
const FALLBACK_PASSWORD = '__REDACTED__';

if (!sessionId) {
  // âŒ SBAGLIATO! NON USARE CREDENZIALI HARDCODED!
  sessionId = await loginWithFallback(FALLBACK_LOGIN, FALLBACK_PASSWORD);
}
```

**PERCHÃ‰ Ãˆ SBAGLIATO:**
- Tutti operano come `paul@lapa.ch`
- I permessi Odoo non funzionano
- Non si sa chi ha fatto cosa
- **ROMPE LA SICUREZZA COMPLETAMENTE**

---

## ðŸ” PRINCIPIO FONDAMENTALE

### **CREDENZIALI PIATTAFORMA = CREDENZIALI ODOO**

```
Email Piattaforma    = Email Odoo
Password Piattaforma = Password Odoo

DEVONO ESSERE IDENTICHE
NON NEGOZIABILE
```

**Se le credenziali non corrispondono:**
- Il login FALLISCE
- L'utente NON puÃ² accedere
- Messaggio errore: "Credenziali Odoo non valide"

---

## ðŸ› ï¸ COME CREARE UNA NUOVA APP

### Passo 1: Usa l'API Odoo Corretta

```typescript
// File: app/my-app/api/data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  // ========== CONTROLLA SESSION_ID ==========
  const sessionId = cookies().get('odoo_session_id')?.value;

  if (!sessionId) {
    console.error('âŒ Utente NON loggato - accesso negato');
    return NextResponse.json(
      { success: false, error: 'Devi fare login' },
      { status: 401 }
    );
  }

  // ========== USA IL SESSION_ID PER CHIAMARE ODOO ==========
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs }
    })
  });

  const data = await response.json();
  return NextResponse.json(data);
}
```

### Passo 2: Nel Frontend, Gestisci il 401

```typescript
// File: app/my-app/page.tsx
const response = await fetch('/api/my-app/data', {
  method: 'POST',
  credentials: 'include', // âœ… IMPORTANTE: Include i cookie!
  body: JSON.stringify({ ... })
});

if (response.status === 401) {
  // âŒ Utente non loggato - redirect al login
  router.push('/auth');
  return;
}

const data = await response.json();
```

---

## âŒ COSA NON FARE MAI

### 1. âŒ NON Hardcodare Credenziali

```typescript
// âŒ SBAGLIATO
const ODOO_LOGIN = 'paul@lapa.ch';
const ODOO_PASSWORD = '__REDACTED__';
```

### 2. âŒ NON Creare Fallback

```typescript
// âŒ SBAGLIATO
if (!userSessionId) {
  sessionId = await fallbackLogin();
}
```

### 3. âŒ NON Permettere Accesso Senza Login

```typescript
// âŒ SBAGLIATO
if (!sessionId) {
  sessionId = 'default-session'; // NO!
}
```

---

## ðŸš¨ SE VEDI CREDENZIALI HARDCODED = RIMUOVILE SUBITO

Se vedi questo codice:

```typescript
const FALLBACK_LOGIN = 'paul@lapa.ch';
const FALLBACK_PASSWORD = '__REDACTED__';
```

**CANCELLALO IMMEDIATAMENTE.**

Non esistono fallback. Non esistono credenziali di backup. Se l'utente non Ã¨ loggato, non accede. PUNTO.

---

## ðŸ“ CHECKLIST PER OGNI NUOVA APP

Prima di creare una app, verifica:

- [ ] Ho letto questo documento
- [ ] Capisco che NON esistono fallback
- [ ] Capisco che l'utente DEVE essere loggato
- [ ] La mia API controlla `odoo_session_id` cookie
- [ ] La mia API ritorna 401 se il cookie non esiste
- [ ] Il mio frontend gestisce il 401 con redirect a login
- [ ] NON ho hardcodato nessuna credenziale

---

## ðŸ”§ FILE CHIAVE

### API Principale Odoo
- `app/api/odoo/rpc/route.ts` - API principale per chiamate Odoo

**Questo file NON DEVE AVERE:**
- âŒ Credenziali hardcoded
- âŒ Login di fallback
- âŒ Session_id di default

**Questo file DEVE AVERE:**
- âœ… Check del cookie `odoo_session_id`
- âœ… Return 401 se cookie manca
- âœ… Uso del session_id utente

### Login Utente
- `app/api/auth/login/route.ts` - Login piattaforma + Odoo

**Questo file fa:**
1. Verifica credenziali sulla piattaforma
2. Login su Odoo con STESSE credenziali
3. Salva `odoo_session_id` in cookie
4. Se login Odoo fallisce â†’ errore 401

---

## âœ… CONCLUSIONE

### RICORDA:

1. ðŸš« **NESSUN FALLBACK**
2. ðŸš« **NESSUNA CREDENZIALE HARDCODED**
3. ðŸš« **UTENTE NON LOGGATO = BUTTATO FUORI**
4. âœ… **Credenziali Piattaforma = Credenziali Odoo**
5. âœ… **Cookie `odoo_session_id` = unico modo per accedere**
6. âœ… **401 se cookie manca**

### SE NON SEI SICURO DI QUALCOSA:

**CHIEDI. NON IMPROVVISARE.**

Non creare fallback "per sicurezza". Non mettere credenziali "temporanee". Non cercare soluzioni "alternative".

**LA REGOLA Ãˆ UNA SOLA: UTENTE LOGGATO O NIENTE.**

---

*Documento creato il 2025-10-12*
*Ultimo aggiornamento: 2025-10-12*
*Versione: 2.0 - NO FALLBACK*
