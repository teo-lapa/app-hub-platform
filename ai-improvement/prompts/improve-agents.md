# Prompt: Migliora Agenti

Come miglioro i singoli agenti basandomi sulle conversazioni analizzate.

---

## Agenti da Migliorare

| Agente | File | Cosa fa |
|--------|------|---------|
| Orchestrator | `/lib/lapa-agents/orchestrator.ts` | Smista intent, prompt principale |
| Orders | `/lib/lapa-agents/agents/orders-agent.ts` | Ordini e carrello |
| Products | `/lib/lapa-agents/agents/products-agent.ts` | Ricerca prodotti |
| Invoices | `/lib/lapa-agents/agents/invoices-agent.ts` | Fatture |
| Shipping | `/lib/lapa-agents/agents/shipping-agent.ts` | Spedizioni |
| Helpdesk | `/lib/lapa-agents/agents/helpdesk-agent.ts` | Ticket supporto |

---

## Tipi di Miglioramenti

### 1. Miglioramento Prompt (Frequente)

**Quando**: L'agente risponde ma non nel modo ideale
**Come**: Modifico il system prompt o le istruzioni

**Esempio**:
```
PROBLEMA: L'agente dice "Non ho trovato il prodotto" senza suggerire alternative
MIGLIORIA: Aggiungere nel prompt:
"Se non trovi il prodotto esatto, suggerisci sempre 2-3 alternative simili"
```

### 2. Miglioramento Intent (Medio)

**Quando**: L'intent viene classificato male
**Come**: Aggiungo keyword o esempi nell'orchestrator

**Esempio**:
```
PROBLEMA: "Voglio fare un reso" viene classificato come "order_inquiry"
MIGLIORIA: Aggiungere "reso", "restituire", "rimborso" alle keyword di "helpdesk"
```

### 3. Miglioramento Tono (Frequente)

**Quando**: Il tono non è appropriato per il canale o l'utente
**Come**: Aggiungo istruzioni specifiche per canale

**Esempio**:
```
PROBLEMA: Su WhatsApp risponde troppo formale
MIGLIORIA: "Per canale WhatsApp, usa tono amichevole e informale.
Usa emoji occasionali. Evita formule troppo corporate."
```

### 4. Miglioramento Personalizzazione (Importante!)

**Quando**: L'agente non usa le info dell'avatar
**Come**: Integro meglio la lettura dell'avatar nella risposta

**Esempio**:
```
PROBLEMA: Non saluta Mario per nome anche se lo conosce
MIGLIORIA: "Se conosci il nome del cliente, usalo sempre nel saluto.
Se è un cliente abituale, fai riferimento ai suoi acquisti precedenti."
```

---

## Come Applico i Miglioramenti

### Per miglioramenti PICCOLI (note)
Scrivo in `agent-improvements/{agente}.md`:
```markdown
## 2026-01-03 - Suggerire alternative

Quando non trova un prodotto, l'agente dovrebbe:
1. Dire che non l'ha trovato
2. Suggerire 2-3 alternative simili
3. Chiedere se vuole cercare qualcos'altro

TODO: Implementare nel prossimo ciclo di sviluppo
```

### Per miglioramenti CRITICI (codice)
Modifico direttamente il file dell'agente se:
- È un bug che impedisce il funzionamento
- Causa risposte completamente sbagliate
- È facile da implementare (poche righe)

---

## Checklist Miglioramento

Per ogni agente, verifico periodicamente:

- [ ] **Accuratezza**: Le risposte sono corrette?
- [ ] **Completezza**: Risponde a tutto o mancano casi?
- [ ] **Tono**: È appropriato per canale e utente?
- [ ] **Personalizzazione**: Usa le info dell'avatar?
- [ ] **Proattività**: Suggerisce, fa upselling, chiede info?
- [ ] **Gestione errori**: Cosa fa quando non sa?
- [ ] **Multilingual**: Funziona in IT/DE/FR/EN?

---

## Template Nota Miglioramento

```markdown
## YYYY-MM-DD - Titolo breve

**Problema osservato**:
[Descrizione del problema visto in conversazione]

**Conversazione di esempio**:
[Link o excerpt della conversazione]

**Soluzione proposta**:
[Come risolvere il problema]

**Priorità**: Alta/Media/Bassa

**Stato**: TODO / IN PROGRESS / DONE
```
