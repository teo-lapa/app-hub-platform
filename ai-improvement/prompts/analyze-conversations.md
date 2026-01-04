# Prompt: Analizza Conversazioni

Questo è il processo che seguo quando analizzo le conversazioni.

---

## Step 1: Recupero Conversazioni

Leggo le conversazioni da Vercel KV usando l'API:
```
GET /api/lapa-agents/conversations?limit=50
```

Oppure leggo direttamente i log dalla dashboard `/lapa-ai-agents`

---

## Step 2: Per Ogni Conversazione

### Identifico il Tipo di Utente

**Se ha `customerId`** → Utente Registrato
- Cerco se esiste già un avatar in `avatars/{customerId}.md`
- Se no, lo creo
- Se sì, lo aggiorno con nuove info

**Se NON ha `customerId`** → Visitatore
- Noto se c'era opportunità di convertirlo
- Miglioro il prompt per visitatori se serve

### Analizzo la Qualità delle Risposte

Per ogni scambio user→assistant chiedo:

1. **La risposta era corretta?**
   - Ha risposto alla domanda?
   - Le info erano accurate?

2. **Il tono era appropriato?**
   - Troppo formale/informale?
   - Sembrava un robot o una persona?

3. **C'erano opportunità mancate?**
   - Poteva fare upselling?
   - Poteva raccogliere info utili?
   - Poteva essere più personale?

4. **Ci sono stati errori?**
   - Errori tecnici?
   - Risposte "non so"?
   - Confusione sull'intent?

---

## Step 3: Classifico i Problemi

Categorie:
- **PROMPT**: Il prompt dell'agente va migliorato
- **AVATAR**: Serve aggiornare l'avatar utente
- **KNOWLEDGE**: Manca una conoscenza (FAQ, policy, etc.)
- **BUG**: C'è un bug tecnico da segnalare
- **OK**: Tutto andato bene

---

## Step 4: Applico i Miglioramenti

### Per problemi PROMPT
→ Aggiungo nota in `agent-improvements/{agente}.md`
→ Se critico, modifico direttamente il codice dell'agente

### Per problemi AVATAR
→ Aggiorno `avatars/{customerId}.md` con nuove info

### Per problemi KNOWLEDGE
→ Aggiungo in `knowledge/common-questions.md`

### Per BUG
→ Segnalo nel log giornaliero per fix tecnico

---

## Step 5: Scrivo il Log

In `logs/YYYY-MM-DD.md` documento:
- Conversazioni analizzate
- Problemi trovati
- Azioni fatte
- TODO per domani

---

## Esempio di Analisi

```
CONVERSAZIONE: session_abc123
UTENTE: Mario Rossi (customerId: 456)
CANALE: WhatsApp

SCAMBIO 1:
User: "Ciao, quanto costa il salmone?"
Agent: "Buongiorno! Il salmone norvegese costa 28€/kg..."

ANALISI:
- Risposta: ✅ Corretta
- Tono: ⚠️ Troppo formale per WhatsApp
- Opportunità: ❌ Non ha chiesto quanto ne vuole
- Errori: Nessuno

AZIONI:
1. AVATAR: Mario usa WhatsApp, preferisce tono informale
2. PROMPT: Aggiungere suggerimento "chiedi quantità" dopo info prezzo
```
