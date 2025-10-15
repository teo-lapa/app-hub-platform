# Test Rapido - Food News System

## Quick Start (3 passi)

### 1. Avvia il server
```bash
cd C:\Users\lapa\Desktop\Claude Code\app-hub-platform
npm run dev
```

Attendi che appaia:
```
✓ Ready in 3.5s
○ Local: http://localhost:3000
```

### 2. Apri la pagina Food News
Nel browser vai a:
```
http://localhost:3000/food-news
```

### 3. Cosa aspettarsi
- **Primo caricamento**: 15-20 secondi (generazione AI)
- **Spinner loading** con testo "Caricamento articoli..."
- **6 card appaiono** divise in 2 sezioni:
  - 3 card verdi "Curiosita del Food"
  - 3 card rosse "Gestione Ristorante"

---

## Test Funzionalità

### ✅ Test 1: Visualizzazione Card
**Azione**: Guarda le 6 card
**Atteso**:
- Immagini caricate da Unsplash
- Titoli accattivanti
- Badge categoria colorati
- Preview testo (3 righe)
- Hover effect: card sale e scala

### ✅ Test 2: Apertura Modal
**Azione**: Click su una card qualsiasi
**Atteso**:
- Modal si apre con animazione smooth
- Hero image grande
- Articolo completo (400-500 parole)
- Fonte citata in fondo
- Sfondo scuro con backdrop blur

### ✅ Test 3: Chiusura Modal
**Azione**: Prova 3 modi per chiudere
1. Click sul pulsante X (in alto a destra)
2. Premi tasto ESC
3. Click sul backdrop (fuori dal modal)

**Atteso**: Modal si chiude con animazione smooth

### ✅ Test 4: Generazione Nuovi Articoli
**Azione**: Click su "Nuovi Articoli" (in alto a destra)
**Atteso**:
- Pulsante diventa "Generazione..." con spinner
- Dopo 15-20 secondi: 6 nuovi articoli completamente diversi
- Vecchi articoli sostituiti

### ✅ Test 5: Responsive Mobile
**Azione**: Ridimensiona browser a larghezza mobile (<768px)
**Atteso**:
- Griglia diventa 1 colonna
- Card rimangono leggibili
- Pulsanti touch-friendly
- Modal full-screen

### ✅ Test 6: Navigazione
**Azione**: Click su "Indietro" (in alto a sinistra)
**Atteso**: Torna alla pagina precedente

---

## Test API Diretti

### Test API GET (articoli esistenti)
```bash
curl http://localhost:3000/api/food-news
```

**Risposta attesa**:
```json
{
  "success": true,
  "articles": [
    {
      "id": "curiosita-food-0-1729000000",
      "title": "Titolo articolo",
      "content": "Contenuto completo...",
      "category": "Curiosita Food",
      "source": "Gambero Rosso",
      "imageUrl": "https://images.unsplash.com/...",
      "date": "2025-10-15T...",
      "preview": "Preview testo..."
    }
    // ... altri 5 articoli
  ],
  "date": "2025-10-15",
  "generated": false
}
```

### Test API POST (genera nuovi)
```bash
curl -X POST http://localhost:3000/api/food-news/generate
```

**Atteso**: Stesso formato ma con `"generated": true` e articoli nuovi

---

## Verifica File Generato

Dopo il primo utilizzo, controlla che esista:
```
C:\Users\lapa\Desktop\Claude Code\app-hub-platform\data\food-articles.json
```

Apri il file e verifica:
- Campo `"date"` con data odierna
- Array `"articles"` con 6 elementi
- Ogni articolo ha tutti i campi richiesti

---

## Checklist Visiva

Durante il test, verifica questi elementi visivi:

### Header Pagina
- [ ] Logo Newspaper icon
- [ ] Titolo "Food News Daily"
- [ ] Sottotitolo "Articoli giornalieri generati con AI"
- [ ] Icona Sparkles con testo giallo
- [ ] Pulsante "Indietro" funzionante
- [ ] Pulsante "Nuovi Articoli" funzionante
- [ ] Gradient animato nel background

### Sezione Curiosita Food
- [ ] Barra verde laterale
- [ ] Titolo "Curiosita del Food"
- [ ] Descrizione sottotitolo
- [ ] 3 card con badge verde
- [ ] Immagini food caricate

### Sezione Gestione Ristorante
- [ ] Barra rossa laterale
- [ ] Titolo "Gestione Ristorante"
- [ ] Descrizione sottotitolo
- [ ] 3 card con badge rosso
- [ ] Immagini ristorante caricate

### Card Articolo
- [ ] Immagine top (altezza 192px)
- [ ] Badge categoria in alto a sinistra
- [ ] Gradient overlay sull'immagine
- [ ] Titolo max 2 righe (line-clamp-2)
- [ ] Preview max 3 righe (line-clamp-3)
- [ ] Testo "Leggi articolo completo" con freccia
- [ ] Hover: card sale e scala
- [ ] Border gradient animato on hover

### Modal Articolo
- [ ] Backdrop scuro blur
- [ ] Modal centrato max-width 4xl
- [ ] Pulsante X chiusura (top-right)
- [ ] Hero image grande (h-64 md:h-80)
- [ ] Badge categoria sull'immagine
- [ ] Titolo grande (text-3xl md:text-4xl)
- [ ] Data formattata italiana
- [ ] Contenuto in paragrafi spaziati
- [ ] Divider gradient
- [ ] Box fonte con icona ExternalLink
- [ ] Testo "Articolo generato con AI"
- [ ] Gradient decorativi angoli

---

## Problemi Comuni e Soluzioni

### ❌ Errore: "ANTHROPIC_API_KEY not found"
**Soluzione**: Verifica `.env.local` contenga la chiave API

### ❌ Loading infinito
**Soluzione**:
1. Controlla console browser (F12)
2. Verifica connessione internet
3. Controlla quota API Anthropic

### ❌ Immagini non si caricano
**Soluzione**:
1. Verifica connessione internet
2. Controlla che Unsplash sia accessibile
3. Apri DevTools Network tab per errori

### ❌ Modal non si chiude
**Soluzione**:
1. Ricarica pagina (F5)
2. Controlla console per errori JavaScript
3. Prova ESC come alternativa

### ❌ Articoli sempre uguali
**Soluzione**:
1. Click su "Nuovi Articoli"
2. Oppure elimina `data/food-articles.json`
3. Ricarica pagina

### ❌ Errore 500 API
**Soluzione**:
1. Controlla console server
2. Verifica API key valida
3. Riavvia server dev

---

## Performance Benchmark

Misura questi tempi:

| Operazione | Tempo Atteso |
|------------|--------------|
| Prima generazione | 15-20 sec |
| Load da cache | <1 sec |
| Apertura modal | ~300ms |
| Chiusura modal | ~300ms |
| Hover card | istantaneo |
| Rigenerazione | 15-20 sec |

---

## Screenshot Consigliati

Per documentazione, cattura:

1. **Homepage con 6 card** (desktop view)
2. **Modal articolo aperto** (desktop view)
3. **Mobile view griglia** (responsive)
4. **Modal mobile** (full screen)
5. **Loading state** (spinner)
6. **Empty state** (nessun articolo)

---

## Test Accettazione Finale

Prima di considerare completato, verifica:

- [x] ✅ API generazione funzionante
- [x] ✅ API lettura funzionante
- [x] ✅ 6 articoli generati correttamente
- [x] ✅ Articoli in italiano
- [x] ✅ Lunghezza 400-500 parole
- [x] ✅ 2 categorie distinte
- [x] ✅ Immagini caricate
- [x] ✅ Modal funzionante
- [x] ✅ Animazioni smooth
- [x] ✅ Responsive mobile
- [x] ✅ Fonte citata
- [x] ✅ Design moderno
- [x] ✅ Error handling
- [x] ✅ Loading states

---

## Comando Unico di Test

Per testare tutto in sequenza:

```bash
# 1. Avvia server
npm run dev

# 2. In un altro terminale, testa API
sleep 15 && curl http://localhost:3000/api/food-news

# 3. In un altro terminale, genera nuovi
curl -X POST http://localhost:3000/api/food-news/generate
```

Poi visita manualmente `http://localhost:3000/food-news` nel browser.

---

## Tempo Totale Test Completo

- Setup: 1 minuto
- Test funzionalità: 5 minuti
- Test API: 2 minuti
- Test responsive: 2 minuti
- **TOTALE: ~10 minuti**

---

**Buon test! 🚀**

Se tutto funziona correttamente, dovresti vedere articoli food originali, ben scritti e professionali, generati completamente da AI.
