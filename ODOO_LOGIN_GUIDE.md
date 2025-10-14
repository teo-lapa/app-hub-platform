# Guida Login Odoo - Sistema Unificato

## Problema Risolto: Errore 401 Unauthorized

### Causa del Problema
L'errore 401 si verificava perché:
1. Il database Odoo test è stato cambiato da `24063382` a `24517859`
2. Il sistema richiedeva una sessione Odoo valida per il nuovo database
3. Gli utenti dovevano rifare login per ottenere una nuova sessione valida

### Soluzione Implementata

#### File Modificati
1. **`lib/odoo-auth.ts`** (linea 26-80)
   - Aggiunto supporto per cookie `odoo_session_id` (nuovo sistema)
   - Mantenuto supporto per cookie `odoo_session` (vecchio sistema, fallback)
   - Sistema ora cerca prima il cookie nuovo, poi fallback al vecchio

2. **`app/api/test-odoo-session/route.ts`** (nuovo file)
   - Endpoint di test per verificare se la sessione Odoo è valida
   - URL: `http://localhost:3000/api/test-odoo-session`
   - Ritorna informazioni sulla sessione (UID, username, database)

### Come Funziona il Sistema di Autenticazione

#### 1. Login Utente
Quando l'utente fa login nell'app:
- **Endpoint**: `/api/auth/login`
- **Input**: Email e password dell'utente
- **Output**:
  - Token JWT per autenticazione app
  - Cookie `odoo_session_id` con session_id Odoo

#### 2. Chiamate API a Odoo
Tutte le chiamate a Odoo usano il session_id dell'utente loggato:
- **File client**: `lib/odoo/pickingClient.ts`
- **Endpoint server**: `/api/odoo/rpc`
- **Helper**: `lib/odoo/odoo-helper.ts` e `lib/odoo-auth.ts`

#### 3. Flusso Completo
```
1. Utente fa login → api/auth/login
2. Login autentica su Odoo → salva odoo_session_id in cookie
3. Client fa chiamata RPC → api/odoo/rpc
4. Server legge odoo_session_id dal cookie → chiama Odoo con session_id
5. Odoo risponde → dati ritornati al client
```

## Come Fare Login

### Per Utenti

1. **Apri l'app** → `http://localhost:3000`
2. **Inserisci credenziali**:
   - Email: stessa email usata su Odoo
   - Password: stessa password usata su Odoo
3. **Clicca "Accedi"**

**IMPORTANTE**: Le credenziali devono essere le stesse di Odoo! Se l'utente non esiste su Odoo con quella email e password, il login fallirà.

### Per Sviluppatori

#### Test Rapido Sessione
```bash
curl http://localhost:3000/api/test-odoo-session
```

**Risposta Successo**:
```json
{
  "success": true,
  "message": "Sessione Odoo valida!",
  "details": {
    "hasSessionId": true,
    "sessionValid": true,
    "uid": 2,
    "username": "paul@lapa.ch",
    "name": "Paul Lapa",
    "db": "lapadevadmin-lapa-v2-staging-2406-24517859",
    "odooUrl": "https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com"
  }
}
```

**Risposta Errore (401)**:
```json
{
  "success": false,
  "error": "Nessun session_id trovato. Devi fare login prima.",
  "details": {
    "hasSessionId": false
  }
}
```

#### Credenziali di Test
Database test attuale: `lapadevadmin-lapa-v2-staging-2406-24517859`

Per testare, assicurati che:
1. Esista un utente su Odoo con email `paul@lapa.ch` (o altra email)
2. La password corrisponda
3. L'utente abbia permessi sufficienti per accedere ai dati richiesti

## Configurazione Ambiente

File: `.env.local`
```env
# Database Odoo TEST (attuale)
ODOO_URL=https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com
NEXT_PUBLIC_ODOO_URL=https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com
ODOO_DB=lapadevadmin-lapa-v2-staging-2406-24517859
```

**NOTA**: Le variabili `ODOO_USERNAME` e `ODOO_PASSWORD` in `odoo-auth.ts` sono fallback di sviluppo e NON vengono più usate nel flusso normale. Il sistema usa SEMPRE le credenziali dell'utente loggato.

## Troubleshooting

### Errore: "Sessione Odoo non trovata"
**Causa**: L'utente non ha fatto login o il cookie è scaduto
**Soluzione**: Fare logout e rifare login

### Errore: "Credenziali Odoo non valide"
**Causa**: Email o password non corrisponde a un utente Odoo
**Soluzione**:
1. Verificare che l'utente esista su Odoo con quella email
2. Verificare che la password sia corretta
3. Verificare di essere connessi al database corretto

### Errore: "HTTP Error: 401"
**Causa**: Session_id non valido o scaduto per il database corrente
**Soluzione**: Fare logout e rifare login per ottenere una nuova sessione

### Come Fare Logout e Re-Login
1. Clicca sul tuo nome in alto a destra
2. Clicca "Logout"
3. Inserisci nuovamente le tue credenziali Odoo
4. Prova nuovamente ad accedere all'app

## Note Tecniche

### Cookie Utilizzati
- **`token`**: JWT token per autenticazione app (httpOnly, 7 giorni)
- **`odoo_session_id`**: Session ID Odoo (httpOnly, 7 giorni)

### Sicurezza
- Tutti i cookie sono `httpOnly` (non accessibili da JavaScript)
- In produzione sono anche `secure` (solo HTTPS)
- Il session_id NON è mai esposto al client
- Tutte le chiamate a Odoo passano dal server Next.js

### Performance
- Il sistema ha cache a 5 minuti per evitare riautenticazioni multiple
- La cache è in-memory e viene invalidata in caso di errori
- Il session_id è riutilizzato per tutte le chiamate dello stesso utente

## Prossimi Passi

Dopo aver fatto login, testa:
1. ✅ Caricamento batch in Prelievo Zone
2. ✅ Chiamate RPC funzionano senza errori 401
3. ✅ Dati vengono caricati correttamente
4. ✅ Nessun errore nei log del browser

Se tutto funziona, il problema 401 è risolto! 🎉
