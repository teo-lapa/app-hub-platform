# 🔍 DEBUG: Valida Fatture - Multi-lotto Issue

## Problema

Claude vede prodotti "mancanti" quando in realtà sono presenti ma con lotti diversi sommati in bozza.

## Dati Necessari

### 1. Console Log - Risposta API

Vai su DevTools → Network → trova chiamata `analyze-and-compare` → guarda Response

Copia qui il JSON completo (soprattutto `parsed_invoice.lines` e `draft_invoice.invoice_line_ids`)

### 2. PDF Fattura

Già disponibile: `C:\Users\lapa\Downloads\INV 650.pdf`

---

## Analisi Preliminare

### Prodotti che Claude dice "mancanti":

1. **CARCIOFI INTERI GRIGLIATI LATTA 4/4 - 750 G** (009014)
2. **POMODORI CILIEG ROSSI SEMISEC LATTA 4/4 - 750 G** (001507)
3. **POMOD. DATTERINI GIALLI IN ACQUA DI MARE - LATTA 4/4 - 800G** (001585)

### Ipotesi

Questi prodotti potrebbero essere:
- Nel PDF con 2+ lotti diversi
- In bozza Odoo con quantità totale sommata (1 sola riga)
- Claude non riconosce che deve sommare le quantità

---

## Fix Necessario

Modificare prompt Claude per:
1. **Aggregare righe PDF** con stesso `product_code` prima del confronto
2. **Sommare quantità** di lotti diversi
3. **Confrontare totali** invece di righe individuali
4. **Gestire differenze** di dettaglio lotto (bozza non ha lotti, PDF sì)

---

## Prossimi Step

1. ✅ Ottieni JSON completo da API response
2. ✅ Conferma ipotesi multi-lotto
3. ✅ Modifica logica aggregazione in `analyze-and-compare/route.ts`
4. ✅ Test con fattura reale
