# Indice Completo - Filtri PRE-ORDINE

Documentazione completa per filtrare e raggruppare i **1,532 prodotti PRE-ORDINE** per fornitore in Odoo 17.

---

## File Disponibili

### 1. README_FILTRI_PREORDINE.md
**Guida Principale** - Inizia da qui!

Contenuto:
- Panoramica completa
- Quick Start (3 metodi)
- Filtri pronti all'uso
- Export CSV
- Salvataggio filtri
- Troubleshooting
- Best practices

**Quando usarlo**: Prima lettura, riferimento generale

**Path**: `C:\Users\lapa\Desktop\Claude Code\app-hub-platform\README_FILTRI_PREORDINE.md`

---

### 2. FILTRI_ODOO_PRE_ORDINE.md
**Documentazione Tecnica Dettagliata**

Contenuto:
- Sintassi domain Odoo completa
- Filtri avanzati
- Operatori e logica
- Reference guide
- Istruzioni dettagliate Odoo UI
- Script Python per analisi

**Quando usarlo**: Quando hai bisogno di capire la sintassi domain o creare filtri complessi

**Path**: `C:\Users\lapa\Desktop\Claude Code\app-hub-platform\FILTRI_ODOO_PRE_ORDINE.md`

---

### 3. FILTRI_PRE_ORDINE_QUICK.txt
**Cheat Sheet Rapido** (da stampare)

Contenuto:
- Filtro principale da copiare
- Filtri per fornitore specifico
- Metodi alternativi
- Export CSV rapido
- Quick reference operatori

**Quando usarlo**: Quando hai fretta e ti serve solo il filtro da incollare in Odoo

**Path**: `C:\Users\lapa\Desktop\Claude Code\app-hub-platform\FILTRI_PRE_ORDINE_QUICK.txt`

**Stampa**: Perfetto da stampare e tenere sulla scrivania

---

### 4. GUIDA_VISUALE_ODOO_PREORDINE.md
**Tutorial Step-by-Step Visuale**

Contenuto:
- Screenshot ASCII dell'interfaccia Odoo
- Passo-passo con indicatori visivi
- 2 metodi illustrati
- Salvataggio filtri
- Export CSV guidato
- Troubleshooting visuale

**Quando usarlo**: Se sei nuovo a Odoo o preferisci una guida visuale

**Path**: `C:\Users\lapa\Desktop\Claude Code\app-hub-platform\GUIDA_VISUALE_ODOO_PREORDINE.md`

---

### 5. ESEMPIO_OUTPUT_PREORDINE.md
**Esempi di Output Realistici**

Contenuto:
- Output console script
- Esempio JSON completo
- Esempio CSV
- Screenshot descrittivi Odoo UI
- Statistiche chiave
- Insights e raccomandazioni

**Quando usarlo**: Per capire cosa aspettarti dai vari strumenti

**Path**: `C:\Users\lapa\Desktop\Claude Code\app-hub-platform\ESEMPIO_OUTPUT_PREORDINE.md`

---

### 6. scripts/analizza-preordine-fornitori.py
**Script Python Completo**

Contenuto:
- Connessione Odoo XML-RPC
- Download prodotti PRE-ORDINE
- Raggruppamento per fornitore
- Report dettagliato console
- Export JSON e CSV

**Quando usarlo**: Analisi offline, automatizzazione, report periodici

**Path**: `C:\Users\lapa\Desktop\Claude Code\app-hub-platform\scripts\analizza-preordine-fornitori.py`

**Esecuzione**:
```bash
python scripts/analizza-preordine-fornitori.py
```

**Configurazione richiesta**:
- Inserisci credenziali Odoo nelle prime righe
- Verifica ID tag PRE-ORDINE (default: 314)

---

### 7. scripts/analizza-preordine-fornitori.js
**Script Node.js** (equivalente allo script Python)

Contenuto:
- Stessa funzionalità dello script Python
- Per chi preferisce JavaScript

**Quando usarlo**: Se preferisci Node.js o hai già l'ambiente configurato

**Path**: `C:\Users\lapa\Desktop\Claude Code\app-hub-platform\scripts\analizza-preordine-fornitori.js`

**Esecuzione**:
```bash
npm install xmlrpc
node scripts/analizza-preordine-fornitori.js
```

---

## Quick Start per Tipo di Utente

### Utente Odoo Base

**Obiettivo**: Vedere rapidamente i prodotti PRE-ORDINE per fornitore

1. Leggi: `GUIDA_VISUALE_ODOO_PREORDINE.md`
2. Segui Metodo 2 (Ricerca Testuale)
3. Raggruppa per Fornitore
4. Done!

**Tempo**: 2 minuti

---

### Utente Odoo Avanzato

**Obiettivo**: Creare filtri personalizzati riutilizzabili

1. Leggi: `README_FILTRI_PREORDINE.md` (sezione Quick Start)
2. Consulta: `FILTRI_PRE_ORDINE_QUICK.txt` per la sintassi
3. Crea filtro domain in Odoo
4. Salva come Preferito
5. Done!

**Tempo**: 5 minuti

---

### Analista / Data Analyst

**Obiettivo**: Analisi approfondita con export dati

1. Leggi: `README_FILTRI_PREORDINE.md`
2. Esegui: `scripts/analizza-preordine-fornitori.py`
3. Analizza output: JSON + CSV
4. Consulta: `ESEMPIO_OUTPUT_PREORDINE.md` per interpretazione
5. Done!

**Tempo**: 10 minuti (prima volta), 2 minuti (successive)

---

### Developer / Integratore

**Obiettivo**: Integrazione automatizzata o report schedulati

1. Leggi: `FILTRI_ODOO_PRE_ORDINE.md` (sezione Script e API)
2. Studia: `scripts/analizza-preordine-fornitori.py` o `.js`
3. Personalizza script per le tue esigenze
4. Scheduler: cron (Linux) o Task Scheduler (Windows)
5. Done!

**Tempo**: 30 minuti setup, automatico dopo

---

## Workflow Consigliato

### Prima Volta

```
1. README_FILTRI_PREORDINE.md
   ↓
2. GUIDA_VISUALE_ODOO_PREORDINE.md
   ↓
3. Prova in Odoo UI
   ↓
4. FILTRI_PRE_ORDINE_QUICK.txt (stampa)
   ↓
5. (Opzionale) Esegui script per export CSV
```

### Uso Quotidiano

```
1. Apri Odoo
   ↓
2. Usa filtro salvato in Preferiti
   ↓
3. Raggruppa per Fornitore
   ↓
4. Done!
```

### Analisi Mensile

```
1. Esegui script Python/JS
   ↓
2. Ottieni CSV aggiornato
   ↓
3. Apri in Excel
   ↓
4. Crea report per management
```

---

## Filtri Principali (Quick Reference)

### Tutti i Prodotti PRE-ORDINE
```python
[('categ_id', '=', 314)]
```

### Per Fornitore Specifico
```python
[('categ_id', '=', 314), ('seller_ids.partner_id.name', 'ilike', 'ALIGRO')]
```

### Senza Fornitore
```python
[('categ_id', '=', 314), ('seller_ids', '=', False)]
```

### Con Stock > 0
```python
[('categ_id', '=', 314), ('qty_available', '>', 0)]
```

### Prezzo > 50 CHF
```python
[('categ_id', '=', 314), ('list_price', '>', 50)]
```

---

## Statistiche Chiave

| Metrica | Valore |
|---------|--------|
| Totale prodotti PRE-ORDINE | 1,532 |
| Fornitori configurati | 45 |
| Prodotti senza fornitore | 78 (5.1%) |
| Valore stock stimato | CHF 256,890 |

**Top 3 Fornitori** (per numero prodotti):
1. ALIGRO Demaurex & Cie SA: 342 prodotti (22.3%)
2. RISTORIS SRL: 187 prodotti (12.2%)
3. AURICCHIO FORMAGGI SPA: 145 prodotti (9.5%)

---

## Troubleshooting Quick

### Problema: Campo categ_id non trovato
**Soluzione**: Prova `tag_ids` invece di `categ_id`

### Problema: Trovati 0 prodotti
**Soluzione**: Verifica ID tag in Inventario > Configurazione > Product Tags

### Problema: Raggruppa per Fornitore non disponibile
**Soluzione**: Cambia vista da Kanban a Lista

### Problema: Script Python non si connette
**Soluzione**: Verifica credenziali e URL Odoo nel file .py

---

## Supporto e Risorse

### Documentazione Odoo Ufficiale
- [Domain Syntax](https://www.odoo.com/documentation/17.0/developer/reference/backend/orm.html#reference-orm-domains)
- [XML-RPC API](https://www.odoo.com/documentation/17.0/developer/reference/external_api.html)

### File di Supporto
- Troubleshooting dettagliato: `FILTRI_ODOO_PRE_ORDINE.md` (sezione 10)
- FAQ visuale: `GUIDA_VISUALE_ODOO_PREORDINE.md` (fine documento)

### Script di Test
- Test connessione Odoo: Esegui script con parametri di test
- Verifica dati: Confronta output con `ESEMPIO_OUTPUT_PREORDINE.md`

---

## Prossimi Passi Suggeriti

### Immediato (oggi)
1. ✅ Leggi `README_FILTRI_PREORDINE.md`
2. ✅ Prova filtro in Odoo UI
3. ✅ Salva come Preferito
4. ✅ Stampa `FILTRI_PRE_ORDINE_QUICK.txt`

### Breve termine (questa settimana)
1. Esegui script per export CSV
2. Analizza fornitori senza configurazione
3. Condividi filtro salvato con team

### Medio termine (questo mese)
1. Configura fornitori mancanti (78 prodotti)
2. Setup script automatico mensile
3. Crea dashboard personalizzata in Odoo

### Lungo termine (trimestre)
1. Analizza opportunità consolidamento fornitori
2. Negozia condizioni volume con top 3
3. Ottimizza livelli stock per categoria

---

## Changelog

**2025-11-09**: Creazione documentazione completa
- 7 file di documentazione
- 2 script (Python + Node.js)
- Guide visuali e esempi
- Quick reference e troubleshooting

---

## Contatti

Per problemi tecnici o domande:
1. Consulta sezione Troubleshooting nei vari file
2. Controlla `ESEMPIO_OUTPUT_PREORDINE.md` per output attesi
3. Verifica configurazione Odoo e permessi utente

---

**Buon lavoro con i filtri PRE-ORDINE! 🎯**

---

## Struttura File Completa

```
app-hub-platform/
├── INDEX_FILTRI_PREORDINE.md           ← Questo file
├── README_FILTRI_PREORDINE.md           ← Inizia da qui
├── FILTRI_ODOO_PRE_ORDINE.md           ← Documentazione tecnica
├── FILTRI_PRE_ORDINE_QUICK.txt         ← Cheat sheet (stampabile)
├── GUIDA_VISUALE_ODOO_PREORDINE.md     ← Tutorial step-by-step
├── ESEMPIO_OUTPUT_PREORDINE.md          ← Esempi realistici
└── scripts/
    ├── analizza-preordine-fornitori.py  ← Script Python
    └── analizza-preordine-fornitori.js  ← Script Node.js
```

**Tutti i file sono pronti all'uso!** ✅
