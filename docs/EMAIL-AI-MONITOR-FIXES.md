# Email AI Monitor - Client-Side Fixes Implementation

## FIX #1: Eliminare il Redirect Loop e Race Condition

**File**: `/app/email-ai-monitor/page.tsx`
**Lines to change**: 34-51

### Problema
```typescript
// ATTUALE (ERRATO)
useEffect(() => {
  const success = searchParams.get('success');
  const error = searchParams.get('error');

  if (success === 'gmail_connected') {
    alert('Gmail connesso con successo!');
    window.location.replace('/email-ai-monitor');  // ❌ Ricarica senza params!
  }

  if (error) {
    alert(`Errore: ${error}`);
  }

  checkConnection();
}, []);  // ❌ Dependencies vuote - non reagisce a searchParams change
```

### Soluzione
```typescript
// CORRETTO
useEffect(() => {
  const success = searchParams.get('success');
  const error = searchParams.get('error');

  if (success === 'gmail_connected') {
    // Mostra toast/alert brevemente
    console.log('[EmailAIMonitor] Gmail connection successful');

    // Aspetta un tick per assicurare che il cookie sia disponibile
    const timer = setTimeout(() => {
      // Non fare reload - lascia che checkConnection() faccia il lavoro
      checkConnection();

      // Puoi mostrare un toast se vuoi feedback visuale
      // toast.success('Gmail connesso con successo!');
    }, 50);

    // Cleanup il timer se il component unmount prima
    return () => clearTimeout(timer);
  }

  if (error) {
    const errorMessage = error === 'email_not_verified'
      ? 'Email non verificata. Verifica il tuo account Google e riprova.'
      : `Errore durante la connessione: ${error}`;
    console.error('[EmailAIMonitor] OAuth error:', error);
    // toast.error(errorMessage);
    // Non mostrare alert - usa toast
  }

  // Se non hai success/error, controlla la connessione normale
  if (!success && !error) {
    checkConnection();
  }
}, [searchParams]);  // ✓ Aggiungi searchParams come dependency!
```

**Perché funziona**:
- Non ricarica la pagina, il cookie rimane
- `setTimeout` garantisce che il cookie sia settato prima di controllarlo
- `searchParams` come dependency assicura che il componente reagisca ai cambiamenti dell'URL
- Elimina la race condition tra callback e cookie availability

---

## FIX #2: Migliorare il Cookie Parsing

**File**: `/app/email-ai-monitor/page.tsx`
**Lines to change**: 59-79

### Problema
```typescript
// ATTUALE (FRAGILE)
const checkConnection = async () => {
  try {
    const cookies = document.cookie.split(';');
    const connCookie = cookies.find(c => c.trim().startsWith('gmail_connection_id='));

    if (connCookie) {
      const id = connCookie.split('=')[1];  // ❌ Non fa trim()!
      setConnectionId(id);
      setIsConnected(true);
    } else {
      setIsConnected(false);
    }
  } catch (error) {
    console.error('Failed to check connection:', error);
    setIsConnected(false);
  } finally {
    setLoading(false);
  }
};
```

### Soluzione Robusta
```typescript
// CORRETTO - Metodo 1: Parsing robusto con Map
const checkConnection = async () => {
  try {
    // Parse cookies usando Map per gestire spacing e URL encoding
    const cookieMap = new Map<string, string>();

    document.cookie.split(';').forEach(cookie => {
      const [key, ...valueParts] = cookie.trim().split('=');
      const value = valueParts.join('='); // Supporta valori con '='

      if (key) {
        try {
          cookieMap.set(key, decodeURIComponent(value));
        } catch (e) {
          // Se il valore non è URL-encoded valido, usa il valore raw
          cookieMap.set(key, value);
        }
      }
    });

    const id = cookieMap.get('gmail_connection_id');

    if (id && id.length > 0) {
      console.log('[EmailAIMonitor] ✓ Connection ID found:', id.substring(0, 20) + '...');
      setConnectionId(id);
      setIsConnected(true);
    } else {
      console.log('[EmailAIMonitor] ✗ No connection ID found in cookies');
      setIsConnected(false);
    }
  } catch (error) {
    console.error('[EmailAIMonitor] Error checking connection:', error);
    setIsConnected(false);
  } finally {
    setLoading(false);
  }
};
```

**Oppure, Metodo 2: Parsing semplificato (se preferisci)**
```typescript
// CORRETTO - Metodo 2: Parsing semplice ma robusto
const checkConnection = async () => {
  try {
    // Usa regex per estrarre il valore del cookie
    const match = document.cookie.match(/(?:^|;\s*)gmail_connection_id=([^;]*)/);
    const id = match ? decodeURIComponent(match[1]) : null;

    if (id && id.length > 0) {
      console.log('[EmailAIMonitor] ✓ Connection ID found');
      setConnectionId(id);
      setIsConnected(true);
    } else {
      console.log('[EmailAIMonitor] ✗ No connection ID found in cookies');
      setIsConnected(false);
    }
  } catch (error) {
    console.error('[EmailAIMonitor] Error checking connection:', error);
    setIsConnected(false);
  } finally {
    setLoading(false);
  }
};
```

**Perché funziona**:
- Map method: Gestisce spacing, URL encoding, e valori con caratteri speciali
- Regex method: Più veloce, pattern standard per cookie parsing
- Entrambi: No race condition perché vengono eseguiti dopo il setTimeout
- Logging: Aiuta a debuggare

---

## FIX #3: Aggiungere Fallback API per Resilienza

**File**: `/app/email-ai-monitor/page.tsx`
**Lines to change**: 59-79

### Soluzione
```typescript
// CORRETTO - Con fallback API
const checkConnection = async () => {
  try {
    // Metodo 1: Controlla il cookie (veloce)
    const match = document.cookie.match(/(?:^|;\s*)gmail_connection_id=([^;]*)/);
    const cookieId = match ? decodeURIComponent(match[1]) : null;

    if (cookieId && cookieId.length > 0) {
      console.log('[EmailAIMonitor] ✓ Connection found in cookie');
      setConnectionId(cookieId);
      setIsConnected(true);
      setLoading(false);
      return;
    }

    // Metodo 2: Se il cookie non c'è, chiedi al server (fallback)
    console.log('[EmailAIMonitor] Cookie non trovato, checking server...');
    const response = await fetch('/api/email-ai/check-connection', {
      method: 'GET',
      credentials: 'include', // Importante: invia i cookie
    });

    if (response.ok) {
      const data = await response.json();
      if (data.connectionId) {
        console.log('[EmailAIMonitor] ✓ Connection found on server');
        setConnectionId(data.connectionId);
        setIsConnected(true);
      } else {
        console.log('[EmailAIMonitor] ✗ No connection on server');
        setIsConnected(false);
      }
    } else if (response.status === 401) {
      console.log('[EmailAIMonitor] ⚠️ Unauthorized - redirect to login');
      // Opzionale: redirige a login
      // router.push('/');
      setIsConnected(false);
    } else {
      console.log('[EmailAIMonitor] ✗ Server error:', response.status);
      setIsConnected(false);
    }
  } catch (error) {
    console.error('[EmailAIMonitor] Error checking connection:', error);
    setIsConnected(false);
  } finally {
    setLoading(false);
  }
};
```

**Nota**: Questo richiede di implementare l'API endpoint `/api/email-ai/check-connection`:

```typescript
// /app/api/email-ai/check-connection/route.ts (da creare)
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const connectionId = request.cookies.get('gmail_connection_id')?.value;

    if (!connectionId) {
      return NextResponse.json(
        { connectionId: null },
        { status: 200 }
      );
    }

    // Opzionale: verifica che la connessione esista nel DB
    const result = await sql`
      SELECT id FROM gmail_connections
      WHERE id = ${connectionId}
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { connectionId: null },
        { status: 200 }
      );
    }

    return NextResponse.json({
      connectionId: connectionId,
      verified: true
    });

  } catch (error) {
    console.error('Error checking connection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Perché funziona**:
- Doppio metodo: Cookie + API fallback
- Se il cookie non c'è ma l'utente è autenticato, il server può ancora verificare
- Più robusto in caso di cookie issues o browser policies

---

## FIX #4: Gestione Migliore degli Errori

**File**: `/app/email-ai-monitor/page.tsx`
**Lines to change**: 34-51 (in combinazione con FIX #1)

### Problema
```typescript
// ATTUALE (Blocca con alert)
if (error) {
  alert(`Errore: ${error}`);
  // Non pulisce l'URL
}
```

### Soluzione
```typescript
// CORRETTO (Pulisce e mostra feedback)
if (error) {
  // Log per debugging
  console.error('[EmailAIMonitor] OAuth error:', error);

  // Descrizione utente-friendly dell'errore
  const errorMessages: Record<string, string> = {
    'email_not_verified': 'Email non verificata. Verifica il tuo account Google e riprova.',
    'google_access_denied': 'Accesso negato. Gmail richiede i tuoi permessi.',
    'missing_code': 'Errore nella comunicazione con Google. Riprova.',
    'callback_error': 'Errore durante il callback OAuth.',
  };

  const errorPrefix = error.split('_')[0]; // Estrae il prefisso (es. 'google' da 'google_access_denied')
  const message = errorMessages[error] || errorMessages[errorPrefix] || `Errore: ${error}`;

  // Usa toast invece di alert (non blocca)
  // toast.error(message);
  console.warn('[EmailAIMonitor] User-friendly error:', message);

  // Opzionale: puoi salvare l'errore nello state per mostrarlo nella UI
  // setLastError(message);
}
```

---

## FIX #5: Pulizia della URL dai Query Params

**File**: `/app/email-ai-monitor/page.tsx`
**Lines to change**: 34-51 (aggiunta)

### Problema
```
Dopo il callback OAuth, l'URL rimane su /email-ai-monitor?success=gmail_connected
Non è "sporco", ma non è ideale per UX
```

### Soluzione
```typescript
// CORRETTO - Pulizia URL (opzionale, ma raccomandato)
useEffect(() => {
  const success = searchParams.get('success');
  const error = searchParams.get('error');

  if ((success || error) && window.history) {
    // Pulisci l'URL dai query params dopo 1 secondo
    // (assicura che il user veda il feedback prima)
    const timer = setTimeout(() => {
      window.history.replaceState({}, document.title, '/email-ai-monitor');
    }, 1000);

    return () => clearTimeout(timer);
  }
}, [searchParams]);
```

---

## FIX #6: Aggiungere Proper Cleanup

**File**: `/app/email-ai-monitor/page.tsx`
**Lines to change**: 53-57 (aggiunta)

### Problema
```typescript
// ATTUALE (Potrebbe causare multiple fetches)
useEffect(() => {
  if (connectionId) {
    fetchEmails();
  }
}, [filter, connectionId]);  // ⚠️ Manca cleanup
```

### Soluzione
```typescript
// CORRETTO - Con AbortController per cleanup
useEffect(() => {
  if (!connectionId) return;

  const abortController = new AbortController();
  let isMounted = true;

  const executesFetch = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/email-ai/inbox?connectionId=${connectionId}&filter=${filter}&limit=50`,
        { signal: abortController.signal }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch emails');
      }

      const data = await response.json();

      // Controlla che il component sia ancora montato prima di setState
      if (isMounted) {
        setEmails(data.emails || []);
      }
    } catch (error) {
      // Ignora gli errori di abort (quando il component unmount)
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('[EmailAIMonitor] Error fetching emails:', error);
        if (isMounted) {
          // Non mostrare error toast per AbortError
          // toast.error('Errore nel caricamento email');
        }
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  executesFetch();

  return () => {
    // Cleanup: cancella la richiesta se il component unmount
    isMounted = false;
    abortController.abort();
  };
}, [filter, connectionId]);
```

---

## Implementazione Completa: Codice Finale

Ecco la versione COMPLETA e corretta del componente:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Email {
  id: string;
  sender_email: string;
  sender_name: string | null;
  subject: string;
  snippet: string;
  ai_summary: string | null;
  urgency_level: 'urgent' | 'important' | 'normal' | 'low';
  is_spam: boolean;
  is_client: boolean;
  is_supplier: boolean;
  email_category: string;
  ai_keywords: string[];
  received_date: string;
  is_read: boolean;
}

export default function EmailAIMonitorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingNew, setFetchingNew] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [connectionId, setConnectionId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);

  // ========== EFFECT 1: Handle OAuth callback ==========
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'gmail_connected') {
      console.log('[EmailAIMonitor] Gmail connection successful');

      // Aspetta un tick per assicurare che il cookie sia settato
      const timer = setTimeout(() => {
        checkConnection();
      }, 50);

      return () => clearTimeout(timer);
    }

    if (error) {
      console.error('[EmailAIMonitor] OAuth error:', error);
      // Mostra errore user-friendly
      const errorMessages: Record<string, string> = {
        'email_not_verified': 'Email non verificata.',
        'google_access_denied': 'Accesso negato da Google.',
        'missing_code': 'Errore nella comunicazione con Google.',
        'callback_error': 'Errore durante il callback OAuth.',
      };
      const message = errorMessages[error] || `Errore: ${error}`;
      console.warn('[EmailAIMonitor]', message);
    }

    if (!success && !error) {
      checkConnection();
    }
  }, [searchParams]); // ✓ Dependency: searchParams

  // ========== EFFECT 2: Fetch emails quando connectionId cambia ==========
  useEffect(() => {
    if (!connectionId) return;

    const abortController = new AbortController();
    let isMounted = true;

    const executeFetch = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/email-ai/inbox?connectionId=${connectionId}&filter=${filter}&limit=50`,
          { signal: abortController.signal }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch emails');
        }

        const data = await response.json();
        if (isMounted) {
          setEmails(data.emails || []);
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('[EmailAIMonitor] Error fetching emails:', error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    executeFetch();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [filter, connectionId]);

  // ========== Check connection and read cookie ==========
  const checkConnection = async () => {
    try {
      // Metodo 1: Controlla il cookie
      const match = document.cookie.match(/(?:^|;\s*)gmail_connection_id=([^;]*)/);
      const cookieId = match ? decodeURIComponent(match[1]) : null;

      if (cookieId && cookieId.length > 0) {
        console.log('[EmailAIMonitor] ✓ Connection found in cookie');
        setConnectionId(cookieId);
        setIsConnected(true);
        setLoading(false);
        return;
      }

      // Metodo 2: Fallback API
      console.log('[EmailAIMonitor] Checking server for connection...');
      const response = await fetch('/api/email-ai/check-connection', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.connectionId) {
          console.log('[EmailAIMonitor] ✓ Connection found on server');
          setConnectionId(data.connectionId);
          setIsConnected(true);
        } else {
          console.log('[EmailAIMonitor] ✗ No connection found');
          setIsConnected(false);
        }
      } else {
        console.log('[EmailAIMonitor] ✗ Server check failed');
        setIsConnected(false);
      }
    } catch (error) {
      console.error('[EmailAIMonitor] Error checking connection:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  // ========== Fetch new emails ==========
  const fetchNewEmails = async () => {
    if (!connectionId) return;

    setFetchingNew(true);
    try {
      const response = await fetch('/api/email-ai/fetch-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          maxResults: 10,
          query: 'is:unread'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch new emails');
      }

      const data = await response.json();
      console.log('[EmailAIMonitor] Processed', data.processed, 'new emails');

      // Refresh list
      checkConnection();
    } catch (error) {
      console.error('[EmailAIMonitor] Error fetching new emails:', error);
    } finally {
      setFetchingNew(false);
    }
  };

  // ========== OAuth redirect ==========
  const connectGmail = () => {
    window.location.href = '/api/email-ai/auth/gmail';
  };

  // ========== UI Helper Functions ==========
  const getUrgencyBadge = (urgency: string) => {
    const badges = {
      urgent: 'bg-red-500 text-white',
      important: 'bg-orange-500 text-white',
      normal: 'bg-blue-500 text-white',
      low: 'bg-gray-400 text-white'
    };
    return badges[urgency as keyof typeof badges] || badges.normal;
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      sales: '💼',
      support: '🆘',
      invoice: '💸',
      order: '📦',
      delivery: '🚚',
      marketing: '📢',
      newsletter: '📰',
      notification: '🔔',
      other: '📧'
    };
    return icons[category] || icons.other;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">📧 Email AI Monitor</h1>
              <p className="text-gray-400 mt-1">
                Gmail intelligente con classificazione AI automatica
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-semibold transition flex items-center gap-2"
            >
              ← Torna al Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Connection Status & Actions */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isConnected ? (
              <button
                onClick={connectGmail}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition"
              >
                🔗 Connetti Gmail
              </button>
            ) : (
              <>
                <div className="px-4 py-2 bg-green-500/20 border border-green-500 rounded-lg">
                  ✅ Gmail Connesso
                </div>
                <button
                  onClick={fetchNewEmails}
                  disabled={fetchingNew}
                  className="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 rounded-lg font-semibold transition"
                >
                  {fetchingNew ? '⏳ Caricamento...' : '🔄 Fetch Nuove Email'}
                </button>
              </>
            )}
          </div>

          {/* Filters */}
          {isConnected && (
            <div className="flex gap-2">
              {['all', 'urgent', 'important', 'unread', 'client', 'supplier'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    filter === f
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Email List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">⏳</div>
            <div className="text-xl">Caricamento email...</div>
          </div>
        ) : !isConnected ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📧</div>
            <div className="text-2xl mb-4">Connetti Gmail per iniziare</div>
            <p className="text-gray-400">
              Il sistema analizzerà automaticamente le tue email con AI
            </p>
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">✅</div>
            <div className="text-2xl mb-4">Nessuna email da mostrare</div>
            <p className="text-gray-400">Cambia filtro o fetch nuove email</p>
          </div>
        ) : (
          <div className="space-y-4">
            {emails.map(email => (
              <div
                key={email.id}
                className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/10 hover:bg-white/15 transition"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">
                        {getCategoryIcon(email.email_category)}
                      </span>
                      <div>
                        <div className="font-bold text-lg">
                          {email.sender_name || email.sender_email}
                        </div>
                        <div className="text-sm text-gray-400">
                          {email.sender_email}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${getUrgencyBadge(
                        email.urgency_level
                      )}`}
                    >
                      {email.urgency_level.toUpperCase()}
                    </span>
                    <div className="text-xs text-gray-400">
                      {new Date(email.received_date).toLocaleString('it-IT')}
                    </div>
                  </div>
                </div>

                {/* Subject */}
                <div className="font-semibold text-lg mb-2">{email.subject}</div>

                {/* AI Summary */}
                {email.ai_summary && (
                  <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 mb-3">
                    <div className="text-xs text-blue-300 font-bold mb-1">
                      AI RIASSUNTO
                    </div>
                    <div className="text-sm">{email.ai_summary}</div>
                  </div>
                )}

                {/* Snippet */}
                <div className="text-gray-300 text-sm mb-3">{email.snippet}</div>

                {/* Keywords & Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  {email.is_client && (
                    <span className="px-2 py-1 bg-green-500/20 border border-green-500 text-green-300 rounded text-xs font-bold">
                      👤 CLIENTE
                    </span>
                  )}
                  {email.is_supplier && (
                    <span className="px-2 py-1 bg-purple-500/20 border border-purple-500 text-purple-300 rounded text-xs font-bold">
                      🏭 FORNITORE
                    </span>
                  )}
                  {email.ai_keywords?.slice(0, 3).map(keyword => (
                    <span
                      key={keyword}
                      className="px-2 py-1 bg-white/10 rounded text-xs"
                    >
                      #{keyword}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Summary delle Fix

| Fix | Problema | Soluzione | Impatto |
|-----|----------|-----------|--------|
| #1 | Redirect loop + race condition | Rimuovere window.location.replace, usare setTimeout | CRITICA |
| #2 | Cookie parsing fragile | Usare Map o regex robusti | ALTA |
| #3 | Nessun fallback | Aggiungere API endpoint check | MEDIA |
| #4 | Error handling scarso | Toast invece di alert | MEDIA |
| #5 | URL sporco | Pulizia con replaceState | BASSA |
| #6 | Memory leaks da fetch | AbortController + cleanup | ALTA |

---

## Testing After Fixes

```javascript
// Test in console dopo aver implementato le fix:

// 1. Verifica il cookie
document.cookie.match(/gmail_connection_id=([^;]*)/)

// 2. Verifica che checkConnection() funzioni
// Dovrebbe loggare i risultati in console

// 3. Verifica il flusso completo:
// - Clicca "Connetti Gmail"
// - Completa OAuth
// - Dovrebbe vedere "Gmail Connesso" senza reload
// - Dovrebbe caricare le email automaticamente

// 4. Verifica no memory leaks:
// Apri DevTools → Performance
// Fetch alcune pagine
// Verifiquare che la memoria non salga indefinitamente
```
