# Scripts Odoo - Analisi Fornitori

Questo folder contiene script per l'analisi dei dati Odoo.

## analyze-supplier-cadence.ts

Analizza lo storico degli ordini di acquisto degli ultimi 6 mesi dal gestionale Odoo per calcolare le cadenze medie di ordine per fornitore.

### Prerequisiti

- Node.js installato
- File `.env.local` con le credenziali Odoo configurate
- Accesso all'istanza Odoo production

### Variabili Ambiente Richieste

```bash
ODOO_URL=https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com
ODOO_DB=lapadevadmin-lapa-v2-main-7268478
ODOO_ADMIN_EMAIL=apphubplatform@lapa.ch
ODOO_ADMIN_PASSWORD=apphubplatform2025
```

### Esecuzione

```bash
# Analizza ordini e genera JSON
npm run analyze:suppliers

# Query interattive sui dati
npm run query:suppliers -- [command] [options]
```

### Output

Lo script genera il file `data/supplier-cadence-analysis.json` contenente:

```json
{
  "analysis_date": "2025-10-29",
  "period": "6 months",
  "suppliers": [
    {
      "id": 1593,
      "name": "ALIGRO Demaurex & Cie SA",
      "total_orders": 60,
      "average_days_between_orders": 2.6,
      "most_frequent_days": ["Monday"],
      "average_lead_time_days": 0.4,
      "average_order_value": 726.3,
      "last_order_date": "2025-10-28"
    }
  ]
}
```

### Metriche Calcolate

Per ogni fornitore con almeno 3 ordini negli ultimi 6 mesi:

1. **total_orders**: Numero totale ordini nel periodo
2. **average_days_between_orders**: Cadenza media in giorni tra ordini consecutivi
3. **most_frequent_days**: Giorni della settimana piu frequenti per ordinare
4. **average_lead_time_days**: Lead time medio (differenza tra date_approve e date_planned)
5. **average_order_value**: Valore medio ordine in Euro
6. **last_order_date**: Data ultimo ordine effettuato

### Filtri Applicati

- Solo ordini con `state` in ['purchase', 'done']
- Solo ultimi 6 mesi dalla data esecuzione script
- Solo fornitori con almeno 3 ordini nel periodo
- Risultati ordinati per numero ordini decrescente

### Utilizzo dei Dati

I dati possono essere utilizzati per:

- Previsione cadenze ordini automatici
- Ottimizzazione calendario acquisti
- Analisi pattern ordinazione per fornitore
- Identificazione fornitori critici (alta frequenza)
- Pianificazione scorte basata su lead time

### Troubleshooting

**Errore Authentication failed**
- Verificare credenziali in `.env.local`
- Controllare connessione internet
- Verificare accesso all'istanza Odoo

**Nessun ordine trovato**
- Verificare che esistano purchase.order nel database
- Controllare filtri date (ultimi 6 mesi)
- Verificare permessi utente Odoo

**TypeError: Cannot read property**
- Verificare struttura dati Odoo
- Alcuni campi potrebbero essere null/undefined
- Lo script gestisce gracefully campi mancanti

### Estensioni Future

Possibili miglioramenti:

- Parametrizzare periodo analisi (default 6 mesi)
- Aggiungere analisi stagionalita
- Export in formato CSV/Excel
- Calcolo trend crescita/decrescita ordini
- Alert per fornitori con cadenza anomala
- Integrazione con sistema notifiche

---

## query-suppliers.ts

Tool di query interattivo per analizzare i dati di cadenza fornitori.

### Comandi Disponibili

```bash
# Statistiche generali
npm run query:suppliers -- stats

# Top N fornitori per numero ordini
npm run query:suppliers -- top 10

# Fornitori con cadenza <= N giorni
npm run query:suppliers -- frequent 4

# Filtra per lead time (fast/standard/slow)
npm run query:suppliers -- leadtime fast

# Fornitori con valore ordine >= N euro
npm run query:suppliers -- value 2000

# Fornitori che ordinano di Lunedi
npm run query:suppliers -- day Monday

# Cerca fornitore per nome
npm run query:suppliers -- search aligro
```

### Esempi di Output

**Stats**:
```
Total Suppliers: 53
Total Orders: 659
Average Order Value: €1642.04
Highest Value Supplier: DOLCIARIA MARIGLIANO SRL (€5740.52)
Most Frequent Supplier: ALIGRO Demaurex & Cie SA (2.6 days)
```

**Frequent 4**:
```
ALIGRO Demaurex & Cie SA
  Orders: 60, Cadence: 2.6 days
  Lead Time: 0.4 days, Avg Value: €726.30

LATTICINI MOLISANI TAMBURRO SRL
  Orders: 53, Cadence: 3 days
  Lead Time: 3.1 days, Avg Value: €2448.34
```

### Categorie Lead Time

- **fast**: 0-1.5 giorni (consegna immediata)
- **standard**: 1.5-5 giorni (pianificazione settimanale)
- **slow**: 5+ giorni (forecast mensile richiesto)

---

## Files Generati

- `data/supplier-cadence-analysis.json` - Dati analisi JSON
- `data/supplier-insights.md` - Report insights e raccomandazioni
- `scripts/README.md` - Documentazione script

---

### Contatti

Per domande o problemi contattare il team sviluppo Lapa.
