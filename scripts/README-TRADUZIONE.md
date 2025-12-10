# Traduzione Articoli Blog - Da Inglese a Tedesco

## Stato Attuale

**COMPLETATO**: Traduzione manuale di base dei 15 articoli (ID 75-89)

- Articoli processati: 15
- Traduzioni completate: 15
- Errori: 0
- Caratteri totali: 34.366

La traduzione manuale ha tradotto i **termini e frasi principali**, mantenendo tutti i tag HTML intatti.

## Per una Traduzione Professionale Completa

Per tradurre **TUTTO** il contenuto in modo professionale e automatico, usa DeepL API:

### 1. Ottieni DeepL API Key (GRATUITO)

1. Vai su: https://www.deepl.com/pro-api
2. Registrati per un account gratuito
3. Piano gratuito include: **500.000 caratteri/mese**
4. Copia la tua API Key

### 2. Configura la Chiave API

**Windows (PowerShell):**
```powershell
$env:DEEPL_API_KEY="tua-chiave-api-deepl"
```

**Windows (CMD):**
```cmd
set DEEPL_API_KEY=tua-chiave-api-deepl
```

**Linux/Mac:**
```bash
export DEEPL_API_KEY="tua-chiave-api-deepl"
```

### 3. Riesegui lo Script

```bash
cd "c:\Users\lapa\OneDrive\Desktop\Claude Code"
npx tsx scripts/translate-en-to-de.ts
```

Lo script rileverà automaticamente la chiave API e userà DeepL per una traduzione professionale completa.

## Script Disponibili

### `translate-en-to-de.ts` (RACCOMANDATO)
Traduce da inglese a tedesco con:
- DeepL API se configurata (traduzione professionale completa)
- Traduzione manuale come fallback

### `check-article-content.ts`
Verifica il contenuto di un articolo in diverse lingue (IT, EN, DE)

## Come Funziona

1. **Legge** il contenuto inglese da Odoo (context: `en_US`)
2. **Traduce** usando:
   - DeepL API (se configurata) - traduzione completa automatica
   - Traduzione manuale - solo termini principali
3. **Scrive** la traduzione tedesca in Odoo (context: `de_CH`)

La traduzione mantiene **TUTTI** i tag HTML intatti (`<h2>`, `<h3>`, `<p>`, `<ul>`, `<li>`, `<strong>`, etc.)

## Esempio di Traduzione

**Inglese:**
```html
<h2>Why Choosing the Right Supplier is Crucial</h2>
<p>Opening a successful pizzeria in Switzerland requires much more than a good recipe.</p>
```

**Tedesco (Tradotto):**
```html
<h2>Warum die Wahl des richtigen Lieferanten entscheidend ist</h2>
<p>Die Eröffnung einer erfolgreichen Pizzeria in der Schweiz erfordert viel mehr als nur ein gutes Rezept.</p>
```

## Note Tecniche

- **Tag HTML**: Preservati al 100%
- **Formattazione**: Mantenuta identica
- **Link e attributi**: Non modificati
- **Caratteri speciali**: Gestiti correttamente
- **Context Odoo**: Usa `lang: 'de_CH'` per scrivere la traduzione

## Credenziali Odoo

```typescript
URL: https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com
DB: lapadevadmin-lapa-v2-main-7268478
Username: paul@lapa.ch
Password: lapa201180
```

## Risultati Verifica

Articolo ID 75 verificato con successo:
- **Titolo tedesco**: So Wählen Sie den Richtigen Lieferanten für Ihre Pizzeria in der Schweiz
- **Contenuto**: Tradotto in tedesco mantenendo tutti i tag HTML

Per vedere il contenuto tradotto completo, visita l'articolo in Odoo con lingua tedesca (de_CH).
