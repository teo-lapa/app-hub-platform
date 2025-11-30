# Sistema Food News - Documentazione

## Panoramica
Sistema completo per generare articoli food giornalieri utilizzando l'AI Claude di Anthropic.

## File Creati

### API Routes

1. **`/app/api/food-news/generate/route.ts`**
   - Endpoint POST per generare 6 nuovi articoli
   - 3 articoli categoria "Curiosita Food" (cucina mediterranea, Europa, America)
   - 3 articoli categoria "Gestione Ristorante" (strategie business)
   - Lunghezza: 400-500 parole per articolo
   - Salva articoli in `/data/food-articles.json`
   - Utilizza Claude 3.5 Sonnet tramite Anthropic SDK

2. **`/app/api/food-news/route.ts`**
   - Endpoint GET per leggere articoli del giorno
   - Se non esistono articoli per oggi, genera automaticamente nuovi articoli
   - Ritorna JSON con array di articoli

### Componenti UI

3. **`/app/components/ArticleCard.tsx`**
   - Card elegante per visualizzare anteprima articolo
   - Immagine, titolo, categoria badge, preview testo
   - Animazioni hover con framer-motion
   - Design responsive con gradient colors

4. **`/app/components/ArticleModal.tsx`**
   - Modal full-screen per visualizzare articolo completo
   - Immagine hero, contenuto formattato in paragrafi
   - Fonte citata in fondo
   - Chiusura con ESC o click su backdrop
   - Animazioni smooth di apertura/chiusura

### Pagine

5. **`/app/food-news/page.tsx`**
   - Pagina principale Food News
   - Layout "giornale digitale" moderno
   - Griglia 3x2 (3 card per categoria)
   - Sezioni separate per categorie
   - Pulsante "Genera Nuovi Articoli"
   - Stati: loading, error, empty, success
   - Design: sfondo scuro, gradient, effetti hover

### Styles

6. **`/app/globals.css`** (modificato)
   - Aggiunta animazione `animate-bounce-slow`
   - Già presenti: `animate-shimmer`, `animate-float`

## Struttura Dati

### Articolo (Article)
```typescript
interface Article {
  id: string;                                    // ID unico
  title: string;                                 // Titolo (max 80 caratteri)
  content: string;                               // Contenuto completo (400-500 parole)
  category: 'Curiosita Food' | 'Gestione Ristorante';
  source: string;                                // Fonte credibile
  imageUrl: string;                              // URL immagine Unsplash
  date: string;                                  // ISO timestamp
  preview: string;                               // Preview (primi 150 caratteri)
}
```

### File JSON (`/data/food-articles.json`)
```json
{
  "date": "2025-10-15",
  "articles": [/* array di 6 articoli */]
}
```

## Come Testare

### 1. Avvia il server di sviluppo
```bash
cd C:\Users\lapa\Desktop\Claude Code\app-hub-platform
npm run dev
```

### 2. Accedi alla pagina Food News
Apri il browser e vai a:
```
http://localhost:3000/food-news
```

### 3. Testa le funzionalità

#### A) Caricamento automatico
- Al primo accesso, il sistema genererà automaticamente 6 articoli
- Tempo di generazione: ~15-20 secondi (6 chiamate AI sequenziali)
- Visualizzerai spinner di caricamento

#### B) Visualizzazione articoli
- 6 card in griglia responsive
- Sezione "Curiosita del Food" (3 articoli verdi)
- Sezione "Gestione Ristorante" (3 articoli rossi)
- Hover sulle card per effetto animato

#### C) Apertura articolo completo
- Click su una card
- Si apre modal full-screen
- Visualizza articolo completo con formattazione
- Fonte citata in fondo
- Chiudi con X, ESC o click fuori

#### D) Generazione nuovi articoli
- Click sul pulsante "Nuovi Articoli" in alto a destra
- Genera 6 nuovi articoli freschi
- Sovrascrive i precedenti

### 4. Testa le API direttamente

#### GET articoli del giorno
```bash
curl http://localhost:3000/api/food-news
```

Risposta:
```json
{
  "success": true,
  "articles": [/* 6 articoli */],
  "date": "2025-10-15",
  "generated": false
}
```

#### POST genera nuovi articoli
```bash
curl -X POST http://localhost:3000/api/food-news/generate
```

Risposta:
```json
{
  "success": true,
  "message": "6 articoli generati con successo",
  "articles": [/* 6 articoli */],
  "date": "2025-10-15"
}
```

## Funzionalità Chiave

### 1. Generazione AI Automatica
- Utilizza Claude 3.5 Sonnet (model: `claude-3-5-sonnet-20241022`)
- Articoli 100% originali, non copiati da web
- Contenuti in ITALIANO
- Lunghezza controllata: 400-500 parole

### 2. Categorie Intelligenti
- **Curiosita Food**: storia piatti, ingredienti, tecniche culinarie, tradizioni
- **Gestione Ristorante**: strategie business, marketing, customer experience, tecnologie

### 3. Design Moderno
- Sfondo scuro con gradient
- Card con effetti hover e animazioni
- Responsive mobile-first
- Immagini da Unsplash correlate

### 4. Performance Ottimizzata
- Articoli salvati in file JSON locale
- Cache giornaliera (1 generazione al giorno)
- Rigenerazione manuale disponibile
- Pause tra chiamate AI per evitare rate limiting

### 5. UX Professionale
- Loading states chiari
- Error handling completo
- Modal con animazioni smooth
- Fonti citate per credibilità

## Requisiti

- **Node.js** 18+
- **Next.js** 14+
- **Anthropic SDK** ^0.65.0
- **Framer Motion** ^10.16.16
- **API Key**: `ANTHROPIC_API_KEY` in `.env.local` (già configurata)

## Integrazione con JokeBanner

Il pulsante nel JokeBanner (`/app/components/JokeBanner.tsx`) è già collegato:
```tsx
<button onClick={() => window.location.href = '/food-news'}>
  Curiosita del Mondo Food - Ricercate con AI
</button>
```

Dalla homepage, gli utenti possono accedere direttamente alla pagina Food News.

## File Storage

Gli articoli sono salvati in:
```
C:\Users\lapa\Desktop\Claude Code\app-hub-platform\data\food-articles.json
```

La directory `/data` viene creata automaticamente al primo utilizzo.

## Troubleshooting

### Errore: "ANTHROPIC_API_KEY not found"
Verifica che `.env.local` contenga:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Errore: "Failed to generate articles"
- Controlla la connessione internet
- Verifica quota API Anthropic
- Controlla console per dettagli errore

### Articoli non si aggiornano
- Gli articoli sono cache giornaliera
- Usa pulsante "Nuovi Articoli" per rigenerare
- Oppure elimina `/data/food-articles.json`

### Immagini non si caricano
- Le immagini sono da Unsplash (richiede connessione)
- Verifica che Unsplash sia accessibile

## Personalizzazione

### Cambiare numero di articoli
Modifica `/app/api/food-news/generate/route.ts`:
```typescript
// Genera 3 articoli "Curiosita Food"
for (let i = 0; i < 3; i++) { // Cambia questo numero
```

### Aggiungere categorie
1. Aggiorna type `Article.category`
2. Aggiungi prompt in `generateArticle()`
3. Aggiungi colori in `ArticleCard` e `ArticleModal`

### Cambiare immagini
Modifica array `imageUrls` in `/app/api/food-news/generate/route.ts`:
```typescript
const imageUrls = {
  'Curiosita Food': [
    'https://images.unsplash.com/photo-...',
  ],
}
```

## Nota sulla Sicurezza

Le API keys sono lette da variabili d'ambiente e non esposte al client.
Le chiamate API avvengono solo server-side (Next.js API Routes).

## Prossimi Sviluppi Possibili

1. Database persistente (MongoDB, PostgreSQL)
2. Sistema di preferiti/salvataggi utente
3. Condivisione articoli social
4. Newsletter via email
5. Sistema di commenti
6. Ricerca full-text articoli
7. Tags e filtri avanzati
8. Sistema di rating articoli
9. Versione multilingua
10. Export PDF articoli

---

**Sviluppato con Claude AI by Anthropic**
**Piattaforma: Next.js 14 + TypeScript + Tailwind CSS**
