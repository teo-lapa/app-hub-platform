# VERIFICA MARZO 2024 - README

Verifica completa riga per riga dei movimenti bancari di **Marzo 2024** confrontando estratti conto vs registrazioni Odoo.

---

## TL;DR - Quick Start

```bash
# 1. Verifica file richiesti
./run-verifica-marzo-2024.sh --check-files

# 2. Esegui verifica completa
./run-verifica-marzo-2024.sh

# 3. Leggi summary
cat MARZO-2024-SUMMARY.txt

# 4. Report dettagliato
cat REPORT-MARZO-2024-EXECUTIVE-SUMMARY.md
```

---

## Cosa Fa Questo Tool

Questo tool **confronta automaticamente** i movimenti bancari di Marzo 2024 tra:

1. **Estratti conto bancari** (JSON parsati da PDF)
   - UBS CHF (Konto 1024)
   - UBS EUR (Konto 1025)
   - Credit Suisse CHF (Konto 1026)

2. **Registrazioni Odoo** (via XML-RPC)
   - account.move.line per i 3 konti
   - Periodo: 01/03/2024 - 31/03/2024

**Output**: Report dettagliato con:
- Movimenti matchati (presenti in entrambi)
- Movimenti solo in estratti (mancano in Odoo)
- Movimenti solo in Odoo (mancano in estratti)
- Discrepanze e conflitti

---

## Prerequisiti

### Software
- Python 3.7+
- Bash (Git Bash su Windows)
- Accesso Odoo XML-RPC

### Credenziali Odoo
```bash
export ODOO_URL="https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com"
export ODOO_DB="lapadevadmin-lapa-v2-main-7268478"
export ODOO_USERNAME="apphubplatform@lapa.ch"
export ODOO_PASSWORD="apphubplatform2025"
```

### File Richiesti
```
data-estratti/
├── UBS-CHF-2024-CLEAN.json          (Estratto UBS CHF marzo 2024)
├── UBS-EUR-2024-CLEAN.json          (Estratto UBS EUR marzo 2024)
└── CREDIT-SUISSE-2024-CLEAN.json    (Estratto Credit Suisse marzo 2024)
```

**ATTENZIONE**: Attualmente questi file sono **vuoti**. Servono i PDF originali da parsare.

---

## Come Usare

### Opzione 1: Script Automatico (Raccomandato)

```bash
# Esegui verifica completa
./run-verifica-marzo-2024.sh

# Solo summary (veloce)
./run-verifica-marzo-2024.sh --summary

# Controlla file richiesti
./run-verifica-marzo-2024.sh --check-files

# Help
./run-verifica-marzo-2024.sh --help
```

### Opzione 2: Script Python Diretto

```bash
# Set credentials
export ODOO_URL="https://..."
export ODOO_DB="..."
export ODOO_USERNAME="..."
export ODOO_PASSWORD="..."

# Run
python scripts/verifica-marzo-2024.py
```

### Opzione 3: Da File .env.local

```bash
# Carica credenziali da .env.local
source .env.local
export ODOO_USERNAME=$ODOO_ADMIN_EMAIL
export ODOO_PASSWORD=$ODOO_ADMIN_PASSWORD

# Run
python scripts/verifica-marzo-2024.py
```

---

## Output Files

Dopo l'esecuzione vengono generati questi file:

| File | Descrizione | Priorita |
|------|-------------|----------|
| **REPORT-MARZO-2024.json** | Dati completi JSON (594 movimenti) | HIGH |
| **REPORT-MARZO-2024-EXECUTIVE-SUMMARY.md** | Report esecutivo con analisi | HIGH |
| **MARZO-2024-TODO.md** | TODO list e istruzioni operative | HIGH |
| **MARZO-2024-SUMMARY.txt** | Summary ultra-compatto | MEDIUM |
| **INDEX-VERIFICA-MARZO-2024.md** | Indice navigazione documenti | INFO |
| **verifica-marzo-2024.log** | Log esecuzione script | DEBUG |

---

## Interpretare i Risultati

### Status OK
```
[OK] Konti OK: ['1024', '1025', '1026']

Movimenti matchati:     594
Solo in JSON:             0
Solo in Odoo:             0
```

**Significato**: Tutti i movimenti matchano perfettamente tra estratti e Odoo.

### Status WARNING (Situazione attuale)
```
[!] Konti Warning: ['1024', '1025', '1026']

Movimenti matchati:       0
Solo in JSON:             0
Solo in Odoo:           594
```

**Significato**: I file JSON sono vuoti, quindi non c'e match. Servono gli estratti originali.

### Status ERROR
```
[X] Konti Errori: ['1024']

Movimenti matchati:     500
Solo in JSON:            50
Solo in Odoo:            44
```

**Significato**: Ci sono discrepanze significative. Serve indagine manuale.

---

## Caso d'Uso: Situazione Attuale

### Problema
I file JSON degli estratti conto sono **vuoti**:
```bash
$ cat data-estratti/UBS-CHF-2024-CLEAN.json
{"movements": []}
```

### Soluzione
1. **Ottenere PDF estratti conto** di marzo 2024 da UBS e Credit Suisse
2. **Parsare PDF -> JSON** usando script esistenti o Jetson OCR
3. **Ri-eseguire verifica** con `./run-verifica-marzo-2024.sh`

### Step Dettagliati

#### Step 1: Download PDF
Accedi a:
- UBS Online Banking → Estratti Conto → Marzo 2024 → Download PDF
- Credit Suisse Online → Statements → March 2024 → Download PDF

Salva come:
```
data-estratti/UBS-CHF-2024-03-MARCH.pdf
data-estratti/UBS-EUR-2024-03-MARCH.pdf
data-estratti/CREDIT-SUISSE-2024-03-MARCH.pdf
```

#### Step 2: Parse PDF
```bash
# Usa parser esistente (se disponibile)
python scripts/parse-ubs-statement.py data-estratti/UBS-CHF-2024-03-MARCH.pdf

# oppure Jetson OCR
curl -X POST https://your-jetson-ocr/parse \
  -F "file=@data-estratti/UBS-CHF-2024-03-MARCH.pdf" \
  -o data-estratti/UBS-CHF-2024-CLEAN.json
```

#### Step 3: Verifica
```bash
./run-verifica-marzo-2024.sh
```

Ora il match rate dovrebbe essere >95%.

---

## Movimenti Critici Identificati

Anche senza estratti, l'analisi Odoo ha identificato **3 movimenti critici**:

### 1. Cambio Valuta EUR 97,000
**Konto**: 1025 (UBS EUR)
**Data**: 21/03/2024
**Importo**: -97,000.00 EUR
**Descrizione**: Acquistato EUR; Venduto CHF; FX CG-S176W

**Da verificare**:
- Transazione presente in estratto UBS EUR
- Corrispondente movimento in UBS CHF
- Tasso di cambio applicato
- Spread bancario

### 2. Stipendi Marzo
**Konto**: 1024 (UBS CHF)
**Data**: 29/03/2024
**Totale**: CHF 13,453.90

| Dipendente | Importo |
|------------|---------|
| Mihai Nita | CHF 4,499.55 |
| Marco Calabrese | CHF 6,017.00 |
| Marius Negrut | CHF 2,937.35 |

**Da verificare**:
- Pagamenti registrati correttamente in Odoo
- Date valuta in estratto bancario
- Corrispondenza con libro paga marzo

### 3. Fornitori Italiani
**Konto**: 1025 (UBS EUR)
**Periodo**: 20-28 Marzo
**Totale**: ~EUR 60,000

| Fornitore | Importo |
|-----------|---------|
| FERRAIUOLO FOODS | EUR 27,829.37 |
| SICA S.R.L. | EUR 24,054.06 |
| OLEIFICIO ZUCCHI | EUR 7,912.87 |

**Da verificare**:
- Match con fatture fornitori
- IVA applicata correttamente
- DDT/ordini di acquisto

---

## Troubleshooting

### Errore: "Credenziali Odoo mancanti"
**Soluzione**:
```bash
export ODOO_USERNAME="apphubplatform@lapa.ch"
export ODOO_PASSWORD="apphubplatform2025"
```

### Errore: "File JSON vuoto"
**Soluzione**: Ottieni PDF estratti conto e parsali (vedi Step 1-2 sopra)

### Errore: "Connection timeout Odoo"
**Soluzione**: Verifica connessione internet e URL Odoo:
```bash
curl https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com
```

### Errore: "Account non trovato"
**Soluzione**: Verifica codici konto in Odoo (1024, 1025, 1026 devono esistere)

---

## Personalizzazione

### Cambiare Periodo
Edita `scripts/verifica-marzo-2024.py`:
```python
PERIODO_START = '2024-04-01'  # Cambio a aprile
PERIODO_END = '2024-04-30'
```

### Aggiungere Konti
Edita `scripts/verifica-marzo-2024.py`:
```python
JSON_FILES = {
    '1024': 'data-estratti/UBS-CHF-2024-CLEAN.json',
    '1025': 'data-estratti/UBS-EUR-2024-CLEAN.json',
    '1026': 'data-estratti/CREDIT-SUISSE-2024-CLEAN.json',
    '1027': 'data-estratti/POSTFINANCE-2024-CLEAN.json',  # Nuovo
}
```

### Modificare Tolleranza Match
Edita `scripts/verifica-marzo-2024.py`:
```python
# Tolleranza attuale: 0.01 CHF
if abs(json_mov['amount'] - odoo_mov['amount']) < Decimal('0.01'):

# Aumenta a 0.10 CHF
if abs(json_mov['amount'] - odoo_mov['amount']) < Decimal('0.10'):
```

---

## Architettura

```
VERIFICA MARZO 2024
│
├── INPUT
│   ├── Odoo (XML-RPC)
│   │   └── account.move.line (periodo 01-31/03/2024)
│   │
│   └── Estratti Conto (JSON)
│       └── UBS-CHF, UBS-EUR, Credit Suisse
│
├── PROCESSING
│   ├── Matching Engine
│   │   ├── Data + Importo (exact match)
│   │   ├── Fuzzy match descrizioni
│   │   └── Tolleranza centesimi
│   │
│   └── Analytics
│       ├── Totali per konto
│       ├── Discrepanze
│       └── Movimenti critici
│
└── OUTPUT
    ├── JSON Report (machine-readable)
    ├── Markdown Summary (human-readable)
    └── TODO List (actionable)
```

---

## Best Practices

### 1. Verifica Mensile
Esegui questo script **ogni mese** dopo chiusura:
```bash
# Crea script per ogni mese
cp scripts/verifica-marzo-2024.py scripts/verifica-aprile-2024.py
# Modifica periodo in aprile-2024.py
```

### 2. Backup Report
Salva i report generati:
```bash
mkdir -p reports/2024/03
mv REPORT-MARZO-2024.* reports/2024/03/
```

### 3. Tracciamento Discrepanze
Crea issue GitHub per ogni discrepanza:
```bash
gh issue create --title "Discrepanza Konto 1024 - Marzo 2024" \
                --body "Vedere REPORT-MARZO-2024.json per dettagli"
```

### 4. Automazione
Aggiungi a cron per esecuzione automatica:
```bash
# Ogni 1° del mese verifica mese precedente
0 9 1 * * cd /path/to/app && ./run-verifica-prev-month.sh
```

---

## FAQ

**Q: Quanto tempo impiega la verifica?**
A: ~30 secondi per 594 movimenti (dipende da connessione Odoo)

**Q: Posso verificare piu mesi insieme?**
A: Si, modifica PERIODO_START e PERIODO_END nello script

**Q: Come esporto in Excel?**
A: Usa `jq` per convertire JSON -> CSV:
```bash
jq -r '.konti."1024".odoo_only_movements[] | [.date, .amount, .description] | @csv' \
   REPORT-MARZO-2024.json > konto-1024-discrepanze.csv
```

**Q: Supporta altre banche?**
A: Si, basta aggiungere parser PDF per quella banca e JSON nel formato richiesto

**Q: Cosa fare se match rate <90%?**
A: Indagare manualmente le discrepanze nel JSON. Potrebbero essere:
- Errori di data entry in Odoo
- Transazioni bancarie non registrate
- Parsing errato estratti PDF

---

## Supporto

### Documentazione
- [INDEX-VERIFICA-MARZO-2024.md](./INDEX-VERIFICA-MARZO-2024.md) - Indice completo
- [REPORT-MARZO-2024-EXECUTIVE-SUMMARY.md](./REPORT-MARZO-2024-EXECUTIVE-SUMMARY.md) - Report dettagliato
- [MARZO-2024-TODO.md](./MARZO-2024-TODO.md) - Azioni da fare

### Script
- `scripts/verifica-marzo-2024.py` - Script Python principale
- `run-verifica-marzo-2024.sh` - Wrapper Bash

### Contact
Per domande tecniche:
- Script Author: Backend Specialist Agent
- Environment: Windows 10, Python 3.13, Odoo XML-RPC

---

## License

Internal use only - Lapa CH 2024

---

**Fine README**
