# 🏦 Import Movimenti UBS - APP

## Descrizione

APP completa per importare automaticamente i movimenti bancari da CSV UBS in Odoo.

## Caratteristiche

- Upload file CSV direttamente da interfaccia web
- Parsing automatico formato UBS (tedesco)
- Anteprima movimenti prima dell'import
- Statistiche in tempo reale (entrate, uscite, saldo)
- Import diretto in Odoo account.bank.statement.line
- Supporto multi-valuta (CHF, EUR)
- Design responsive e moderno

## Come funziona

### 1. Esporta CSV da UBS

1. Login su **UBS e-banking**
2. Vai in **Accounts and Cards** → **Overview**
3. Seleziona conto **UBS CHF 701J**
4. Click su **Transactions**
5. Click icona **Excel/CSV**
6. Scarica il file

### 2. Usa l'APP

1. Apri l'APP **Import Movimenti UBS** dalla dashboard
2. Click su **"Click per selezionare il file CSV"**
3. Seleziona il file scaricato da UBS
4. Click **"Analizza File"**
5. Controlla l'anteprima movimenti
6. Click **"Importa in Odoo"**
7. Fatto! I movimenti sono registrati

## Struttura File

```
app/import-movimenti-ubs/
├── page.tsx                    # Interfaccia principale APP
├── README.md                   # Questa documentazione
└── api/
    ├── parse/
    │   └── route.ts           # API parsing CSV
    └── import/
        └── route.ts           # API import Odoo
```

## API Endpoints

### POST /api/import-ubs/parse

Parsea un file CSV UBS e ritorna i movimenti.

**Request:**
- Content-Type: multipart/form-data
- Body: file (CSV)

**Response:**
```json
{
  "success": true,
  "accountInfo": {
    "iban": "CH02 0027 8278 1220 8701 J",
    "startDate": "2025-11-10",
    "endDate": "2025-11-10",
    "startBalance": 107226.93,
    "endBalance": 135636.72,
    "currency": "CHF"
  },
  "transactions": [...],
  "stats": {
    "totalIncome": 28409.79,
    "totalExpense": 5566.30,
    "netChange": 22843.49
  }
}
```

### POST /api/import-ubs/import

Importa i movimenti in Odoo.

**Request:**
```json
{
  "accountInfo": {...},
  "transactions": [...]
}
```

**Response:**
```json
{
  "success": true,
  "total": 20,
  "imported": 20
}
```

## Configurazione Odoo

L'APP usa queste configurazioni per connettersi a Odoo:

```typescript
const ODOO_CONFIG = {
  url: 'lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-staging-2406-25408900',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
}

const UBS_CHF_JOURNAL_ID = 9  // Giornale UBS CHF 701J
```

## Formato CSV UBS

L'APP supporta il formato CSV esportato da UBS e-banking svizzera:

```csv
Kontonummer:;0278 00122087.01;
IBAN:;CH02 0027 8278 1220 8701 J;
Von:;2025-11-10;
Bis:;2025-11-10;
Anfangssaldo:;107226.93;
Schlusssaldo:;135636.72;
Bewertet in:;CHF;

Abschlussdatum;Buchungsdatum;Valutadatum;Währung;Belastung;Gutschrift;Saldo;...
2025-11-10;2025-11-10;2025-11-10;CHF;;24.62;141203.02;...
```

### Campi utilizzati:

- **Buchungsdatum / Valutadatum**: Data movimento
- **Belastung**: Uscite (negativo)
- **Gutschrift**: Entrate (positivo)
- **Saldo**: Saldo conto
- **Beschreibung 1/2/3**: Descrizione movimento
- **Transaktions-Nr.**: Numero transazione

## Tecnologie

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Odoo**: odoo-xmlrpc (connessione XML-RPC)
- **Icons**: Lucide React

## Testing

Per testare l'APP in locale:

```bash
npm install odoo-xmlrpc
npm run dev
```

Poi apri: http://localhost:3000/import-movimenti-ubs

## Deployment

L'APP è già integrata nella piattaforma AppHub e visibile nel menu Finance.

## Troubleshooting

### Errore "Header transazioni non trovato"
- Verifica che il file sia un export UBS valido
- Controlla che contenga le righe di header iniziali

### Errore importazione Odoo
- Verifica connessione a Odoo
- Controlla credenziali in `/api/import-ubs/import/route.ts`
- Verifica che il giornale UBS CHF (ID 9) esista

### File non viene letto
- Verifica encoding file (dovrebbe essere UTF-8)
- Controlla separatore (deve essere punto e virgola `;`)

## Prossimi sviluppi

- [ ] Supporto Credit Suisse
- [ ] Import multipli (batch)
- [ ] Riconciliazione automatica con fatture
- [ ] Storico import
- [ ] Export report import
- [ ] Notifiche email post-import

## Supporto

Per problemi o domande, contatta il team di sviluppo.

---

**Versione**: 1.0.0
**Data creazione**: 2025-11-11
**Autore**: Paul - LAPA SA
