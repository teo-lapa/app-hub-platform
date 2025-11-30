# START HERE - Verifica Marzo 2024

**Benvenuto!** Questo e il punto di partenza per la verifica movimenti bancari Marzo 2024.

---

## Cosa Trovi Qui

Hai appena completato la **prima verifica automatica** dei movimenti bancari di Marzo 2024 confrontando Odoo con gli estratti conto.

**Risultato**: Verifica **INCOMPLETA** perche mancano i PDF degli estratti conto.

---

## File Principali (Inizia da Questi)

### 1. Per Management/Commercialista
**Leggi**: [REPORT-MARZO-2024-EXECUTIVE-SUMMARY.md](./REPORT-MARZO-2024-EXECUTIVE-SUMMARY.md)

Contiene:
- Summary esecutivo
- Movimenti critici identificati (EUR 97k, stipendi, fornitori IT)
- Raccomandazioni e prossimi step

**Tempo lettura**: 5 minuti

---

### 2. Per Chi Deve Agire
**Leggi**: [MARZO-2024-TODO.md](./MARZO-2024-TODO.md)

Contiene:
- Checklist documenti mancanti
- Istruzioni step-by-step
- Comandi da eseguire

**Tempo lettura**: 3 minuti

---

### 3. Per Avere Tutto Chiaro
**Leggi**: [README-VERIFICA-MARZO-2024.md](./README-VERIFICA-MARZO-2024.md)

Contiene:
- Guida completa all'uso
- Troubleshooting
- Personalizzazione script
- FAQ

**Tempo lettura**: 10 minuti

---

## Quick Summary (30 Secondi)

```
PERIODO: Marzo 2024 (01/03 - 31/03)

TROVATO IN ODOO:
- Konto 1024 (UBS CHF):        367 movimenti | CHF  98,263.33
- Konto 1025 (UBS EUR):         51 movimenti | EUR  22,417.33
- Konto 1026 (Credit Suisse):  176 movimenti | CHF -30,950.09
TOTALE:                        594 movimenti

TROVATO IN ESTRATTI CONTO:
- UBS CHF:        0 movimenti (FILE VUOTO)
- UBS EUR:        0 movimenti (FILE VUOTO)
- Credit Suisse:  0 movimenti (FILE VUOTO)

MATCH RATE: 0% (impossibile verificare senza estratti)

MOVIMENTI CRITICI:
1. Cambio valuta EUR 97,000 (21/03/2024)
2. Stipendi marzo CHF 13,453 (29/03/2024)
3. Fornitori IT EUR ~60k (20-28/03/2024)
```

---

## Prossimi Step IMMEDIATI

### Step 1: Ottieni PDF Estratti Conto

Scarica da online banking:
- [ ] UBS CHF Marzo 2024 → Salva come `data-estratti/UBS-CHF-2024-03-MARCH.pdf`
- [ ] UBS EUR Marzo 2024 → Salva come `data-estratti/UBS-EUR-2024-03-MARCH.pdf`
- [ ] Credit Suisse Marzo 2024 → Salva come `data-estratti/CREDIT-SUISSE-2024-03-MARCH.pdf`

### Step 2: Parsa PDF in JSON

```bash
# Usa parser esistente o Jetson OCR
python scripts/parse-ubs-statement.py data-estratti/UBS-CHF-2024-03-MARCH.pdf
```

### Step 3: Ri-esegui Verifica

```bash
./run-verifica-marzo-2024.sh
```

Ora il match rate dovrebbe essere **>95%**.

---

## File Generati da Questa Verifica

| File | Dimensione | Descrizione |
|------|-----------|-------------|
| **REPORT-MARZO-2024.json** | 205 KB | Dati completi 594 movimenti |
| **REPORT-MARZO-2024-EXECUTIVE-SUMMARY.md** | 4.5 KB | Report esecutivo |
| **MARZO-2024-TODO.md** | 3.6 KB | TODO list operativa |
| **MARZO-2024-SUMMARY.txt** | 4.1 KB | Summary ultra-compatto |
| **README-VERIFICA-MARZO-2024.md** | 11 KB | Guida completa |
| **INDEX-VERIFICA-MARZO-2024.md** | 8.1 KB | Indice navigazione |
| **scripts/verifica-marzo-2024.py** | 18 KB | Script Python verifica |
| **run-verifica-marzo-2024.sh** | 6.2 KB | Wrapper Bash |

---

## Comandi Utili

```bash
# Vedi summary veloce
cat MARZO-2024-SUMMARY.txt

# Leggi report esecutivo
cat REPORT-MARZO-2024-EXECUTIVE-SUMMARY.md

# Controlla file richiesti
./run-verifica-marzo-2024.sh --check-files

# Esegui verifica completa
./run-verifica-marzo-2024.sh

# Esplora dati JSON
python -m json.tool REPORT-MARZO-2024.json | less

# Cerca movimenti specifici
grep -i "cambio valuta" REPORT-MARZO-2024.json

# Vedi tutti i file generati
ls -lh *MARZO-2024*
```

---

## Roadmap Documenti

```
START-HERE-MARZO-2024.md (TU SEI QUI)
  │
  ├─→ [QUICK] MARZO-2024-SUMMARY.txt
  │    └─→ Summary 30 secondi
  │
  ├─→ [EXECUTIVE] REPORT-MARZO-2024-EXECUTIVE-SUMMARY.md
  │    ├─→ Analisi dettagliata
  │    ├─→ Movimenti critici
  │    └─→ Raccomandazioni
  │
  ├─→ [ACTION] MARZO-2024-TODO.md
  │    ├─→ Checklist documenti
  │    ├─→ Step-by-step guide
  │    └─→ Comandi pronti
  │
  ├─→ [GUIDE] README-VERIFICA-MARZO-2024.md
  │    ├─→ How to use
  │    ├─→ Troubleshooting
  │    ├─→ Customization
  │    └─→ FAQ
  │
  ├─→ [INDEX] INDEX-VERIFICA-MARZO-2024.md
  │    └─→ Navigazione completa documenti
  │
  └─→ [DATA] REPORT-MARZO-2024.json
       └─→ Dati completi 594 movimenti
```

---

## Domande Frequenti

### "Perche match rate e 0%?"
I file JSON degli estratti conto sono vuoti. Servono i PDF originali da UBS e Credit Suisse.

### "Quanto tempo serve per completare?"
- Download PDF: 5 minuti
- Parse PDF→JSON: 2 minuti
- Ri-eseguire verifica: 30 secondi
**Totale**: ~8 minuti

### "Cosa faccio se trovo discrepanze?"
Leggi la sezione "Interpretare i Risultati" in [README-VERIFICA-MARZO-2024.md](./README-VERIFICA-MARZO-2024.md)

### "Posso usare questo per altri mesi?"
Si! Copia `scripts/verifica-marzo-2024.py` e modifica le date.

---

## Navigazione Veloce

| Se Vuoi... | Vai a... |
|-----------|---------|
| **Capire cosa e successo** | [REPORT-MARZO-2024-EXECUTIVE-SUMMARY.md](./REPORT-MARZO-2024-EXECUTIVE-SUMMARY.md) |
| **Sapere cosa fare ora** | [MARZO-2024-TODO.md](./MARZO-2024-TODO.md) |
| **Summary velocissimo** | [MARZO-2024-SUMMARY.txt](./MARZO-2024-SUMMARY.txt) |
| **Guida completa** | [README-VERIFICA-MARZO-2024.md](./README-VERIFICA-MARZO-2024.md) |
| **Vedere tutti i file** | [INDEX-VERIFICA-MARZO-2024.md](./INDEX-VERIFICA-MARZO-2024.md) |
| **Dati raw completi** | [REPORT-MARZO-2024.json](./REPORT-MARZO-2024.json) |

---

## Supporto

### Documentazione
Tutti i file sono nella directory principale del progetto con prefisso `MARZO-2024-*`

### Script
- `scripts/verifica-marzo-2024.py` - Script Python principale
- `run-verifica-marzo-2024.sh` - Wrapper Bash con help

### Help Comandi
```bash
./run-verifica-marzo-2024.sh --help
python scripts/verifica-marzo-2024.py --help  # (se implementato)
```

---

## Credits

**Creato da**: Backend Specialist Agent
**Data**: 16 Novembre 2025
**Tecnologie**: Python 3.13, Odoo XML-RPC, Bash
**Ambiente**: Windows 10, Git Bash

---

**Buona verifica!** 🎯

Inizia da qui: [REPORT-MARZO-2024-EXECUTIVE-SUMMARY.md](./REPORT-MARZO-2024-EXECUTIVE-SUMMARY.md)
