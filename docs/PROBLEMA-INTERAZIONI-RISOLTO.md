# Problema Interazioni Non Visibili - RISOLTO ✅

## Il Problema

Quando salvavi un'interazione per un cliente (es. Laura Teodorescu Privato), l'interazione veniva salvata correttamente nel database ma **non appariva immediatamente nella timeline** della pagina del cliente.

La timeline continuava a mostrare solo le 6 interazioni precedenti invece di mostrare la nuova interazione appena creata.

## Causa Root

Il problema era dovuto alla **cache di React Query** che non veniva invalidata dopo il salvataggio dell'interazione.

### Flusso del Bug

1. ✅ Utente apre il modal "Nuova Interazione"
2. ✅ Compila i dati e clicca "Salva"
3. ✅ Il modal invia POST a `/api/maestro/interactions`
4. ✅ Il backend salva l'interazione nel database
5. ✅ Il modal mostra "Interazione registrata con successo!"
6. ✅ Il modal si chiude
7. ❌ **LA PAGINA NON SI AGGIORNA** perché usa i dati dalla cache

### Dettagli Tecnici

La pagina del cliente ([app/maestro-ai/customers/[id]/page.tsx:58-60](app/maestro-ai/customers/[id]/page.tsx#L58-L60)) usa React Query per caricare i dati:

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['customer-detail', params.id],
  queryFn: () => fetchCustomerDetail(params.id),
});
```

Quando salvi un'interazione, React Query continua a mostrare i dati dalla cache con la `queryKey: ['customer-detail', '2421']` invece di rifare la fetch al server.

Il modal ([components/maestro/InteractionModal.tsx:106-138](components/maestro/InteractionModal.tsx#L106-L138)) salvava l'interazione ma **non diceva a React Query di ricaricare i dati**.

## La Soluzione

Ho aggiunto l'invalidazione della cache di React Query nel `InteractionModal` dopo il salvataggio con successo.

### Modifiche Apportate

**File:** `components/maestro/InteractionModal.tsx`

#### 1. Aggiunto import di `useQueryClient`

```typescript
import { useQueryClient } from '@tanstack/react-query';
```

#### 2. Inizializzato il queryClient nel componente

```typescript
export function InteractionModal({ ... }) {
  const queryClient = useQueryClient();
  // ... resto del codice
}
```

#### 3. Aggiunta invalidazione dopo salvataggio

```typescript
if (!response.ok) throw new Error('Failed to save interaction');

toast.success('Interazione registrata con successo!');

// Invalida la cache per ricaricare i dati del cliente aggiornati
queryClient.invalidateQueries({ queryKey: ['customer-detail', odooPartnerId.toString()] });

onClose();
```

### Come Funziona Ora

1. ✅ Utente salva l'interazione
2. ✅ Backend salva nel database
3. ✅ **React Query invalida la cache** per quella queryKey specifica
4. ✅ La pagina **rifà automaticamente la fetch** dei dati aggiornati
5. ✅ La timeline mostra **immediatamente la nuova interazione**

## Come Testare

1. Apri la pagina di un cliente (es. Laura Teodorescu Privato)
2. Conta quante interazioni sono mostrate nella timeline (es. 6)
3. Clicca "+ Nuova Interazione"
4. Compila i dati e salva
5. **VERIFICA**: La timeline deve aggiornarsi automaticamente e mostrare 7 interazioni
6. L'ultima interazione (quella appena creata) deve apparire in cima alla lista

## Architettura del Sistema Interazioni

### Database Schema

**Tabella:** `maestro_interactions`

Campo chiave: `customer_avatar_id` (UUID) - collega all'avatar del cliente, non direttamente all'Odoo Partner ID

```sql
CREATE TABLE maestro_interactions (
  id UUID PRIMARY KEY,
  customer_avatar_id UUID REFERENCES customer_avatars(id),
  interaction_type VARCHAR(20),
  interaction_date TIMESTAMP DEFAULT NOW(),
  outcome VARCHAR(30),
  notes TEXT,
  order_placed BOOLEAN,
  order_value NUMERIC(12, 2),
  -- altri campi...
)
```

### API Endpoints

#### POST `/api/maestro/interactions`
- **File:** [app/api/maestro/interactions/route.ts:97-207](app/api/maestro/interactions/route.ts#L97-L207)
- **Scopo:** Crea una nuova interazione
- **Body richiesto:**
  ```json
  {
    "customer_avatar_id": "uuid-string",
    "interaction_type": "visit|call|email",
    "outcome": "successful|unsuccessful|neutral",
    "notes": "...",
    "order_placed": boolean,
    "order_value": number
  }
  ```

#### GET `/api/maestro/customers/[id]`
- **File:** [app/api/maestro/customers/[id]/route.ts:98-119](app/api/maestro/customers/[id]/route.ts#L98-L119)
- **Scopo:** Recupera i dati del cliente includendo le sue interazioni
- **Flusso:**
  1. Riceve Odoo Partner ID dall'URL (es. `/api/maestro/customers/2421`)
  2. Trova il `customer_avatar_id` corrispondente
  3. Recupera le interazioni per quel `customer_avatar_id`
  4. Restituisce tutto in un unico oggetto

### Componenti Frontend

#### InteractionModal
- **File:** [components/maestro/InteractionModal.tsx](components/maestro/InteractionModal.tsx)
- **Responsabilità:**
  - Form per creare nuove interazioni
  - Invio POST a `/api/maestro/interactions`
  - **NUOVO:** Invalidazione cache React Query

#### Customer Detail Page
- **File:** [app/maestro-ai/customers/[id]/page.tsx](app/maestro-ai/customers/[id]/page.tsx)
- **Responsabilità:**
  - Visualizza i dettagli del cliente
  - Timeline delle interazioni (riga 608-670)
  - Bottone "+ Nuova Interazione" (riga 611-616)

## Note Importanti

### ID Management

Il sistema usa **due tipi di ID**:

1. **Odoo Partner ID** (integer) - ID dal sistema Odoo (es. 2421 per Laura)
2. **Customer Avatar ID** (UUID) - ID interno del database Maestro

Il mapping è gestito dalla tabella `customer_avatars`:

```
customer_avatars.odoo_partner_id = 2421
    ↓
customer_avatars.id = "abc-123-uuid"
    ↓
maestro_interactions.customer_avatar_id = "abc-123-uuid"
```

### React Query Keys

Le query keys usate:
- `['customer-detail', odooPartnerId]` - Dati completi del cliente con interazioni
- `['customer-avatars']` - Lista di tutti gli avatar (usato in altre pagine)
- `['daily-plan']` - Piano giornaliero del venditore (include interazioni)

## File Modificati

✅ [components/maestro/InteractionModal.tsx](components/maestro/InteractionModal.tsx)
- Aggiunto import `useQueryClient`
- Aggiunto hook `const queryClient = useQueryClient()`
- Aggiunta chiamata `queryClient.invalidateQueries({ queryKey: ['customer-detail', odooPartnerId.toString()] })`

## Prevenzione Futura

Ogni volta che crei/aggiorni/elimini dati che vengono visualizzati tramite React Query:

1. ✅ Identifica la `queryKey` usata nella pagina che mostra i dati
2. ✅ Dopo il successo dell'operazione, chiama `queryClient.invalidateQueries({ queryKey: [...] })`
3. ✅ React Query farà automaticamente il refetch e aggiornerà l'UI

### Esempio Pattern

```typescript
// Nel componente che modifica i dati
const queryClient = useQueryClient();

const handleSave = async () => {
  // 1. Salva i dati
  const response = await fetch('/api/...', { method: 'POST', ... });

  if (response.ok) {
    // 2. Invalida le query rilevanti
    queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] });
    queryClient.invalidateQueries({ queryKey: ['customer-list'] });

    // 3. Chiudi/reset UI
    toast.success('Salvato!');
    onClose();
  }
};
```

---

**Data risoluzione:** 27 Ottobre 2025
**Tempo di risoluzione:** ~15 minuti
**Impatto:** ALTO - Risolve problema critico UX per tutti i venditori
