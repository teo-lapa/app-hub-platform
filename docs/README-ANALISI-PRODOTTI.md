# Script Analisi Prodotti Non Venduti

Questa directory contiene uno script per analizzare i prodotti Odoo e identificare quelli non venduti negli ultimi 6 mesi.

## File Principali

### 1. Script di Analisi
**`trova-prodotti-non-venduti-6-mesi.js`**

Script Node.js che si connette a Odoo e identifica tutti i prodotti attivi che non sono stati venduti negli ultimi 6 mesi.

**Caratteristiche**:
- Autenticazione automatica con Odoo
- Recupero ottimizzato in batch (500-1000 record per chiamata)
- Analisi di tutti i prodotti attivi vendibili
- Controllo vendite negli ultimi 6 mesi
- Recupero data ultima vendita per prodotti inattivi
- Export automatico in formato CSV
- Statistiche aggregate per categoria

**Utilizzo**:
```bash
node trova-prodotti-non-venduti-6-mesi.js
```

**Output**:
- Console log dettagliato con progress
- File CSV con lista completa prodotti non venduti
- Statistiche aggregate (categorie, valore stock, ecc.)

### 2. Report Analisi
**`ANALISI-PRODOTTI-NON-VENDUTI-REPORT.md`**

Report markdown completo con:
- Riepilogo esecutivo
- Statistiche dettagliate
- Raccomandazioni operative
- KPI da monitorare
- Prossimi passi

### 3. Export CSV
**`prodotti-non-venduti-6-mesi-YYYY-MM-DD.csv`**

File CSV con tutti i prodotti non venduti, contenente:
- Numero progressivo
- Codice prodotto
- Nome prodotto
- Categoria
- Prezzo (CHF)
- Giacenza attuale
- Data ultima vendita

## Configurazione

Le credenziali Odoo sono caricate dal file `.env.local`:

```env
ODOO_URL=https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com
ODOO_DB=lapadevadmin-lapa-v2-main-7268478
ODOO_ADMIN_EMAIL=apphubplatform@lapa.ch
ODOO_ADMIN_PASSWORD=apphubplatform2025
```

## Modelli Odoo Utilizzati

### product.product
Recupera tutti i prodotti attivi e vendibili:
- **Domain**: `[['active', '=', true], ['sale_ok', '=', true]]`
- **Fields**: id, name, default_code, barcode, list_price, qty_available, categ_id

### sale.order.line
Recupera tutte le righe ordine confermate negli ultimi 6 mesi:
- **Domain**: `[['create_date', '>=', dateFrom], ['state', 'in', ['sale', 'done']]]`
- **Fields**: product_id, product_uom_qty, create_date

## Logica di Analisi

1. **Autenticazione**: Connessione a Odoo con credenziali admin
2. **Recupero prodotti**: Batch di 500 prodotti attivi alla volta
3. **Recupero vendite**: Batch di 1000 righe ordine alla volta
4. **Identificazione non venduti**: Confronto set di prodotti attivi vs prodotti venduti
5. **Data ultima vendita**: Per i primi 50 prodotti, cerca la vendita piu recente (anche oltre 6 mesi)
6. **Export**: Generazione file CSV con tutti i dati

## Performance

- **Prodotti analizzati**: 3,147
- **Righe ordine processate**: 31,000+
- **Tempo esecuzione**: ~8 minuti
- **Chiamate API**: ~85 (ottimizzate in batch)
- **Output CSV**: ~160 KB

## Risultati Ultima Analisi (09/11/2025)

- **Totale prodotti attivi**: 3,147
- **Prodotti venduti ultimi 6 mesi**: 1,726 (54.85%)
- **Prodotti NON venduti ultimi 6 mesi**: 1,539 (48.90%)
- **Valore stock non venduto**: CHF 1,044,048.77

## Utilizzo Consigliato

### Frequenza Analisi
- **Mensile**: Esegui lo script per monitorare trend
- **Trimestrale**: Report completo con raccomandazioni
- **Ad-hoc**: Prima di revisioni assortimento o promozioni

### Workflow Suggerito
1. Esegui lo script: `node trova-prodotti-non-venduti-6-mesi.js`
2. Apri il CSV generato in Excel/Google Sheets
3. Filtra per categoria o giacenza
4. Identifica prodotti da rimuovere/promuovere
5. Condividi con team commerciale/acquisti
6. Implementa azioni correttive in Odoo

## Personalizzazione

### Modificare Periodo Analisi
Nel file `trova-prodotti-non-venduti-6-mesi.js`, modifica:
```javascript
// Cambia da 6 a N mesi
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
```

### Modificare Filtri Prodotti
```javascript
// Esempio: solo una categoria specifica
const products = await callOdoo(
  cookies,
  'product.product',
  'search_read',
  [
    [
      ['active', '=', true],
      ['sale_ok', '=', true],
      ['categ_id', 'ilike', 'Formaggi']  // Aggiungi filtro
    ]
  ],
  // ...
);
```

### Modificare Campi Export CSV
Nel file, cerca la sezione "Export CSV" e modifica `csvContent`:
```javascript
csvContent += `${index + 1},"${code}","${name}",...\n`;
```

## Troubleshooting

### Errore di Autenticazione
Verifica che le credenziali in `.env.local` siano corrette:
```bash
cat .env.local | grep ODOO
```

### Timeout / Errori di Rete
Aumenta il timeout o riduci il batch size:
```javascript
const limit = 250; // Invece di 500/1000
```

### Errori CSV Encoding
Il file e salvato in UTF-8. Se Excel non lo apre correttamente:
1. Apri Excel
2. Data > From Text/CSV
3. Seleziona il file
4. Encoding: UTF-8
5. Delimiter: Comma

## Estensioni Future

Possibili miglioramenti da implementare:

1. **Schedulazione automatica**: Cron job per esecuzione mensile
2. **Dashboard interattiva**: Visualizzazione web dei risultati
3. **Alert email**: Notifiche per prodotti critici
4. **Integrazione Slack**: Report automatici su canale team
5. **Analisi predittiva**: ML per prevedere prodotti a rischio
6. **Comparazione periodi**: Trend mese su mese

## Supporto

Per domande o problemi:
1. Controlla questo README
2. Consulta il report completo: `ANALISI-PRODOTTI-NON-VENDUTI-REPORT.md`
3. Verifica i log dello script
4. Controlla la connessione a Odoo

---

*Documentazione aggiornata: 9 Novembre 2025*
