# Chiusura Konto 1099 Transferkonto

Automazione processo contabile per chiudere il conto 1099 Transferkonto su Patrimonio Netto.

## Situazione

- **Conto:** 1099 Transferkonto
- **Saldo:** CHF -60,842.41 (CREDITO)
- **Movimenti:** 7 del 31.01.2024
- **Origine:** Correzioni post-migrazione software 2023
- **Obiettivo:** Portare il saldo a 0.00

## File Disponibili

### 1. Istruzioni Manuali (CONSIGLIATO)

**File:** `ISTRUZIONI-CHIUSURA-KONTO-1099.md`

Guida step-by-step per eseguire manualmente la registrazione tramite GUI Odoo.

**Vantaggi:**
- Controllo visivo completo
- Zero rischio di errori automatici
- Verifica immediata

### 2. Script Python

**File:** `chiusura-konto-1099.py`

Script Python che automatizza l'intero processo.

**Requisiti:**
```bash
pip install odoorpc
```

**Esecuzione:**
```bash
python scripts/chiusura-konto-1099.py
```

**Output:**
- Analisi conto 1099
- Identificazione conto Patrimonio Netto
- Creazione registrazione contabile
- Verifica saldo finale
- Documentazione completa

### 3. Script Node.js (PROBLEMI TECNICI)

**File:** `chiusura-konto-1099.js`

**Status:** Non funzionante a causa di problemi con la libreria `odoo-xmlrpc` e URL HTTPS di Odoo.com.

**Errore:** `ECONNREFUSED` - La libreria non riesce a connettersi correttamente agli URL Odoo.com tramite HTTPS.

**Alternativa:** Usa lo script Python o la procedura manuale.

## Credenziali Odoo

```
URL: https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
DB: lapadevadmin-lapa-v2-staging-2406-25408900
User: paul@lapa.ch
Password: lapa201180
```

## Registrazione Contabile

### Dati

- **Journal:** General (Miscellaneous Operations)
- **Data:** 15.11.2025 (o data corrente)
- **Riferimento:** Chiusura Konto 1099 Transferkonto - Correzioni post-migrazione 2023

### Movimenti

| Conto | Descrizione | Dare | Avere |
|-------|-------------|------|-------|
| 1099 | Chiusura Transferkonto su Patrimonio Netto | CHF 60,842.41 | CHF 0.00 |
| 2979* | Chiusura Transferkonto da conto 1099 | CHF 0.00 | CHF 60,842.41 |

*Il conto 2979 (o simile) deve essere di tipo **Equity** (Patrimonio Netto).

## Procedura Raccomandata

### Opzione A: Manuale (CONSIGLIATO)

1. Leggi `ISTRUZIONI-CHIUSURA-KONTO-1099.md`
2. Esegui passo per passo via GUI Odoo
3. Verifica saldo = 0.00

### Opzione B: Automatica (Python)

1. Installa `odoorpc`:
   ```bash
   pip install odoorpc
   ```

2. Esegui script:
   ```bash
   python scripts/chiusura-konto-1099.py
   ```

3. Verifica output e saldo finale

## Verifica Finale

Dopo aver creato e validato la registrazione:

1. **Odoo → Contabilità → Piano dei Conti**
2. Cerca conto **1099**
3. Verifica: **Saldo = CHF 0.00** ✅

## Supporto

### Errore "Unbalanced entry"

Verifica che:
- Dare totale = Avere totale = 60,842.41

### Conto Equity non trovato

1. Menu: Contabilità → Configurazione → Piano dei Conti
2. Cerca: "Equity" o "Patrimonio" o "Eröffnung"
3. Usa qualsiasi conto di tipo `equity` o `equity_unaffected`

### Saldo non zero dopo validazione

1. Verifica che la registrazione sia in stato **Posted** (Validata)
2. Aggiorna la vista (F5)
3. Se ancora diverso da zero, contatta il commercialista

## Documentazione

- **Istruzioni complete:** `ISTRUZIONI-CHIUSURA-KONTO-1099.md`
- **Script Python:** `chiusura-konto-1099.py`
- **Script Node.js (non funzionante):** `chiusura-konto-1099.js`

---

**Process Automator**
15.11.2025
