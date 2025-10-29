# Analisi Cadenze Fornitori - Insights e Raccomandazioni

**Data Analisi**: 2025-10-29
**Periodo Analizzato**: Ultimi 6 mesi (Aprile 2025 - Ottobre 2025)
**Ordini Totali**: 714 purchase orders
**Fornitori Attivi**: 53 (con almeno 3 ordini)

---

## Executive Summary

L'analisi ha identificato 53 fornitori attivi con pattern di ordine regolari negli ultimi 6 mesi, per un totale di 659 ordini analizzati. Il valore medio ordine e di 1.642 Euro, con una cadenza media variabile da 2.6 giorni (ALIGRO) a oltre 40 giorni per fornitori occasionali.

---

## Top 10 Fornitori Critici (Alta Frequenza)

### 1. ALIGRO Demaurex & Cie SA
- **Ordini**: 60 (1 ogni 2.6 giorni)
- **Lead Time**: 0.4 giorni (consegna quasi immediata)
- **Giorno Preferito**: Monday
- **Valore Medio**: 726.30 €
- **CRITICITA**: ALTA - Fornitore quotidiano essenziale

**Raccomandazioni**:
- Implementare ordine automatico ogni Lunedi/Mercoledi/Venerdi
- Mantenere buffer minimo per gestire imprevisti weekend
- Considerare contratto quadro con condizioni preferenziali

---

### 2. LATTICINI MOLISANI TAMBURRO SRL
- **Ordini**: 53 (1 ogni 3 giorni)
- **Lead Time**: 3.1 giorni
- **Giorno Preferito**: Monday
- **Valore Medio**: 2.448.34 € (ALTO)
- **CRITICITA**: ALTA - Fornitore ad alto valore

**Raccomandazioni**:
- Pianificare ordini ogni Lunedi per consegna Giovedi
- Monitorare livelli scorta latticini critici
- Il lead time di 3 giorni richiede planning anticipato
- Considerare ordini automatici basati su forecast vendite

---

### 3. Macelleria FULVI
- **Ordini**: 48 (1 ogni 3.4 giorni)
- **Lead Time**: 0.9 giorni (molto veloce)
- **Giorno Preferito**: Tuesday
- **Valore Medio**: 81.06 € (ordini piccoli frequenti)
- **Pattern**: Ordini freschi a basso valore

**Raccomandazioni**:
- Ordini giornalieri per prodotti freschissimi
- Automatizzare ordine standard settimanale
- Valutare se consolidare con altri fornitori carne

---

### 4. Meyerhans Muhlen AG
- **Ordini**: 38 (1 ogni 4.4 giorni)
- **Lead Time**: 2.6 giorni
- **Giorno Preferito**: Monday
- **Valore Medio**: 2.570.52 € (MOLTO ALTO)
- **CRITICITA**: MEDIA-ALTA - Fornitore strategico farine

**Raccomandazioni**:
- Ordini bisettimanali (Lunedi) per consegna meta settimana
- Stock safety per coprire lead time 3 giorni
- Monitorare consumo farine per previsioni accurate

---

## Pattern Identificati

### Per Giorno Settimana

**MONDAY** (Lunedi) - Giorno piu frequente per ordinare:
- ALIGRO Demaurex & Cie SA
- LATTICINI MOLISANI TAMBURRO SRL
- Meyerhans Muhlen AG
- PRODEGA MARKT TRANSGOURMET
- Polo SpA
- GIFFONIELLO S.R.L.

**Motivo**: Pianificazione settimanale, riordino dopo weekend

**TUESDAY** (Martedi):
- Macelleria FULVI
- PASTIFICIO MARCELLO

**Motivo**: Prodotti freschi per meta settimana

**FRIDAY** (Venerdi):
- SORI' ITALIA S.R.L.

**Motivo**: Rifornimento pre-weekend

---

## Classificazione per Lead Time

### IMMEDIATI (0-1 giorni)
- ALIGRO: 0.4 giorni
- Macelleria FULVI: 0.9 giorni
- PRODEGA MARKT: 1.5 giorni

**Raccomandazione**: Ideali per ordini just-in-time

### STANDARD (2-4 giorni)
- LATTICINI MOLISANI: 3.1 giorni
- Meyerhans Muhlen: 2.6 giorni
- PASTIFICIO MARCELLO: 2.3 giorni
- Polo SpA: 3.3 giorni
- SORI' ITALIA: 3.8 giorni
- jirrolle: 3.6 giorni
- GIFFONIELLO: 3.8 giorni

**Raccomandazione**: Richiedono pianificazione settimanale

### LUNGHI (5+ giorni)
- FREDDITALIA INTERNATIONAL SPA: 22 giorni (!)

**Raccomandazione**: Richiedono forecast mensile e buffer stock elevato

---

## Opportunita di Ottimizzazione

### 1. Consolidamento Ordini Lunedi
Molti fornitori hanno pattern Monday. Possibile:
- Creare "Monday Ordering Routine" automatizzata
- Batch processing ordini per efficienza
- Single point of contact per controllo

### 2. Automazione Ordini Ricorrenti
Candidati ideali per Smart Ordering:
- ALIGRO (ogni 2-3 giorni)
- LATTICINI MOLISANI (ogni 3 giorni)
- Macelleria FULVI (ogni 3-4 giorni)

**ROI Stimato**:
- Risparmio tempo: ~2 ore/settimana
- Riduzione out-of-stock: -30%
- Miglior cash flow: ordini just-in-time

### 3. Alert Proattivi
Implementare notifiche per:
- Fornitori con cadenza <4 giorni senza ordine
- Lead time in scadenza per ordini pianificati
- Pattern anomali (es. ordine saltato)

---

## Rischi Identificati

### RISCHIO ALTO: Dipendenza ALIGRO
- 60 ordini in 6 mesi (troppo frequente)
- Lead time cortissimo (dipendenza logistica)
- Possibile single point of failure

**Mitigazione**: Identificare fornitore backup

### RISCHIO MEDIO: Lead Time FREDDITALIA
- 22 giorni lead time (vulnerabile a imprevisti)
- Richiede stock buffer elevato
- Costi di magazzino aumentati

**Mitigazione**: Aumentare frequenza ordini o cercare alternativa

---

## KPI da Monitorare

1. **On-Time Delivery Rate** per fornitore
2. **Varianza Lead Time** (attuale vs storico)
3. **Fill Rate** (ordini completi vs parziali)
4. **Costo per ordine** (considerando valore + logistica)
5. **Stock Days** (giorni copertura magazzino)

---

## Next Steps

### Breve Termine (1 mese)
1. Implementare ordini automatici per top 3 fornitori
2. Setup alert cadenza per fornitori critici
3. Creare dashboard monitoraggio KPI fornitori

### Medio Termine (3 mesi)
1. Negoziare contratti quadro con top 5 fornitori
2. Ottimizzare stock levels basato su lead time reali
3. Implementare forecast automatico consumi

### Lungo Termine (6 mesi)
1. Sistema predittivo ordini basato su ML
2. Integrazione completa Odoo <-> Inventory Management
3. Ottimizzazione supply chain end-to-end

---

## Contatti

Per domande su questa analisi: team.development@lapa.ch
