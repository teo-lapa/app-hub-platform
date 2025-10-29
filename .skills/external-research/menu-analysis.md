---
name: menu-analysis
version: 1.1.0
description: Analizza menu ristoranti da PDF o immagini per estrarre piatti, prezzi e ingredienti
category: external-research
tags: [menu, restaurant, vision, pdf, pricing, ingredients]
model: claude-sonnet-4-5-20250929
author: Lapa Team
created: 2025-01-24
updated: 2025-10-29
---

# Menu Analysis Skill

## Contesto

Stai analizzando **menu di ristoranti** (PDF, immagini, foto) per estrarre informazioni strutturate su piatti, prezzi, ingredienti e categorie.

L'obiettivo è creare un database dettagliato dei menu per:
- Analisi competitiva prezzi
- Confronto offerta gastronomica
- Identificazione trend culinari
- Analisi ingredienti e allergeni

**IMPORTANTE**: I menu possono essere in lingue diverse, formati vari (carta, digitale, lavagna), e qualità immagine variabile.

---

## Regole Critiche

### REGOLA #1: Estrazione Piatti e Prezzi

**PROBLEMA COMUNE**: Prezzi scritti in formati diversi, simboli valuta mancanti, prezzi per persona vs totali.

**SOLUZIONE**:
1. Identifica TUTTE le categorie di menu (antipasti, primi, secondi, dolci, bevande)
2. Per ogni piatto estrai: nome, descrizione, prezzo
3. Normalizza i prezzi in formato decimale con valuta

**Formati prezzo da gestire**:
```
"€ 12,50"     → price: 12.50, currency: "EUR"
"12.50 €"     → price: 12.50, currency: "EUR"
"12,50"       → price: 12.50, currency: "EUR" (assume euro se in Italia)
"$15"         → price: 15.00, currency: "USD"
"15"          → price: 15.00, currency: "EUR" (default)
"12,50/pers"  → price: 12.50, currency: "EUR", per_person: true
```

**Casi speciali**:
- Prezzi variabili: "8-12€" → price_min: 8.00, price_max: 12.00
- Prezzi su richiesta: "S.Q." o "Market Price" → price: null, price_note: "on_request"
- Prezzi per peso: "45€/kg" → price: 45.00, unit: "kg"

---

### REGOLA #2: Identificazione Ingredienti

**Dove cercarli**:
- Sotto il nome del piatto (descrizione)
- Tra parentesi
- Dopo virgola o trattino
- In caratteri più piccoli

**Estrazione**:
```
"Carbonara - guanciale, uova, pecorino, pepe"
→ ingredients: ["guanciale", "uova", "pecorino romano", "pepe nero"]

"Risotto ai funghi porcini (riso Carnaroli, porcini freschi)"
→ ingredients: ["riso Carnaroli", "funghi porcini freschi"]
```

**Allergeni**:
Identifica e segna gli allergeni principali:
- Glutine (grano, farro, orzo)
- Latticini (latte, formaggi, burro)
- Uova
- Pesce
- Crostacei
- Frutta a guscio
- Soia
- Sedano

**Output**:
```json
{
  "allergens": ["gluten", "dairy", "eggs"]
}
```

---

### REGOLA #3: Categorie e Sezioni

**Sezioni comuni da riconoscere**:
- Antipasti / Starters / Appetizers
- Primi / First Courses / Pasta
- Secondi / Main Courses / Mains
- Contorni / Side Dishes / Sides
- Dolci / Desserts
- Bevande / Drinks / Beverages
- Vini / Wines
- Menu Degustazione / Tasting Menu

**Normalizzazione**:
Usa sempre categorie standardizzate in inglese:
```
"Antipasti" → category: "appetizers"
"Primi"     → category: "first_courses"
"Secondi"   → category: "main_courses"
"Dolci"     → category: "desserts"
"Bevande"   → category: "drinks"
"Vini"      → category: "wines"
```

**Sottocategorie**:
Mantieni sottocategorie quando presenti:
```
"Antipasti di Mare"  → category: "appetizers", subcategory: "seafood"
"Primi di Pesce"     → category: "first_courses", subcategory: "fish"
"Carni Rosse"        → category: "main_courses", subcategory: "red_meat"
```

---

### REGOLA #4: Descrizioni e Note

**Estrazione completa**:
- Nome piatto (breve, chiaro)
- Descrizione estesa (se presente)
- Note dello chef
- Indicazioni dietetiche

**Esempi**:
```
"Carbonara dello Chef
Ricetta tradizionale romana con guanciale croccante
★ Piatto dello Chef | Preparazione: 10 min"

→ Output:
{
  "name": "Carbonara dello Chef",
  "description": "Ricetta tradizionale romana con guanciale croccante",
  "chef_special": true,
  "preparation_time": "10 min"
}
```

**Indicatori speciali**:
- ★ / Chef's special → chef_special: true
- (V) / Vegetarian → vegetarian: true
- (VG) / Vegan → vegan: true
- (GF) / Gluten Free → gluten_free: true
- Piccante / Spicy → spicy: true

---

### REGOLA #5: Menu Multilingua

Se il menu è in più lingue:

**Comportamento**:
1. Estrai il testo nella lingua principale (di solito prima colonna)
2. Salva traduzioni nel campo `translations`
3. Identifica la lingua con codice ISO

**Esempio**:
```
"Spaghetti alla Carbonara | Carbonara Spaghetti"

→ Output:
{
  "name": "Spaghetti alla Carbonara",
  "language": "it",
  "translations": {
    "en": "Carbonara Spaghetti"
  }
}
```

---

### REGOLA #6: Qualità Immagine e OCR

**Problemi comuni**:
- Foto sfocate o angolate
- Lavagne con calligrafia difficile
- Menu scritti a mano
- Watermark o loghi sovrapposti

**Strategie**:
1. **Se testo poco chiaro**: Indica nel campo `confidence_score` (0.0-1.0)
2. **Se prezzo illeggibile**: Usa `price: null` e `price_note: "illegible"`
3. **Se nome parzialmente leggibile**: Riporta quello che leggi + `partial: true`

**Output qualità**:
```json
{
  "name": "Carbonara",
  "confidence_score": 0.95,
  "notes": "Prezzo parzialmente coperto da riflesso luce"
}
```

---

## Formato Output

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo prima o dopo.

```json
{
  "restaurant_info": {
    "name": "Osteria da Mario",
    "location": "Roma",
    "cuisine_type": "Italian",
    "menu_date": "2025-01-24"
  },
  "menu_sections": [
    {
      "category": "appetizers",
      "category_display": "Antipasti",
      "items": [
        {
          "name": "Bruschetta al Pomodoro",
          "description": "Pane tostato con pomodorini freschi, basilico e olio EVO",
          "ingredients": ["pane", "pomodorini", "basilico", "olio extravergine d'oliva"],
          "allergens": ["gluten"],
          "price": 8.50,
          "currency": "EUR",
          "vegetarian": true,
          "vegan": false,
          "gluten_free": false,
          "chef_special": false,
          "confidence_score": 1.0
        }
      ]
    },
    {
      "category": "first_courses",
      "category_display": "Primi Piatti",
      "items": [
        {
          "name": "Spaghetti alla Carbonara",
          "description": "Ricetta tradizionale romana",
          "ingredients": ["spaghetti", "guanciale", "uova", "pecorino romano", "pepe nero"],
          "allergens": ["gluten", "dairy", "eggs"],
          "price": 14.00,
          "currency": "EUR",
          "vegetarian": false,
          "chef_special": true,
          "preparation_time": "12 min",
          "confidence_score": 1.0
        }
      ]
    }
  ],
  "summary": {
    "total_items": 15,
    "categories_count": 4,
    "price_range": {
      "min": 8.50,
      "max": 35.00,
      "currency": "EUR"
    },
    "dietary_options": {
      "vegetarian_items": 5,
      "vegan_items": 2,
      "gluten_free_items": 3
    }
  }
}
```

### Schema Dettagliato

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| restaurant_info | object | ✅ | Informazioni ristorante |
| restaurant_info.name | string | ❌ | Nome ristorante (se presente) |
| restaurant_info.location | string | ❌ | Città/Indirizzo |
| restaurant_info.cuisine_type | string | ❌ | Tipo cucina |
| menu_sections | array | ✅ | Sezioni menu (min 1) |
| menu_sections[].category | string | ✅ | Categoria standardizzata (en) |
| menu_sections[].category_display | string | ✅ | Nome categoria originale |
| menu_sections[].items | array | ✅ | Piatti nella categoria |
| items[].name | string | ✅ | Nome piatto |
| items[].description | string | ❌ | Descrizione estesa |
| items[].ingredients | array | ❌ | Lista ingredienti |
| items[].allergens | array | ❌ | Lista allergeni |
| items[].price | number\|null | ❌ | Prezzo (decimale) |
| items[].currency | string | ❌ | Codice valuta (EUR, USD, GBP) |
| items[].vegetarian | boolean | ❌ | È vegetariano |
| items[].vegan | boolean | ❌ | È vegano |
| items[].gluten_free | boolean | ❌ | Senza glutine |
| items[].chef_special | boolean | ❌ | Piatto dello chef |
| items[].confidence_score | number | ❌ | Confidenza OCR (0.0-1.0) |
| summary | object | ✅ | Riepilogo menu |

---

## Errori Comuni da Evitare

### Errore #1: Confondere valuta
```
❌ SBAGLIATO: "12,50" → price: "12,50" (stringa)
✅ CORRETTO:  "12,50" → price: 12.50, currency: "EUR"
```

### Errore #2: Perdere ingredienti nascosti
```
❌ SBAGLIATO: ingredients: ["pasta", "pomodoro"]
✅ CORRETTO:  ingredients: ["pasta", "pomodoro", "aglio", "olio", "basilico"]
              (anche se non tutti sono elencati esplicitamente)
```

### Errore #3: Categoria sbagliata
```
❌ SBAGLIATO: "Risotto" → category: "main_courses"
✅ CORRETTO:  "Risotto" → category: "first_courses" (è un primo in Italia!)
```

### Errore #4: Non normalizzare allergeni
```
❌ SBAGLIATO: allergens: ["latte", "uova", "farina"]
✅ CORRETTO:  allergens: ["dairy", "eggs", "gluten"]
```

---

## Esempi

### Esempio 1: Menu Semplice Italiano

**Input**: Foto menu cartaceo

**Output**:
```json
{
  "restaurant_info": {
    "name": "Trattoria Romana",
    "cuisine_type": "Italian"
  },
  "menu_sections": [
    {
      "category": "first_courses",
      "category_display": "Primi Piatti",
      "items": [
        {
          "name": "Amatriciana",
          "description": "Pasta con guanciale, pomodoro e pecorino",
          "ingredients": ["pasta", "guanciale", "pomodoro", "pecorino"],
          "allergens": ["gluten", "dairy"],
          "price": 12.00,
          "currency": "EUR",
          "vegetarian": false,
          "confidence_score": 1.0
        }
      ]
    }
  ],
  "summary": {
    "total_items": 8,
    "categories_count": 3,
    "price_range": {
      "min": 8.00,
      "max": 18.00,
      "currency": "EUR"
    }
  }
}
```

### Esempio 2: Menu con Prezzi Variabili

**Input**: "Grigliata Mista di Pesce - 35-50€"

**Output**:
```json
{
  "name": "Grigliata Mista di Pesce",
  "price_min": 35.00,
  "price_max": 50.00,
  "price": null,
  "currency": "EUR",
  "price_note": "variable_by_weight",
  "allergens": ["fish"]
}
```

### Esempio 3: Menu Multilingua

**Input**: PDF menu bilingue (IT/EN)

**Output**:
```json
{
  "name": "Cacio e Pepe",
  "language": "it",
  "translations": {
    "en": "Cheese and Pepper Pasta"
  },
  "description": "Pasta con pecorino romano e pepe nero",
  "ingredients": ["pasta", "pecorino romano", "pepe nero"],
  "price": 13.00,
  "currency": "EUR"
}
```

---

## Note Tecniche

- **Modello consigliato**: Claude 3.5 Sonnet (ottimizzato per vision)
- **Max tokens**: 8192
- **Temperature**: 0 (deterministic)
- **Timeout**: 60 secondi
- **Formati supportati**: PDF, JPG, PNG, WEBP
- **Max size**: 10 MB
- **Multi-page**: Supportato (analizza tutte le pagine)

---

## Changelog

### v1.0.0 (2025-01-24)
- ✅ Prima versione stabile
- ✅ Supporto menu PDF e immagini
- ✅ Estrazione ingredienti e allergeni
- ✅ Riconoscimento categorie multilingua
- ✅ Normalizzazione prezzi e valute
- ✅ Indicatori dietetici (vegetarian, vegan, gluten-free)
- ✅ Confidence scoring per OCR quality
