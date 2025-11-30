# 🔄 Resi Furgoni - Gestione Resi Massivi

**Data creazione:** 12 ottobre 2025

## 🎯 Descrizione

Sistema per gestione resi massivi dai furgoni. Consente di rendere velocemente tutti i prodotti rimasti nei furgoni, tracciando documento di origine, cliente e autista, e riportandoli automaticamente nelle ubicazioni buffer (Secco, Secco Sopra, Frigo, Pingu).

## ⚡ Funzionalità Principali

### 📦 Selezione Furgone
- **Ricerca automatica** furgoni con merce (ubicazioni WH/Stock/FURGONI/*)
- **Conteggio prodotti** per ogni furgone
- **Visualizzazione dettagli** ubicazione completa

### 🔄 Gestione Resi Massivi
- **Lista prodotti** presenti nel furgone con immagini
- **Modifica quantità** da rendere (da 0 al massimo disponibile)
- **Selezione zona buffer** per ogni prodotto (Secco, Secco Sopra, Frigo, Pingu)
- **Assegnazione automatica** zona buffer intelligente basata su nome prodotto
- **Dettagli tracciabilità** lotto, documento, cliente, autista

### 📊 Informazioni Tracciate
- **Documento origine** (picking name)
- **Cliente** da cui proviene il reso
- **Autista** del furgone
- **Lotto prodotto** se presente
- **Data scadenza** se disponibile

### ✅ Conferma Resi
- **Creazione automatica** stock.picking (Internal Transfer)
- **Raggruppamento per zona** buffer (un picking per zona)
- **Stock.move** per ogni prodotto
- **Conferma e validazione** automatica dei transfer
- **Note dettagliate** con origine e timestamp

## 🛠️ Tecnologie

- **Next.js 14** con App Router
- **React 18** + TypeScript
- **Framer Motion** per animazioni
- **Tailwind CSS** styling
- **Odoo 17** integrazione completa

## 🔌 Integrazione Odoo

### Modelli Utilizzati:
- **stock.location** - Ubicazioni furgoni e buffer
- **stock.quant** - Quantità prodotti nei furgoni
- **stock.picking** - Documenti di trasferimento resi
- **stock.move** - Movimenti magazzino per ogni prodotto
- **product.product** - Dettagli prodotti
- **stock.lot** - Lotti e scadenze

### Zone Buffer Supportate:
1. **Secco** (WH/Stock/Buffer/Secco) - Prodotti secchi standard
2. **Secco Sopra** (WH/Stock/Buffer/Secco Sopra) - Prodotti secchi alto scaffale
3. **Frigo** (WH/Stock/Buffer/Frigo) - Prodotti freschi
4. **Pingu** (WH/Stock/Buffer/Pingu) - Surgelati

## 📋 Workflow

1. **Selezione Furgone** - L'operatore seleziona il furgone da cui fare i resi
2. **Revisione Prodotti** - Sistema carica automaticamente tutti i prodotti presenti
3. **Modifica Quantità** - Operatore modifica le quantità da rendere (default: tutto)
4. **Assegnazione Zone** - Sistema suggerisce zone buffer, operatore può modificare
5. **Conferma** - Sistema crea i transfer automaticamente raggruppati per zona
6. **Validazione** - Transfer confermati e validati automaticamente in Odoo

## 🎨 UI/UX Features

- **Interfaccia mobile-first** ottimizzata per tablet magazzino
- **Animazioni fluide** con Framer Motion
- **Feedback visivi** toast notifications
- **Loading states** durante operazioni Odoo
- **Dettagli espandibili** per vedere info complete prodotto
- **Controlli + / -** per modificare quantità velocemente
- **Pulsanti colorati** per zone buffer (visibilità immediata)

## 🚀 URL e Routing

- **URL Principale:** `/resi-furgoni`
- **API Furgoni:** `/api/inventory/search-furgoni-locations` (GET)
- **API Creazione Resi:** `/api/inventory/create-van-returns` (POST)

## 📱 Esempio Request API

### GET /api/inventory/search-furgoni-locations

**Response:**
```json
{
  "success": true,
  "locations": [
    {
      "id": 123,
      "name": "FURGONE_01",
      "complete_name": "WH/Stock/FURGONI/FURGONE_01",
      "productCount": 15,
      "products": [
        {
          "productId": 456,
          "productName": "Pasta Barilla 500g",
          "productCode": "PAST001",
          "quantity": 10,
          "uom": "PZ",
          "image": "data:image/png;base64,...",
          "lotName": "LOT2025001",
          "expiryDate": "2025-12-31"
        }
      ]
    }
  ]
}
```

### POST /api/inventory/create-van-returns

**Request Body:**
```json
{
  "vanLocationId": 123,
  "vanLocationName": "FURGONE_01",
  "returns": [
    {
      "productId": 456,
      "productName": "Pasta Barilla 500g",
      "quantityToReturn": 10,
      "bufferZone": "secco",
      "lotName": "LOT2025001",
      "customerName": "Cliente XYZ",
      "pickingName": "WH/OUT/00123",
      "driverName": "Mario Rossi"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "transfers": [
    {
      "pickingId": 789,
      "zone": "secco",
      "productsCount": 10,
      "movesCreated": 10
    }
  ],
  "message": "1 resi creati con successo"
}
```

## 🔒 Sicurezza

- **Autenticazione richiesta** via JWT
- **Ruolo minimo:** cliente_gratuito (FREE app)
- **API Key Odoo** protetta in variabili ambiente
- **Validazione input** lato server
- **Error handling** completo

## 🌟 Vantaggi

✅ **Velocità** - Resi massivi in pochi click invece di uno per uno
✅ **Tracciabilità** - Mantiene info cliente, autista, documento origine
✅ **Organizzazione** - Prodotti vanno automaticamente nelle zone corrette
✅ **Precisione** - Assegnazione automatica zone buffer intelligente
✅ **Semplicità** - Interfaccia intuitiva senza training necessario

## 📊 KPI Tracciabili

- Numero resi per furgone
- Tempo medio per completare un reso
- Prodotti più resi (pattern analisi)
- Zone buffer più utilizzate
- Operatore più veloce

## 🔧 Configurazione

### Variabili Ambiente (.env):
```bash
ODOO_URL=https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com
ODOO_DB=lapadevadmin-lapa-v2-main-7268478
ODOO_API_KEY=your-api-key
```

### Prerequisiti Odoo:
- Ubicazione **WH/Stock/FURGONI/** con sottubicazioni furgoni
- Ubicazione **WH/Stock/Buffer/** con zone (Secco, Secco Sopra, Frigo, Pingu)
- Tipo picking **Internal Transfer** configurato
- Permessi utente per stock.picking, stock.move, stock.location

## 📈 Evoluzioni Future

- [ ] Scanner QR Code per identificare furgone velocemente
- [ ] Export report resi in PDF
- [ ] Analisi pattern resi per cliente
- [ ] Notifiche automatiche a ufficio acquisti
- [ ] Integrazione con sistema qualità (prodotti danneggiati)
- [ ] Dashboard analytics resi
- [ ] Sistema foto danni prodotti
- [ ] Note operative per ogni reso

---

**Creato:** 2025-10-12
**Versione:** 1.0.0
**Categoria:** Logistica
**Badge:** FREE
**Status:** ✅ Approved
