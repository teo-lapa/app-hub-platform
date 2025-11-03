# Analisi Prodotto - Esempi di Utilizzo

## Accesso alla Pagina
```
http://localhost:3000/analisi-prodotto
```

## Esempio 1: Analisi Prodotto "Pomodori" - Ultimi 3 Mesi

### Step 1: Cerca il Prodotto
1. Digita "pom" nel campo di ricerca
2. Attendi il dropdown con i suggerimenti
3. Seleziona "Pomodori Ciliegini Bio 500g"

### Step 2: Seleziona il Periodo
- Date già preimpostate (ultimi 3 mesi)
- Oppure modifica manualmente:
  - Data Inizio: 2024-08-01
  - Data Fine: 2024-11-01

### Step 3: Analizza
1. Clicca "Analizza"
2. Attendi il caricamento (2-10 secondi)
3. Visualizza la dashboard

### Risultati Attesi
```
KPI Cards:
- Quantità Venduta: 450 KG (media: 5 KG/giorno)
- Revenue Totale: CHF 2,475.00 (media: CHF 27.50/giorno)
- Clienti Serviti: 25 (Top: Ristorante Da Mario)
- Giorni Stock: 21 giorni (Status: ADEQUATE)

Vista Panoramica:
- Stock Corrente: 150 KG
- Giorni Copertura: 21 giorni
- Punto Riordino: 100 KG
- Qtà Suggerita: 150 KG

Top Clienti (5):
1. Ristorante Da Mario: 120 KG (CHF 660.00) - 5 ordini
2. Hotel Bellavista: 80 KG (CHF 440.00) - 3 ordini
3. Pizzeria Napoli: 65 KG (CHF 357.50) - 4 ordini
4. Trattoria del Lago: 55 KG (CHF 302.50) - 2 ordini
5. Mensa Aziendale: 50 KG (CHF 275.00) - 6 ordini

Timeline:
- Grafico a barre giornaliero
- Picchi nei giorni feriali
- Calo weekend
```

## Esempio 2: Prodotto con Stock Critico

### Scenario
Prodotto: "Mozzarella Bufala DOP 250g"
Periodo: Ultima settimana

### Risultati Attesi
```
KPI Cards:
- Quantità Venduta: 35 KG
- Revenue: CHF 577.50
- Clienti: 8
- Giorni Stock: 2 giorni (Status: CRITICAL 🔴)

Analisi Stock:
- Stock Corrente: 8 KG
- Giorni Copertura: 2 giorni ⚠️
- Punto Riordino: 25 KG
- Qtà Suggerita: 50 KG
- Status: AZIONE RICHIESTA! Ordinare 42 KG

Suggerimento:
"ATTENZIONE: Stock sufficiente per solo 2 giorni.
Considera di ordinare presto (lead time: 3 giorni)"
```

## Esempio 3: Prodotto Nuovo (Pochi Dati)

### Scenario
Prodotto: "Quinoa Bio 1KG"
Periodo: Ultimi 30 giorni

### Risultati Attesi
```
KPI Cards:
- Quantità Venduta: 5 KG
- Revenue: CHF 75.00
- Clienti: 2
- Giorni Stock: 90 giorni (Status: HIGH 🔵)

Timeline:
- Pochi ordini sparsi
- No pattern chiaro
- Suggerimento: Monitorare per più tempo

Top Clienti:
1. Bio Shop Verde: 3 KG (CHF 45.00) - 1 ordine
2. Salutare Sempre: 2 KG (CHF 30.00) - 1 ordine

Analisi:
"Prodotto con basso volume. Stock elevato rispetto alle vendite.
Considera di ridurre l'ordine successivo."
```

## Esempio 4: Export PDF

### Step by Step
1. Completa un'analisi (vedi Esempio 1)
2. Clicca "PDF" nell'header della dashboard
3. Il browser scarica automaticamente: `analisi-Pomodori_Ciliegini_Bio_500g-2024-11-03.pdf`

### Contenuto PDF
```
📄 Analisi Prodotto

Prodotto: Pomodori Ciliegini Bio 500g
Periodo: 01/08/2024 - 01/11/2024

RIEPILOGO VENDITE
- Quantità Totale: 450.0 KG
- Revenue Totale: CHF 2475.00
- Media Giornaliera: 5.0 KG/giorno

ANALISI STOCK
- Stock Corrente: 150.0 KG
- Giorni di Copertura: 21.0 giorni
- Punto Riordino: 100.0 KG
- Qtà Suggerita: 150 KG

TOP 5 CLIENTI
1. Ristorante Da Mario: 120.0 KG (CHF 660.00)
2. Hotel Bellavista: 80.0 KG (CHF 440.00)
3. Pizzeria Napoli: 65.0 KG (CHF 357.50)
4. Trattoria del Lago: 55.0 KG (CHF 302.50)
5. Mensa Aziendale: 50.0 KG (CHF 275.00)
```

## Esempio 5: Export Excel (CSV)

### Step by Step
1. Completa un'analisi
2. Clicca "Excel" nell'header
3. Download automatico: `analisi-Pomodori_Ciliegini_Bio_500g-2024-11-03.csv`

### Contenuto CSV (Preview)
```csv
Analisi Prodotto

Prodotto,Pomodori Ciliegini Bio 500g
Periodo,01/08/2024 - 01/11/2024

VENDITE
Quantità Totale,450.0 KG
Revenue Totale,CHF 2475.00
Media Giornaliera,5.0 KG/giorno

STOCK
Stock Corrente,150.0 KG
Giorni Copertura,21.0 giorni
Punto Riordino,100.0 KG

TOP CLIENTI
Nome,Quantità,Revenue,Ordini
Ristorante Da Mario,120.0,660.00,5
Hotel Bellavista,80.0,440.00,3
Pizzeria Napoli,65.0,357.50,4

TIMELINE VENDITE
Data,Quantità,Revenue,Ordini
01/08/2024,6.0,33.00,2
02/08/2024,4.5,24.75,1
03/08/2024,7.0,38.50,3
...
```

### Aprire in Excel
1. Apri il file .csv
2. Excel rileva automaticamente il formato
3. Applica formattazione:
   - Colonne auto-fit
   - Grassetto headers
   - Formato currency per Revenue
   - Filtri su tabelle

## Esempio 6: Comparazione Manuale tra Periodi

### Periodo 1: Agosto 2024
```
Quantità Venduta: 150 KG
Revenue: CHF 825.00
Clienti: 18
```

### Periodo 2: Settembre 2024
```
Quantità Venduta: 165 KG (+10%)
Revenue: CHF 907.50 (+10%)
Clienti: 20 (+11%)
```

### Periodo 3: Ottobre 2024
```
Quantità Venduta: 135 KG (-18%)
Revenue: CHF 742.50 (-18%)
Clienti: 17 (-15%)

⚠️ Trend negativo!
Possibile causa: Fine stagione estiva
Azione: Ridurre ordini per novembre
```

## Esempio 7: Errori Comuni e Soluzioni

### Errore: "Prodotto non trovato"
**Causa**: Nome prodotto errato o non esiste in Odoo
**Soluzione**:
1. Verifica spelling
2. Cerca per codice invece del nome
3. Verifica che il prodotto sia attivo in Odoo

### Errore: "dateTo deve essere >= dateFrom"
**Causa**: Date invertite
**Soluzione**:
1. Controlla date selezionate
2. Data Fine deve essere dopo Data Inizio

### Errore: "Nessun dato per il periodo"
**Causa**: Prodotto non venduto nel periodo
**Soluzione**:
1. Estendi il periodo (es. 6 mesi invece di 1)
2. Verifica che ci siano ordini in Odoo
3. Controlla stato ordini (devono essere 'sale' o 'done')

### Errore: "Timeout durante analisi"
**Causa**: Query Odoo troppo lenta
**Soluzione**:
1. Riduci il periodo (max 6 mesi consigliato)
2. Riprova più tardi
3. Contatta amministratore Odoo

## Esempio 8: Best Practices

### Frequenza Analisi Consigliata
```
Prodotti ad Alto Volume (>100 KG/mese):
- Analisi settimanale
- Focus su ultimi 30 giorni
- Monitor stock quotidiano

Prodotti a Medio Volume (20-100 KG/mese):
- Analisi quindicinale
- Focus su ultimi 60 giorni
- Monitor stock settimanale

Prodotti a Basso Volume (<20 KG/mese):
- Analisi mensile
- Focus su ultimi 90 giorni
- Monitor stock mensile
```

### Periodi Consigliati per Tipo Prodotto
```
Prodotti Stagionali (es. Fragole):
- Periodo: intera stagione (2-4 mesi)
- Confronta con stagione precedente

Prodotti Stabili (es. Pasta):
- Periodo: ultimi 90 giorni
- Trend costante

Prodotti Promozionali:
- Periodo: durata promozione + 1 settimana
- Confronta con periodo normale
```

## Esempio 9: Workflow Completo

### Scenario: Riordino Settimanale
```
Lunedì Mattina:
1. Analizza tutti i prodotti critici
2. Export CSV per ciascuno
3. Consolida in report Excel master
4. Identifica prodotti da ordinare

Lunedì Pomeriggio:
5. Crea ordini in Odoo
6. Invia ordini a fornitori
7. Salva PDF analisi per archivio

Mercoledì:
8. Verifica arrivi merce
9. Aggiorna stock in Odoo

Venerdì:
10. Review vendite settimana
11. Aggiusta prossimi ordini
```

## Esempio 10: Mobile Usage

### Su Tablet/Smartphone
```
1. Form si adatta a schermo stretto
2. Autocomplete full-width
3. Date picker touch-friendly
4. Dashboard stack verticalmente
5. Grafici scrollabili orizzontalmente
6. Export funziona normalmente

Tips Mobile:
- Usa landscape per timeline
- Zoom in/out sui grafici
- Share CSV via email/WhatsApp
```

## Supporto
Per problemi o domande:
- Controlla README.md
- Verifica connessione Odoo
- Consulta logs browser console
- Contatta team dev

---

**Last Updated**: 2024-11-03
**Version**: 1.0.0
