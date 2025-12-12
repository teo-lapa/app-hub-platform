# Guida Completa: Creazione Articoli Multilingua in Odoo

## Indice
1. [Panoramica del Sistema](#panoramica-del-sistema)
2. [Struttura delle Lingue in Odoo](#struttura-delle-lingue-in-odoo)
3. [Come Odoo Gestisce le Traduzioni](#come-odoo-gestisce-le-traduzioni)
4. [Processo di Creazione Articolo](#processo-di-creazione-articolo)
5. [API e Metodi Utilizzati](#api-e-metodi-utilizzati)
6. [Best Practices per l'HTML](#best-practices-per-lhtml)
7. [Troubleshooting](#troubleshooting)
8. [Codice di Riferimento](#codice-di-riferimento)

---

## Panoramica del Sistema

Odoo utilizza un sistema di traduzioni "a segmenti" per i campi HTML. Questo significa che:

- Il contenuto viene salvato nella **lingua base** (italiano nel nostro caso)
- Le traduzioni vengono memorizzate come **mappature source → traduzione**
- Ogni "segmento" di testo è un'unità traducibile separata

### Lingue Configurate su LAPA Odoo

| Codice Odoo | Lingua | Note |
|-------------|--------|------|
| `it_IT` | Italiano | Lingua base |
| `de_CH` | Tedesco (Svizzera) | NON `de_DE` |
| `fr_CH` | Francese (Svizzera) | NON `fr_FR` |
| `en_US` | Inglese | Standard |
| `ro_RO` | Rumeno | Opzionale |

**IMPORTANTE**: Odoo Svizzera usa `de_CH` e `fr_CH`, non i codici standard `de_DE` e `fr_FR`.

---

## Struttura delle Lingue in Odoo

### Mapping Codici Lingua

```typescript
const LANG_MAP = {
  'it_IT': 'it_IT',  // Italiano → Italiano
  'de_DE': 'de_CH',  // Tedesco standard → Tedesco Svizzera
  'fr_FR': 'fr_CH',  // Francese standard → Francese Svizzera
  'en_US': 'en_US'   // Inglese → Inglese
};
```

---

## Come Odoo Gestisce le Traduzioni

### Sistema di Segmenti

Odoo divide il contenuto HTML in "segmenti" traducibili. Ogni segmento è:
- Il contenuto testuale di un tag HTML
- Separato dove ci sono tag inline (`<strong>`, `<em>`, ecc.)

#### Esempio di Segmentazione

**HTML Input:**
```html
<p>Nel cuore della <strong>Svizzera</strong>, LAPA serve ristoranti.</p>
```

**Segmenti creati da Odoo:**
1. `"Nel cuore della "`
2. `"Svizzera"`
3. `", LAPA serve ristoranti."`

**PROBLEMA**: Questa frammentazione rende difficile mappare le traduzioni!

### Soluzione: HTML Pulito

Per evitare la frammentazione, **rimuovere i tag inline** prima di salvare:

```html
<!-- PRIMA (problematico) -->
<p>Nel cuore della <strong>Svizzera</strong>, LAPA serve ristoranti.</p>

<!-- DOPO (corretto) -->
<p>Nel cuore della Svizzera, LAPA serve ristoranti.</p>
```

**Segmento unico:** `"Nel cuore della Svizzera, LAPA serve ristoranti."`

---

## Processo di Creazione Articolo

### Step 1: Preparare l'HTML

Rimuovere tutti i tag inline che frammentano il testo:

```typescript
function cleanInlineTags(html: string): string {
  return html
    .replace(/<strong>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<em>/gi, '')
    .replace(/<\/em>/gi, '')
    .replace(/<b>/gi, '')
    .replace(/<\/b>/gi, '')
    .replace(/<i>/gi, '')
    .replace(/<\/i>/gi, '');
}
```

### Step 2: Creare l'Articolo in Italiano

```typescript
const postId = await callOdoo('blog.post', 'create', [{
  name: 'Titolo Articolo',
  subtitle: 'Sottotitolo',
  content: cleanedHtml,  // HTML senza tag inline
  blog_id: 4,            // ID del blog (LAPABlog = 4)
  website_meta_title: 'Meta Title SEO',
  website_meta_description: 'Meta description per Google',
  website_meta_keywords: 'keyword1, keyword2, keyword3',
  is_published: false
}], {
  context: { lang: 'it_IT' }  // IMPORTANTE: specificare lingua base
});
```

### Step 3: Tradurre i Campi Semplici

I campi `name`, `subtitle`, e meta si traducono con `write` + `context`:

```typescript
await callOdoo('blog.post', 'write', [
  [postId],
  {
    name: 'Artikeltitel',           // Titolo in tedesco
    subtitle: 'Untertitel',         // Sottotitolo in tedesco
    website_meta_title: 'Meta Titel',
    website_meta_description: 'Meta Beschreibung',
    website_meta_keywords: 'schlüsselwort1, schlüsselwort2'
  }
], {
  context: { lang: 'de_CH' }  // Lingua target
});
```

### Step 4: Leggere i Segmenti del Content

```typescript
const segmentData = await callOdoo(
  'blog.post',
  'get_field_translations',
  [[postId], 'content']
);

// Risultato: array di oggetti {lang, source, value}
// source = testo italiano originale
// value = traduzione (vuota se non tradotto)
```

### Step 5: Creare il Mapping delle Traduzioni

Estrarre i testi dall'HTML in ordine:

```typescript
function extractTexts(html: string): string[] {
  const texts: string[] = [];
  const regex = />([^<]+)</g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text && text.length > 1) {
      texts.push(text);
    }
  }
  return texts;
}

// Creare mapping per posizione
const itTexts = extractTexts(itHtml);
const deTexts = extractTexts(deHtml);

const textMap = new Map<string, string>();
for (let i = 0; i < Math.min(itTexts.length, deTexts.length); i++) {
  if (itTexts[i] !== deTexts[i]) {
    textMap.set(itTexts[i], deTexts[i]);
  }
}
```

### Step 6: Applicare le Traduzioni del Content

```typescript
// Preparare oggetto traduzioni: {source_italiano: traduzione}
const translations: Record<string, string> = {};

for (const source of sources) {  // sources = segmenti da Odoo
  if (textMap.has(source)) {
    translations[source] = textMap.get(source)!;
  }
}

// Applicare con update_field_translations
await callOdoo('blog.post', 'update_field_translations', [
  [postId],
  'content',
  { 'de_CH': translations }  // { lingua: {source: traduzione, ...} }
]);
```

---

## API e Metodi Utilizzati

### Autenticazione

```typescript
// Endpoint
POST /web/session/authenticate

// Body
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "db": "database_name",
    "login": "username",
    "password": "password"
  }
}

// Salvare i cookies dalla risposta per le chiamate successive
```

### Chiamate API Generiche

```typescript
// Endpoint
POST /web/dataset/call_kw

// Body
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "model": "blog.post",
    "method": "create|write|read|...",
    "args": [...],
    "kwargs": { context: { lang: 'de_CH' } }
  }
}
```

### Metodi Specifici per Traduzioni

| Metodo | Descrizione | Parametri |
|--------|-------------|-----------|
| `get_field_translations` | Legge i segmenti traducibili | `[[id], 'field_name']` |
| `update_field_translations` | Applica traduzioni | `[[id], 'field_name', {lang: {src: trans}}]` |

---

## Best Practices per l'HTML

### ✅ HTML Corretto

```html
<section class="s_text_block">
  <div class="container">
    <h1>Titolo Principale</h1>
    <p>Paragrafo completo senza tag inline che frammentano il testo.</p>
    <h2>Sottotitolo</h2>
    <ul>
      <li>Elemento lista uno</li>
      <li>Elemento lista due</li>
    </ul>
  </div>
</section>
```

### ❌ HTML Problematico

```html
<section>
  <div>
    <h1>Titolo <strong>Importante</strong></h1>
    <p>Testo con <strong>grassetto</strong> e <em>corsivo</em> che frammenta.</p>
  </div>
</section>
```

### Tag Permessi (non frammentano)

- `<section>`, `<div>`, `<article>`
- `<h1>` - `<h6>`
- `<p>`
- `<ul>`, `<ol>`, `<li>`
- `<a href="...">` (link)
- `<img>`, `<br>`

### Tag da Evitare (frammentano)

- `<strong>`, `<b>`
- `<em>`, `<i>`
- `<span>` (con testo)
- `<mark>`, `<u>`

---

## Troubleshooting

### Problema: Traduzioni non applicate

**Causa**: I segmenti Odoo non corrispondono ai testi estratti.

**Soluzione**:
1. Verificare che l'HTML non abbia tag inline
2. Controllare che i testi estratti corrispondano esattamente ai segmenti Odoo

```typescript
// Debug: confrontare segmenti
const sources = segmentData[0].map(s => s.source);
const extracted = extractTexts(html);

console.log('Segmenti Odoo:', sources.slice(0, 5));
console.log('Testi estratti:', extracted.slice(0, 5));
```

### Problema: Errore "Multiple elements found"

**Causa**: La traduzione contiene tag HTML.

**Soluzione**: Rimuovere qualsiasi tag dalla traduzione:

```typescript
translation = translation.replace(/<[^>]+>/g, '');
```

### Problema: Testo frammentato/misto

**Causa**: Tag `<strong>` o simili nell'HTML originale.

**Soluzione**: Pulire l'HTML prima di salvare con `cleanInlineTags()`.

### Problema: Lingue sbagliate

**Causa**: Uso di `de_DE` invece di `de_CH`.

**Soluzione**: Usare sempre i codici Odoo Svizzera:
- Tedesco: `de_CH`
- Francese: `fr_CH`

---

## Codice di Riferimento

### Script Completo per Upload Articolo

```typescript
/**
 * Upload articolo multilingua su Odoo
 */

import { readFileSync } from 'fs';

const ODOO_URL = 'https://your-odoo-instance.odoo.com';
const ODOO_DB = 'your-database';
const ODOO_USERNAME = 'user@email.com';
const ODOO_PASSWORD = 'password';

let cookies = '';

const LANG_MAP: Record<string, string> = {
  'it_IT': 'it_IT',
  'de_DE': 'de_CH',
  'fr_FR': 'fr_CH',
  'en_US': 'en_US'
};

async function authenticate(): Promise<void> {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
      id: Date.now()
    })
  });

  const cookieHeader = response.headers.get('set-cookie');
  if (cookieHeader) {
    cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
  }

  const data = await response.json();
  if (!data.result?.uid) throw new Error('Authentication failed');
}

async function callOdoo(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

function cleanInlineTags(html: string): string {
  return html
    .replace(/<strong>/gi, '').replace(/<\/strong>/gi, '')
    .replace(/<em>/gi, '').replace(/<\/em>/gi, '')
    .replace(/<b>/gi, '').replace(/<\/b>/gi, '')
    .replace(/<i>/gi, '').replace(/<\/i>/gi, '');
}

function extractTexts(html: string): string[] {
  const texts: string[] = [];
  const regex = />([^<]+)</g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text && text.length > 1) texts.push(text);
  }
  return texts;
}

async function uploadMultilingualArticle(articleData: {
  translations: Record<string, {
    name: string;
    subtitle: string;
    content_html: string;
    meta: { title: string; description: string; keywords: string };
  }>;
}): Promise<number> {

  await authenticate();

  const itData = articleData.translations.it_IT;
  const cleanItHtml = cleanInlineTags(itData.content_html);

  // 1. Creare articolo in italiano
  const postId = await callOdoo('blog.post', 'create', [{
    name: itData.name,
    subtitle: itData.subtitle,
    content: cleanItHtml,
    blog_id: 4,
    website_meta_title: itData.meta.title,
    website_meta_description: itData.meta.description,
    website_meta_keywords: itData.meta.keywords,
    is_published: false
  }], { context: { lang: 'it_IT' } });

  // 2. Tradurre campi semplici per ogni lingua
  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;

    const langData = articleData.translations[jsonLang];
    if (!langData) continue;

    await callOdoo('blog.post', 'write', [[postId], {
      name: langData.name,
      subtitle: langData.subtitle,
      website_meta_title: langData.meta.title,
      website_meta_description: langData.meta.description,
      website_meta_keywords: langData.meta.keywords,
    }], { context: { lang: odooLang } });
  }

  // 3. Leggere segmenti content
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);
  if (!segmentData?.[0]?.length) return postId;

  const sources = [...new Set(segmentData[0].map((s: any) => s.source))] as string[];
  const itTexts = extractTexts(cleanItHtml);

  // 4. Tradurre content per ogni lingua
  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;

    const langData = articleData.translations[jsonLang];
    if (!langData) continue;

    const cleanTargetHtml = cleanInlineTags(langData.content_html);
    const targetTexts = extractTexts(cleanTargetHtml);

    // Creare mapping
    const textMap = new Map<string, string>();
    for (let i = 0; i < Math.min(itTexts.length, targetTexts.length); i++) {
      if (itTexts[i] !== targetTexts[i]) {
        textMap.set(itTexts[i], targetTexts[i]);
      }
    }

    // Mappare segmenti
    const translations: Record<string, string> = {};
    for (const src of sources) {
      if (textMap.has(src)) {
        translations[src] = textMap.get(src)!;
      }
    }

    // Applicare traduzioni
    if (Object.keys(translations).length > 0) {
      await callOdoo('blog.post', 'update_field_translations', [
        [postId], 'content', { [odooLang]: translations }
      ]);
    }
  }

  return postId;
}

// Uso
const article = JSON.parse(readFileSync('article.json', 'utf-8'));
uploadMultilingualArticle(article).then(id => console.log('Created:', id));
```

---

## Struttura JSON Articolo

```json
{
  "translations": {
    "it_IT": {
      "name": "Titolo Italiano",
      "subtitle": "Sottotitolo italiano",
      "meta": {
        "title": "Meta Title IT | Brand",
        "description": "Meta description italiana per SEO...",
        "keywords": "parola1, parola2, parola3"
      },
      "content_html": "<section>...</section>"
    },
    "de_DE": {
      "name": "Deutscher Titel",
      "subtitle": "Deutscher Untertitel",
      "meta": {
        "title": "Meta Titel DE | Brand",
        "description": "Deutsche Meta-Beschreibung...",
        "keywords": "wort1, wort2, wort3"
      },
      "content_html": "<section>...</section>"
    },
    "fr_FR": {
      "name": "Titre Français",
      "subtitle": "Sous-titre français",
      "meta": {
        "title": "Meta Titre FR | Brand",
        "description": "Description méta française...",
        "keywords": "mot1, mot2, mot3"
      },
      "content_html": "<section>...</section>"
    },
    "en_US": {
      "name": "English Title",
      "subtitle": "English subtitle",
      "meta": {
        "title": "Meta Title EN | Brand",
        "description": "English meta description...",
        "keywords": "word1, word2, word3"
      },
      "content_html": "<section>...</section>"
    }
  }
}
```

---

## Checklist Finale

- [ ] HTML pulito senza tag `<strong>`, `<em>`, `<b>`, `<i>`
- [ ] Articolo creato con `context: { lang: 'it_IT' }`
- [ ] Campi tradotti con `write` + `context: { lang: 'xx_XX' }`
- [ ] Segmenti letti con `get_field_translations`
- [ ] Mapping creato per posizione dei testi
- [ ] Traduzioni applicate con `update_field_translations`
- [ ] Usati codici corretti: `de_CH`, `fr_CH` (non `de_DE`, `fr_FR`)

---

*Documentazione creata il 11/12/2025 - LAPA SEO+GEO Optimizer*
