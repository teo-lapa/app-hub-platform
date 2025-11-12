# 🏦 UBS Banking Import per Odoo

Sistema automatico per importare movimenti bancari da CSV UBS in Odoo.

## 📋 Indice

- [Caratteristiche](#caratteristiche)
- [Requisiti](#requisiti)
- [Installazione](#installazione)
- [Configurazione](#configurazione)
- [Utilizzo](#utilizzo)
- [Struttura File CSV UBS](#struttura-file-csv-ubs)
- [Risoluzione Problemi](#risoluzione-problemi)

## ✨ Caratteristiche

- ✅ **Import automatico** movimenti bancari da CSV UBS
- ✅ **Connessione diretta** a Odoo via XML-RPC
- ✅ **Modalità dry-run** per simulare import senza salvare
- ✅ **Rilevamento automatico** encoding file (UTF-8, Windows-1252, ecc.)
- ✅ **Parsing intelligente** formato CSV UBS (tedesco/italiano/francese)
- ✅ **Conversione automatica** date e importi dal formato svizzero
- ✅ **Supporto multi-valuta** (CHF, EUR, ecc.)
- ✅ **Logging dettagliato** con statistiche import
- ✅ **Test suite completa** per verificare connessione e struttura

## 📦 Requisiti

- Python 3.8+
- Accesso a Odoo (staging o produzione)
- File CSV esportato da UBS e-banking

## 🚀 Installazione

### 1. Clona o crea la cartella del progetto

```bash
cd "C:\Users\lapa\OneDrive\Desktop\Claude Code\odoo_ubs_banking"
```

### 2. Installa dipendenze Python

```bash
pip install -r requirements.txt
```

Le dipendenze sono:
- `xmlrpc` - Comunicazione con Odoo
- `pandas` - Elaborazione dati (opzionale)
- `chardet` - Rilevamento encoding file

## ⚙️ Configurazione

### 1. Configura credenziali Odoo

Modifica [config.py](config.py):

```python
# Credenziali Odoo
ODOO_URL = "https://tuo-odoo.com"
ODOO_DB = "nome-database"
ODOO_USERNAME = "tuo@email.com"
ODOO_PASSWORD = "tua-password"

# Giornale bancario UBS predefinito
DEFAULT_JOURNAL_ID = 9  # ID giornale UBS CHF
```

### 2. Verifica giornali bancari

I giornali UBS sono preconfigurati in `config.py`:

```python
GIORNALI_UBS = {
    "UBS_CHF": {
        "id": 9,
        "nome": "UBS CHF 701J",
        "iban": "CH02 0027 8278 1220 8701 J"
    },
    "UBS_EUR": {
        "id": 11,
        "nome": "UBS EUR 08760A",
        "iban": "CH25 0027 8278 1220 8760 A"
    }
}
```

## 📖 Utilizzo

### Test Connessione

Prima di importare, verifica che tutto funzioni:

```bash
python test_connection.py
```

Questo eseguirà 5 test:
1. ✅ Connessione a Odoo
2. ✅ Recupero giornali bancari
3. ✅ Verifica giornali UBS configurati
4. ✅ Lettura movimenti recenti
5. ✅ Struttura campi disponibili

**Output atteso:**
```
🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪
TEST COMPLETO INTEGRAZIONE ODOO + UBS BANKING
🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪

======================================================================
TEST 1: CONNESSIONE ODOO
======================================================================
✅ Connessione riuscita!
   URL: https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
   DB: lapadevadmin-lapa-v2-staging-2406-25408900
   User: paul@lapa.ch
   UID: 2
...
```

### Import CSV UBS

#### Modalità Simulazione (consigliata prima volta)

```bash
python ubs_csv_importer.py movimenti_ubs_2024.csv
```

Questo:
- ✅ Parsea il file CSV
- ✅ Mostra anteprima movimenti
- ✅ Visualizza statistiche
- ❌ **NON salva** nulla in Odoo

**Output esempio:**
```
🔍 SIMULAZIONE MOVIMENTI BANCARI UBS
======================================================================

📄 Parsing file: movimenti_ubs_2024.csv

📋 Info Account:
   IBAN: CH02 0027 8278 1220 8701 J
   Valuta: CHF

📊 Trovate 125 transazioni

──────────────────────────────────────────────────────────────────────
📗 2024-11-07 | CHF    4987.21 | Covabaga GmbH;Kirchgasse 32...
📕 2024-11-06 | CHF   -1250.00 | Fornitore SA;Pagamento fattura...
📗 2024-11-05 | CHF    8500.00 | Cliente Inc;Bonifico ricevuto...
...

──────────────────────────────────────────────────────────────────────

📈 RIEPILOGO:
   Totale righe: 125
   Importate: 125
   Errori: 0

⚠️  MODALITÀ SIMULAZIONE - Nessun dato salvato in Odoo
   Esegui con --save per salvare realmente
```

#### Import Reale (salva in Odoo)

**⚠️ ATTENZIONE: Questo salverà i dati in Odoo!**

```bash
python ubs_csv_importer.py movimenti_ubs_2024.csv --save
```

Questo:
- ✅ Parsea il file CSV
- ✅ Crea i movimenti in Odoo
- ✅ Mostra ID creati
- ✅ Salva statistiche

### Import Programmatico

Puoi usare le classi Python nei tuoi script:

```python
from ubs_csv_importer import import_ubs_csv

# Import con simulazione
stats = import_ubs_csv('movimenti.csv', dry_run=True)
print(f"Movimenti trovati: {stats['total_lines']}")

# Import reale
stats = import_ubs_csv('movimenti.csv', dry_run=False)
print(f"Movimenti importati: {stats['imported']}")
```

### Specificare Giornale Diverso

```python
from ubs_csv_importer import import_ubs_csv

# Usa giornale UBS EUR invece di CHF
stats = import_ubs_csv(
    'movimenti_eur.csv',
    journal_id=11,  # UBS EUR
    dry_run=False
)
```

## 📄 Struttura File CSV UBS

### Come esportare CSV da UBS e-banking

1. Login a **UBS e-banking**
2. Vai a **Accounts and Cards** → **Overview**
3. Seleziona il conto UBS desiderato
4. Click su **Transactions**
5. Click sull'icona **Excel/CSV** (download)
6. Seleziona il periodo desiderato
7. Scarica il file CSV

### Formato CSV UBS atteso

Il CSV UBS ha questa struttura:

```csv
Bewertungsdatum;Bankbeziehung;Portfolio;Produkt;IBAN;Whrg.
31.12.2024;12345678;Portfolio Standard;Privatkonto;CH02 0027 8278 1220 8701 J;CHF

Datum von;Datum bis;Beschreibung;Abschlussdatum;Buchungsdatum;Valuta;Beschreibung 1;Beschreibung 2;Beschreibung 3;Transaktions-Nr.;Devisenkurs;Einzelbetrag;Belastung;Gutschrift;Saldo
01.01.2024;31.12.2024;Überweisung;;15.01.2024;15.01.2024;"Zahlung Rechnung";"Max Mustermann";"Ref: INV-001";TRX001;;500,00;;500,00;10'500,00
```

### Campi utilizzati

| Campo CSV | Uso | Note |
|-----------|-----|------|
| `Buchungsdatum` | Data movimento | Formato DD.MM.YYYY |
| `Valuta` | Data valuta | Usata se disponibile |
| `Beschreibung 1/2/3` | Descrizione movimento | Concatenate |
| `Belastung` | Addebito (uscita) | Con segno - |
| `Gutschrift` | Accredito (entrata) | Positivo |
| `Saldo` | Saldo conto | Per verifica |
| `Transaktions-Nr.` | Riferimento | Opzionale |

### Formati supportati

- **Date:** `DD.MM.YYYY` (es. `31.12.2024`)
- **Importi:** `1'234,56` o `1'234.56` (virgola o punto decimale)
- **Separatore:** Punto e virgola (`;`)
- **Encoding:** UTF-8, Windows-1252 (rilevato automaticamente)
- **Lingue:** Tedesco, Italiano, Francese, Inglese

## 🔧 Risoluzione Problemi

### Errore: "Autenticazione fallita"

```
❌ Autenticazione fallita!
```

**Soluzione:**
- Verifica credenziali in `config.py`
- Verifica che l'URL Odoo sia corretto
- Verifica che l'utente abbia permessi contabili

### Errore: "Header transazioni non trovato nel CSV"

```
❌ Header transazioni non trovato nel CSV
```

**Soluzione:**
- Verifica che il file sia un export UBS valido
- Controlla che il file contenga almeno le colonne: `Buchungsdatum`, `Valuta`, `Belastung`, `Gutschrift`
- Prova a riesportare il CSV da UBS

### Errore: "Campo obbligatorio mancante: date"

```
ValueError: Campo obbligatorio mancante: date
```

**Soluzione:**
- Il CSV non contiene date valide
- Verifica formato date (deve essere DD.MM.YYYY)
- Controlla che le righe non siano vuote

### Warning: "Errore parsing riga"

```
⚠️  Errore parsing riga: could not convert string to float
```

**Soluzione:**
- Alcune righe hanno formato importi non valido
- Verifica separatori decimali (, o .)
- Controlla caratteri strani negli importi

### Movimenti duplicati

Se importi lo stesso CSV due volte, creerai movimenti duplicati.

**Soluzione:**
- Prima di importare, verifica che i movimenti non esistano già
- Usa la modalità dry-run per anteprima
- Filtra per data/periodo prima di import

### Riconciliazione automatica

I movimenti importati **NON** vengono riconciliati automaticamente con fatture/pagamenti.

**Soluzione:**
- Dopo import, vai in Odoo → Contabilità → Riconciliazione
- Odoo proporrà automaticamente riconciliazioni suggerite
- Oppure implementa logica riconciliazione nello script

## 📚 Struttura Progetto

```
odoo_ubs_banking/
├── README.md                 # Questa documentazione
├── requirements.txt          # Dipendenze Python
├── config.py                 # Configurazione Odoo e giornali
├── odoo_connector.py         # Classe connessione Odoo XML-RPC
├── ubs_csv_importer.py       # Importatore CSV UBS → Odoo
└── test_connection.py        # Test suite verifica sistema
```

## 🎯 Prossimi Passi

1. **Integra in APP Odoo custom**
   - Crea modulo Odoo con interfaccia upload CSV
   - Aggiungi wizard import in UI contabilità

2. **Automatizza import periodico**
   - Scheduler che importa CSV da cartella condivisa
   - Email notifica completamento import

3. **Riconciliazione automatica**
   - Match automatico con fatture per riferimento
   - AI/ML per suggerire riconciliazioni

4. **Multi-banca**
   - Supporta anche PostFinance, Raiffeisen, ecc.
   - Parser universale CSV bancari svizzeri

5. **Report e statistiche**
   - Dashboard movimenti importati
   - Analisi cash flow da movimenti bancari

## 📞 Supporto

Per problemi o domande:
- Verifica [Risoluzione Problemi](#risoluzione-problemi)
- Esegui `python test_connection.py` per diagnostica
- Controlla log Odoo per errori lato server

## 📝 Note Tecniche

### Campi Odoo utilizzati

I movimenti vengono creati sul modello `account.bank.statement.line`:

- `date` (obbligatorio) - Data movimento
- `journal_id` (obbligatorio) - Giornale bancario UBS
- `payment_ref` - Descrizione movimento
- `amount` - Importo (positivo=entrata, negativo=uscita)
- `partner_name` - Nome cliente/fornitore
- `ref` - Riferimento transazione
- `move_id` - Registrazione contabile (creata automaticamente da Odoo)

### Permessi richiesti

L'utente Odoo deve avere:
- Accesso modulo Contabilità
- Permessi lettura/scrittura su `account.bank.statement.line`
- Accesso ai giornali bancari configurati

### Performance

- Import 100 movimenti: ~30 secondi
- Import 1000 movimenti: ~5 minuti
- Limitazione: XML-RPC (1 chiamata per movimento)

**Ottimizzazione futura:**
- Batch create (10+ movimenti per chiamata)
- Import asincrono in background

---

**Versione:** 1.0.0
**Data:** 2025-11-11
**Autore:** Claude Code AI Agent
