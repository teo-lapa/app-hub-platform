# Email AI Monitor - Debug Guide

## Debug Veloce (5 minuti)

### Step 1: Aprire DevTools Console
1. Vai su `/email-ai-monitor` nel browser
2. Premi `F12` → Console
3. Esegui:
```javascript
// Vedi se il cookie è effettivamente set
document.cookie

// Cerca specificamente il cookie gmail
document.cookie.split(';').find(c => c.includes('gmail_connection_id'))

// Vedi tutti i cookies con dettagli
document.cookie.split(';').map(c => c.trim())
```

**Cosa cercare**:
- Se vedi un valore come `gmail_connection_id=abc123def...`, il cookie È settato
- Se è vuoto, il problema è nel callback o nel trasferimento del cookie

---

### Step 2: Controllare il Callback Redirect
1. Vai su `/email-ai-monitor`
2. Clicca "Connetti Gmail"
3. Completa l'autenticazione Google
4. Durante il redirect, apri DevTools → Network tab
5. Cerca la richiesta a `/api/email-ai/auth/gmail/callback?code=...`

**Cosa cercare**:
- Status: **302 Redirect** (non 200)
- Response Headers: Cerca `Set-Cookie: gmail_connection_id=...`
- Se vedi Set-Cookie con `SameSite=Lax`, potrebbe essere il problema

---

### Step 3: Verificare il useSearchParams Hook
In console, esegui:
```javascript
// Se la pagina è su /email-ai-monitor?success=gmail_connected
const url = new URL(window.location.href);
url.searchParams.get('success')  // Dovrebbe restituire "gmail_connected"
```

**Se restituisce null**: Il query param NON è stato trasferito dal redirect.

---

### Step 4: Testare il Cookie Parsing
In console, simula il codice della pagina:
```javascript
// Simula checkConnection()
const cookies = document.cookie.split(';');
const connCookie = cookies.find(c => c.trim().startsWith('gmail_connection_id='));

console.log('connCookie:', connCookie);

if (connCookie) {
  const id = connCookie.split('=')[1];
  console.log('Extracted ID:', id);
} else {
  console.log('Cookie NOT found');
}
```

**Se ritorna "Cookie NOT found"**: È il parsing che è in fallimento.

---

## Debug Dettagliato (15 minuti)

### Scenario 1: Cookie NON viene set dal server

**Sintomi**:
- Console: `document.cookie` non contiene `gmail_connection_id`
- Network: Response del callback NON ha Set-Cookie header

**Step di debug**:

1. Controlla che il callback stia realmente being called:
```javascript
// In /app/api/email-ai/auth/gmail/callback/route.ts
// Cerca nel server logs: "[Email-AI] 🍪 Set cookie: gmail_connection_id = ..."
```

2. Verifica il NODE_ENV setting per il cookie:
```typescript
// riga 145-151 di callback/route.ts
response.cookies.set('gmail_connection_id', connectionId, {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',  // ⚠️ Potrebbe essere il problema
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60,
  path: '/',
});
```

**Potenziale problema**: Se sei in **staging/development** e il cookie ha `secure: false`, il browser potrebbe non settarlo se il sito è su HTTPS.

3. Controlla in DevTools → Application → Cookies:
   - Seleziona il dominio corrente
   - Cerca `gmail_connection_id`
   - Verifica:
     - Domain: Deve essere il dominio attuale (non diverso)
     - Path: Deve essere `/`
     - Secure: Se sito è HTTPS, dovrebbe essere checked
     - SameSite: Deve essere `Lax` o `None`

---

### Scenario 2: Cookie viene set ma non letto dal client

**Sintomi**:
- DevTools → Cookies: Vedo `gmail_connection_id`
- Console: `document.cookie` NON lo contiene

**Step di debug**:

1. Verifica il cookie è httpOnly:
```javascript
// In callback/route.ts riga 146
httpOnly: false,  // ✓ Deve essere false per JS access
```

Se è `true`, JavaScript NON può accedere al cookie.

2. Controlla il SameSite attribute:
```javascript
// Se il cookie ha SameSite=Strict, il browser NON lo invia nel redirect
// Deve essere Lax o None (None richiede Secure=true)
```

3. Verifica il timing:
```javascript
// Il cookie potrebbe non essere disponibile immediatamente
// Prova con delay:
setTimeout(() => {
  console.log('Cookie dopo 100ms:', document.cookie);
}, 100);

setTimeout(() => {
  console.log('Cookie dopo 500ms:', document.cookie);
}, 500);
```

---

### Scenario 3: Window.location.replace() Causa Loop

**Sintomi**:
- Page carica ma rimane su "Caricamento email..."
- Bottone "Connetti Gmail" visibile anche dopo aver connesso
- Console non mostra errori

**Step di debug**:

1. Aggiungi console.log nella page component:
```typescript
// In /app/email-ai-monitor/page.tsx riga 34
useEffect(() => {
  const success = searchParams.get('success');
  const error = searchParams.get('error');

  console.log('[Email-AI Monitor] useEffect called');
  console.log('[Email-AI Monitor] success param:', success);
  console.log('[Email-AI Monitor] error param:', error);

  if (success === 'gmail_connected') {
    console.log('[Email-AI Monitor] Gmail connected detected! Showing alert...');
    alert('Gmail connesso con successo!');
    console.log('[Email-AI Monitor] About to replace window location...');
    window.location.replace('/email-ai-monitor');
  }

  checkConnection();
}, []);
```

2. Osserva la console dopo il redirect del callback
3. Se vedi:
   - `useEffect called` una volta
   - `success param: null`
   - Significa che il reload ha eliminato il query param

---

### Scenario 4: useEffect Non Viene Eseguito

**Sintomi**:
- Console non mostra nessun log dal useEffect
- La pagina non carica

**Step di debug**:

1. Aggiungi log all'inizio della component:
```typescript
export default function EmailAIMonitorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  console.log('[EmailAIMonitorPage] Component mounted');
  console.log('[EmailAIMonitorPage] searchParams:', searchParams.entries());

  // ... rest of code
}
```

2. Se non vedi il log, il problema è nel:
   - Rendering lato server (SSR issue)
   - Middleware che blocca la rotta
   - Router che redirige prima del render

3. Controlla il middleware:
```typescript
// middleware.ts riga 24
'/email-ai-monitor',  // ✓ Deve essere qui
```

Se non è nella lista, il middleware potrebbe bloccare il rendering.

---

## Trace Completo del Flusso

### Con Success (Caso Corretto)

```
Timeline:
─────────────────────────────────────────────────────────────

[Browser]
  1. User clicca "Connetti Gmail"
     → window.location.href = '/api/email-ai/auth/gmail'

[Network]
  2. GET /api/email-ai/auth/gmail
     → Server genera Google OAuth URL
     → 302 Redirect a https://accounts.google.com/...

[Google]
  3. User autentica con Google
     → Google redirige a /api/email-ai/auth/gmail/callback?code=xyz

[Network]
  4. GET /api/email-ai/auth/gmail/callback?code=xyz
     ✓ Scambia code per token
     ✓ Salva in DB
     ✓ Set cookie: gmail_connection_id
     → 302 Redirect a /email-ai-monitor?success=gmail_connected

[Browser]
  5. GET /email-ai-monitor?success=gmail_connected
     → useSearchParams() = { success: 'gmail_connected' }
     ✓ Mostra alert
     ✓ Chiama checkConnection()
     ✓ Legge cookie
     ✓ setIsConnected(true)
     ✓ Bottone "Fetch Nuove Email" visibile

[API]
  6. fetchEmails() eseguito
     → GET /api/email-ai/inbox?connectionId=...
     ✓ Carica email list
```

---

### Con Errore OAuth

```
Timeline:
─────────────────────────────────────────────────────────────

[Browser]
  1. User clicca "Connetti Gmail"

[Google]
  2. User nega permessi o errore
     → Google redirige a /api/email-ai/auth/gmail/callback?error=access_denied

[Network]
  3. GET /api/email-ai/auth/gmail/callback?error=access_denied
     → Server vede error param
     → 302 Redirect a /email-ai-monitor?error=google_access_denied

[Browser]
  4. GET /email-ai-monitor?error=google_access_denied
     → useSearchParams() = { error: 'google_access_denied' }
     ✓ Mostra alert con errore
     ✓ Bottone "Connetti Gmail" rimane visibile
```

---

## Test Case di Verifica

### Test 1: Verifica Cookie Transfer
```javascript
// Esegui DOPO aver completato il callback OAuth

// 1. Controlla che il cookie esista
const hasCookie = document.cookie.includes('gmail_connection_id');
console.log('Step 1 - Cookie exists:', hasCookie);

// 2. Controlla che searchParams sia settato
const url = new URL(window.location.href);
const success = url.searchParams.get('success');
console.log('Step 2 - Success param:', success);

// 3. Controlla che il parsing funzioni
const cookies = document.cookie.split(';');
const connCookie = cookies.find(c => c.trim().startsWith('gmail_connection_id='));
const id = connCookie ? connCookie.split('=')[1] : null;
console.log('Step 3 - Parsed ID:', id);

// 4. Verifica locale storage / session storage per fallback
console.log('Step 4 - LocalStorage:', localStorage.getItem('gmail_connection_id'));
console.log('Step 4 - SessionStorage:', sessionStorage.getItem('gmail_connection_id'));
```

**Risultato atteso**:
```
Step 1 - Cookie exists: true
Step 2 - Success param: gmail_connected
Step 3 - Parsed ID: abc123def456...
Step 4 - LocalStorage: null
Step 4 - SessionStorage: null
```

---

### Test 2: Verifica Middleware
```javascript
// Controlla che il middleware permetta l'accesso

// Se sei su /email-ai-monitor e vedi il contenuto:
// ✓ Middleware ha consentito l'accesso

// Se vieni rediretto a /?error=access_denied:
// ❌ Middleware ha bloccato l'accesso

// Per verificare il token:
// Apri DevTools → Application → Cookies
// Cerca il cookie "token"
// Se esiste, il middleware dovrebbe consentire l'accesso
```

---

## Log di Esperienza

Quando implementi i fix, aggiungi questi log per capire il flusso:

### Client-side logs
```typescript
// page.tsx
console.log('[EmailAIMonitor] Component mounted');
console.log('[EmailAIMonitor] searchParams:', Object.fromEntries(searchParams));
console.log('[EmailAIMonitor] Checking connection...');
console.log('[EmailAIMonitor] isConnected:', isConnected);
console.log('[EmailAIMonitor] connectionId:', connectionId);
console.log('[EmailAIMonitor] emails loaded:', emails.length);
```

### Server-side logs
```typescript
// callback/route.ts
console.log('[Email-AI] ✅ Gmail connection created:', connectionId);
console.log('[Email-AI] 🍪 Setting cookie...');
console.log('[Email-AI] 🔄 Final redirect URL:', redirectUrl.toString());
```

---

## Conclusione

Usa questa guida in ordine:
1. Debug Veloce (5 min) per identificare il problema
2. Debug Dettagliato (15 min) per approfondire
3. Test Case di Verifica per confermare il fix

Il 90% dei problemi è causato da uno di questi fattori:
- Cookie non viene set dal server
- Cookie non viene trasferito nel redirect
- Cookie non viene letto dal client
- window.location.replace() ricarica senza params
- Timing issue tra callback e cookie availability
