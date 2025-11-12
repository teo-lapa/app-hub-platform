# INDEX: Diagnosi "DGD Gastro GmbH" non trovato

**Data:** 2025-11-10
**Problema:** "DGD Gastro GmbH" non viene trovato dalla ricerca clienti
**Causa:** Filtro `customer_rank > 0` blocca 3360 clienti con `customer_rank = 0`

---

## File generati (7 totali)

### 1. Report e documentazione

#### `RIEPILOGO_DIAGNOSI_DGD.txt` (6.3KB)
**Descrizione:** Riepilogo testuale completo della diagnosi
**Contenuto:**
- Problema identificato
- Impatto totale (3360 clienti bloccati)
- Causa root
- Soluzione immediata
- Risultati test diagnostici

**Leggi questo file per:** Avere una panoramica completa del problema in formato testo.

---

#### `REPORT_DIAGNOSI_DGD_GASTRO.md` (8.1KB)
**Descrizione:** Report dettagliato in formato Markdown
**Contenuto:**
- Dati completi "DGD Gastro GmbH"
- Risultati di 7 test diagnostici
- Analisi dei filtri
- 3 soluzioni proposte
- Impatto totale con statistiche

**Leggi questo file per:** Documentazione dettagliata con esempi di codice e analisi approfondita.

---

#### `FIX_RICERCA_CLIENTI.md` (6.6KB)
**Descrizione:** Guida step-by-step per implementare la fix
**Contenuto:**
- Opzione 1: Rimuovi filtro (CONSIGLIATA)
- Opzione 2: Filtro opzionale con toggle UI
- Esempi di codice completi (prima/dopo)
- Test per verificare la fix

**Leggi questo file per:** Implementare la soluzione e risolvere il problema.

---

### 2. Dati e analisi

#### `DIAGNOSI_DGD_GASTRO.json` (1.2MB)
**Descrizione:** Dati completi di tutte le ricerche eseguite
**Contenuto:**
- Risultati di 7 test diagnostici
- Record completi trovati per ogni test
- Analisi dei filtri bloccanti
- Query corretta suggerita

**Usa questo file per:** Analisi approfondita dei dati o debugging.

---

#### `CLIENTI_BLOCCATI_customer_rank_0.json` (45KB)
**Descrizione:** Lista dei primi 100 clienti bloccati
**Contenuto:**
- 100 clienti campione con `customer_rank = 0`
- Raggruppamento per team
- Statistiche (29 aziende, 71 contatti)

**Usa questo file per:** Vedere esempi concreti di clienti bloccati.

---

### 3. Script diagnostici

#### `diagnosi-dgd-gastro-v2.js` (17KB)
**Descrizione:** Script Node.js per diagnosticare il problema
**Funzionalità:**
- Connessione a Odoo STAGING
- 7 test progressivi con filtri diversi
- Output colorato in console
- Generazione automatica di JSON

**Esegui con:**
```bash
node diagnosi-dgd-gastro-v2.js
```

**Usa questo script per:** Riprodurre la diagnosi o testare altre query.

---

#### `trova-altri-clienti-bloccati.js` (5.3KB)
**Descrizione:** Script per trovare tutti i clienti con `customer_rank = 0`
**Funzionalità:**
- Cerca tutti i clienti con `customer_rank = 0`
- Raggruppa per team
- Statistiche aziende vs contatti
- Analizza i primi 100 record

**Esegui con:**
```bash
node trova-altri-clienti-bloccati.js
```

**Usa questo script per:** Identificare l'impatto totale del problema.

---

## Quick Start

### 1. Per capire il problema
Leggi: `RIEPILOGO_DIAGNOSI_DGD.txt`

### 2. Per implementare la fix
Leggi: `FIX_RICERCA_CLIENTI.md`

### 3. Per analisi approfondita
Leggi: `REPORT_DIAGNOSI_DGD_GASTRO.md`

### 4. Per vedere i dati
Apri: `DIAGNOSI_DGD_GASTRO.json` o `CLIENTI_BLOCCATI_customer_rank_0.json`

### 5. Per riprodurre la diagnosi
Esegui: `node diagnosi-dgd-gastro-v2.js`

---

## Soluzione Rapida (TL;DR)

**File:** `C:\Users\lapa\OneDrive\Desktop\Claude Code\app\api\clienti\search\route.ts`
**Riga:** 114

**RIMUOVI:**
```typescript
['customer_rank', '>', 0],  // ← ELIMINA QUESTA RIGA
```

**Risultato:**
- ✅ "DGD Gastro GmbH" diventa ricercabile
- ✅ Altri 3359 clienti diventano visibili
- ✅ Possibile aggiungere nuovi clienti al catalogo

---

## Statistiche finali

- **Clienti bloccati:** 3360
- **Test eseguiti:** 7
- **File generati:** 7
- **Dimensione totale:** ~1.3MB
- **Script Node.js:** 2
- **Report documentazione:** 3
- **File dati (JSON):** 2

---

## File originale modificato

**Prima della diagnosi:**
- `app/api/clienti/search/route.ts` - Riga 114 blocca 3360 clienti

**Dopo la fix:**
- Rimuovere riga 114 per sbloccare tutti i clienti

---

**Generato da:** Claude Code Agent
**Tempo totale diagnosi:** ~10 minuti
**Problema identificato:** customer_rank = 0 blocca la ricerca
**Soluzione:** Rimuovere filtro customer_rank > 0
