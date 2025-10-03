# 🎯 Product Creator - AI-Powered Invoice Parser

Applicazione intelligente per la creazione automatica di prodotti in Odoo partendo da fatture PDF o immagini.

## 📋 Panoramica

Product Creator utilizza l'intelligenza artificiale (Claude AI e Gemini) per:
1. **Estrarre automaticamente** tutti i prodotti da una fattura (PDF o immagine)
2. **Arricchire** ogni prodotto con dati intelligenti e contesto Odoo
3. **Creare prodotti completi** in Odoo con un solo click

## 🚀 Funzionalità Principali

### 1. Parsing Fatture con AI
- ✅ Supporto PDF e immagini (JPG, PNG, WEBP)
- ✅ Estrazione automatica di tutti i prodotti
- ✅ Riconoscimento di: nome, codice, quantità, prezzi, unità di misura
- ✅ Identificazione fornitore e dati fattura

**Tecnologia**: Claude 3.5 Sonnet con supporto documenti

### 2. Enrichment Intelligente
- ✅ **Categorie intelligenti**: Assegnazione automatica a Frigo/Secco/Pingu/Non-Food
- ✅ **Unità di misura reali**: Cerca e usa le UoM esistenti in Odoo
- ✅ **Linking fornitori**: Trova e collega automaticamente il fornitore
- ✅ **Listini prezzi**: Crea automaticamente il listino fornitore per ogni prodotto
- ✅ **Codici SA**: Genera codici fiscali Sistema Armonizzato
- ✅ **Brand/Marca**: Identifica il brand quando possibile
- ✅ **Conversione unità**: Logica intelligente (es: compra a cartone, vende a pezzo)

**Tecnologia**: Claude AI con contesto Odoo real-time

### 3. Generazione Immagini Prodotto
- ✅ Genera foto professionali dei prodotti con AI
- ✅ Stile e-commerce: sfondo bianco, illuminazione professionale
- ✅ Upload automatico in Odoo

**Tecnologia**: Gemini 2.5 Flash Image

## 📊 Workflow

```
1. UPLOAD FATTURA
   ↓ (Claude Vision)
2. PARSING AUTOMATICO
   ↓
3. SELEZIONE PRODOTTI
   ↓ (Claude AI + Odoo Context)
4. ENRICHMENT INTELLIGENTE
   ↓
5. CREAZIONE IN ODOO
   ↓ (Gemini Image)
6. GENERAZIONE IMMAGINI
```

## 🔧 Struttura Tecnica

### API Endpoints

#### `/api/product-creator/parse-invoice`
Analizza una fattura PDF o immagine ed estrae tutti i prodotti.

**Input**:
- `file`: File (PDF, JPG, PNG, WEBP)

**Output**:
```json
{
  "success": true,
  "data": {
    "fornitore": "Nome Fornitore",
    "numero_fattura": "123/2024",
    "data_fattura": "2024-10-03",
    "prodotti": [
      {
        "nome": "PRODOTTO ESEMPIO",
        "codice": "ABC123",
        "quantita": 10,
        "prezzo_unitario": 5.50,
        "prezzo_totale": 55.00,
        "unita_misura": "PZ"
      }
    ]
  }
}
```

#### `/api/product-creator/enrich-product`
Arricchisce un singolo prodotto con dati intelligenti.

**Input**:
```json
{
  "product": { /* dati base prodotto */ },
  "invoiceData": { /* dati fattura */ }
}
```

**Output**:
```json
{
  "success": true,
  "data": {
    "nome_completo": "Nome completo professionale",
    "descrizione_breve": "Descrizione vendita",
    "descrizione_dettagliata": "Descrizione completa",
    "categoria_odoo_id": 42,
    "categoria_nome": "Secco / Pasta",
    "marca": "BrandName",
    "codice_ean": "ABC123",
    "prezzo_vendita_suggerito": 7.50,
    "uom_odoo_id": 1,
    "uom_nome": "Unità(i)",
    "peso": 0.5,
    "codice_sa": "1234567890",
    "fornitore_odoo_id": 123,
    "caratteristiche": ["caratteristica 1", "caratteristica 2"],
    "tags": ["tag1", "tag2"]
  }
}
```

#### `/api/product-creator/create-products`
Crea i prodotti in Odoo.

**Input**:
```json
{
  "products": [ /* array di prodotti arricchiti */ ]
}
```

**Output**:
```json
{
  "success": true,
  "summary": {
    "total": 10,
    "created": 9,
    "failed": 1
  },
  "results": [ /* dettagli creazione */ ],
  "errors": [ /* eventuali errori */ ]
}
```

#### `/api/product-creator/generate-image-gemini`
Genera immagine prodotto con Gemini AI.

**Input**:
```json
{
  "productName": "Nome prodotto",
  "productDescription": "Descrizione",
  "productId": 123
}
```

**Output**:
```json
{
  "success": true,
  "imageBase64": "...",
  "mimeType": "image/png",
  "uploaded": true
}
```

### API Helper Odoo

#### `/api/odoo/uom`
Recupera tutte le unità di misura da Odoo.

#### `/api/odoo/categories`
Recupera tutte le categorie prodotti da Odoo.

#### `/api/odoo/suppliers`
Cerca fornitori in Odoo per nome.

## 🎨 Frontend

### Pagine

1. **`/product-creator`**: Upload fattura
2. **`/product-creator/select-products`**: Selezione e enrichment prodotti

### Componenti Principali

- Upload drag & drop
- Preview prodotti con espansione
- Editing inline dati arricchiti
- Progress tracking con stati
- Toast notifications

## ⚙️ Configurazione

### Variabili d'Ambiente

```env
# API Keys
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIzaSy...

# Odoo
ODOO_URL=https://your-odoo.com
ODOO_DB=your-database
```

### Dipendenze

```json
{
  "@anthropic-ai/sdk": "^0.x",
  "@google/generative-ai": "^0.x",
  "framer-motion": "^11.x",
  "react-hot-toast": "^2.x"
}
```

## 🔒 Sicurezza

- ✅ Tutte le API keys sono server-side
- ✅ Authentication Odoo gestita lato server
- ✅ Validazione input su tutti gli endpoint
- ✅ Error handling robusto e non-bloccante

## 🐛 Gestione Errori

Il sistema è progettato per essere **NON bloccante**:

- ❌ Categoria non trovata → usa default (ID: 1)
- ❌ UoM non trovata → usa default Odoo
- ❌ Fornitore non trovato → crea prodotto senza fornitore
- ❌ Immagine fallita → crea prodotto senza immagine
- ❌ Barcode duplicato → salta prodotto ma continua con gli altri

**Principio**: Meglio creare un prodotto parziale che non crearlo affatto.

## 📈 Performance

- ⚡ Parsing fattura: ~5-10s
- ⚡ Enrichment prodotto: ~3-5s per prodotto
- ⚡ Creazione Odoo: ~1-2s per prodotto
- ⚡ Generazione immagine: ~5-10s per prodotto

**Ottimizzazioni**:
- Fetch Odoo data in parallelo (UoM, Categorie, Fornitori)
- Enrichment sequenziale per evitare rate limits
- Creazione prodotti sequenziale per gestire errori

## 🎯 Categorie Principali Supportate

1. **FRIGO** 🧊
   - Prodotti refrigerati
   - Salumi, latticini, freschi

2. **SECCO** 📦
   - Prodotti a temperatura ambiente
   - Pasta, scatole, bottiglie

3. **PINGU** ❄️
   - Prodotti surgelati/congelati

4. **NON-FOOD** 🧹
   - Prodotti non alimentari
   - Pulizia, carta, plastica

## 📝 Note Tecniche

### Sistema Categorie

Le categorie vengono selezionate in due step:
1. **Step 1**: Claude sceglie categoria MADRE (Frigo/Secco/Pingu/Non-Food)
2. **Step 2**: Se disponibile, cerca sottocategoria più specifica

### Unità di Misura

Il sistema gestisce la conversione intelligente:
- Compra a **cartone** → vende a **pezzo** → usa UoM "Unità(i)"
- Prodotti liquidi → usa "Litri", "cl", "ml"
- Prodotti pesati → usa "kg", "g"

### Listini Fornitori

Per ogni prodotto creato, il sistema:
1. Cerca il fornitore in Odoo
2. Crea record `product.supplierinfo` con prezzo d'acquisto
3. Collega al prodotto

## 🚀 Future Improvements

- [ ] Batch enrichment parallelo
- [ ] Cache delle categorie Odoo
- [ ] Support multi-fornitore per prodotto
- [ ] Import storico prezzi
- [ ] Gestione varianti prodotto
- [ ] OCR migliorato per fatture poco leggibili

## 👨‍💻 Sviluppato con

- **Next.js 14** (App Router)
- **React 18** + TypeScript
- **Anthropic Claude AI** (parsing & enrichment)
- **Google Gemini AI** (image generation)
- **Odoo ERP** (product management)
- **Framer Motion** (animations)
- **Tailwind CSS** (styling)

---

**Versione**: 1.0.0
**Ultimo aggiornamento**: Ottobre 2025
**Autore**: AI-Assisted Development
