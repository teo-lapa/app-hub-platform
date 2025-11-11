# 🚀 Social Marketing AI Studio v2.0 - Guida Completa

**Ultimo aggiornamento**: 11 Novembre 2025
**Versione**: 2.0.0
**Powered by**: Gemini 2.5 Flash (Nano Banana 🍌) + Veo 3.1

---

## 📋 Indice

1. [Novità v2.0](#novità-v20)
2. [5 Stili Video Creativi](#5-stili-video-creativi)
3. [Configurazione Video Avanzata](#configurazione-video-avanzata)
4. [Logo Aziendale](#logo-aziendale)
5. [Formato TOML](#formato-toml)
6. [Guida Utilizzo](#guida-utilizzo)
7. [Best Practices](#best-practices)
8. [API Reference](#api-reference)

---

## 🎉 Novità v2.0

### Cosa c'è di nuovo?

1. **5 Stili Video Professionali**
   - 🎬 **Classico**: Rotazione smooth 360° professionale
   - 💥 **Esplosivo**: Prodotto che esplode e si ricompone
   - ✨ **Premium Luxury**: Slow motion elegante ultra-lusso
   - ⚡ **Dinamico**: Zoom veloce + movimento energetico
   - 🎥 **Cinematico**: Dolly in + parallax Hollywood style

2. **Video più lunghi**: Ora 8 secondi (prima 6)

3. **Logo aziendale**: Aggiungi il tuo logo nel video

4. **Prompt avanzati**: Prompt specifici per ogni stile con controllo preciso

5. **Formato TOML**: Configurazione prompt in formato leggibile

---

## 🎬 5 Stili Video Creativi

### 1. 🎬 Classico
**Ideale per**: E-commerce, cataloghi prodotti, presentazioni professionali

**Cosa fa**:
- Rotazione 360° smooth del prodotto
- Illuminazione studio professionale
- Sfondo elegante minimalista
- Movimento costante e fluido

**Quando usarlo**:
- Quando vuoi mostrare il prodotto da tutti gli angoli
- Per video di catalogo professionale
- Per LinkedIn e presentazioni business

**Durata consigliata**: 6-8 secondi

---

### 2. 💥 Esplosivo
**Ideale per**: Tech, gaming, bevande energetiche, brand giovani

**Cosa fa**:
- Il prodotto ESPLODE in centinaia di particelle
- Le particelle si disperdono con effetti glow
- Tutto si RICOMPONE perfettamente
- Effetti drammatici e dinamici

**Sequenza**:
1. **0-30%**: Prodotto intatto, leggera rotazione
2. **30-50%**: ESPLOSIONE con particelle luminose
3. **50-100%**: Ricomposizione magica del prodotto

**Quando usarlo**:
- Per catturare l'attenzione sui social
- Per prodotti tech e innovativi
- Per TikTok e Instagram Reels energetici

**Durata consigliata**: 8 secondi

---

### 3. ✨ Premium Luxury
**Ideale per**: Moda, gioielli, profumi, orologi, prodotti di lusso

**Cosa fa**:
- Slow motion ultra-elegante
- Movimento dolly + orbit lentissimo
- Illuminazione golden hour
- Sfondo lusso (seta, velluto, oro)
- Bokeh elegante e sparkle

**Atmosfera**:
- Sofisticato e aspirazionale
- Ogni frame = fotografia da rivista di moda
- Enfasi su qualità premium e artigianalità

**Quando usarlo**:
- Per prodotti di alta gamma
- Per brand luxury e fashion
- Per Instagram e campagne premium

**Durata consigliata**: 8 secondi (slow motion richiede più tempo)

---

### 4. ⚡ Dinamico
**Ideale per**: Sport, bevande energetiche, auto, tech giovane

**Cosa fa**:
- Zoom veloce dall'inquadratura larga
- Orbit rapido 180-270°
- Movimenti veloci con cambi di ritmo
- Colori vibranti ad alta saturazione
- Energia da music video

**Sequenza**:
1. **0-25%**: Zoom veloce in avanti
2. **25-60%**: Orbit rapido con angoli dinamici
3. **60-100%**: Push drammatico + rallenty finale

**Quando usarlo**:
- Per prodotti sportivi e energetici
- Per TikTok e target giovane
- Quando serve massima energia visiva

**Durata consigliata**: 6-8 secondi

---

### 5. 🎥 Cinematico
**Ideale per**: Automotive, prodotti premium, storytelling

**Cosa fa**:
- Dolly in professionale stile Hollywood
- Effetto parallax con profondità
- Illuminazione cinematografica drammatica
- Atmosfera da film blockbuster
- Color grading teal & orange

**Produzione Hollywood**:
- Fumo atmosferico per profondità
- Bokeh anamorfic
- Elementi in primo piano e sfondo
- Senso epico anche per piccoli prodotti

**Quando usarlo**:
- Per storytelling e narrativa
- Per prodotti automotive
- Per campagne premium con budget alto

**Durata consigliata**: 8 secondi

---

## ⚙️ Configurazione Video Avanzata

### Durata Video

**6 secondi**:
- Ideale per TikTok e Instagram Reels veloci
- Cattura attenzione rapidamente
- Perfetto per stile "Dinamico"

**8 secondi** ⭐ (CONSIGLIATO):
- Migliore per storytelling
- Più tempo per mostrare dettagli
- Perfetto per "Premium" e "Cinematico"
- Funziona bene su tutte le piattaforme

---

## 🏷️ Logo Aziendale

### Come aggiungere il tuo logo

1. **Attiva opzione**: Spunta "Aggiungi logo aziendale nel video"
2. **Carica logo**: Clicca "📤 Carica Logo PNG/SVG"
3. **Formati supportati**: PNG, SVG, JPG
4. **Dimensioni consigliate**: 512x512px o simile (verrà ridimensionato)

### Posizionamento

- **Posizione**: Angolo in basso a destra
- **Opacità**: 70% (semi-trasparente)
- **Durata**: Ultimi 40% del video
- **Effetto**: Fade in smooth

### Best Practices Logo

✅ **FARE**:
- Logo su sfondo trasparente (PNG)
- Logo semplice e riconoscibile
- Colori contrastanti con il video

❌ **EVITARE**:
- Logo troppo grande o invasivo
- Logo con troppi dettagli
- Logo con testo troppo piccolo

---

## 📝 Formato TOML

### Cos'è TOML?

**TOML** (Tom's Obvious, Minimal Language) è un formato di configurazione:
- ✅ Più leggibile di JSON
- ✅ Più intuitivo da modificare
- ✅ Supporta commenti
- ✅ Struttura gerarchica chiara

### File di configurazione

Tutti i prompt video sono salvati in:
```
config/video-prompts.toml
```

### Esempio struttura TOML

```toml
[styles.classic]
name = "Classico"
emoji = "🎬"
description = "Rotazione prodotto smooth"

[styles.classic.settings]
camera_movement = "360° rotation"
lighting = "studio professionale"
pace = "smooth e costante"

[styles.classic.prompt]
title = "PREMIUM PROFESSIONAL product video"
camera_details = [
    "Smooth 360° rotation",
    "Professional turntable style"
]
```

### Vantaggi

1. **Facile manutenzione**: Modifica prompt senza toccare codice
2. **Versioning**: Traccia modifiche ai prompt
3. **Leggibilità**: Chiunque può leggere e capire
4. **Estendibilità**: Aggiungi nuovi stili facilmente

---

## 📖 Guida Utilizzo

### Workflow Completo

1. **Carica prodotto**
   - Dal catalogo (pulsante verde)
   - Oppure carica foto manualmente

2. **Configura base**
   - Nome prodotto (opzionale)
   - Descrizione (opzionale)
   - Piattaforma social (Instagram, Facebook, TikTok, LinkedIn)

3. **Scegli contenuto**
   - Solo Immagine
   - Solo Video
   - Entrambi ⭐ (consigliato)

4. **Configura video** (se video/entrambi)
   - Scegli uno dei 5 stili
   - Imposta durata (6 o 8 secondi)
   - Aggiungi logo aziendale (opzionale)

5. **Imposta tone & target**
   - Tone: Professional / Casual / Fun / Luxury
   - Target audience (opzionale)

6. **Genera!**
   - 3 agenti AI lavorano in parallelo
   - Copy + Immagine pronti subito
   - Video in 1-3 minuti

7. **Condividi**
   - Usa pulsante "Condividi sui Social 🚀"
   - Oppure download singoli

---

## 🎯 Best Practices

### Per Piattaforma

**Instagram**:
- Stili: Classic, Premium
- Durata: 8 secondi
- Tone: Professional o Luxury
- Hashtags: 5-8 rilevanti

**TikTok**:
- Stili: Explosive, Dynamic
- Durata: 6-8 secondi
- Tone: Fun o Casual
- Cattura attenzione primi 2 secondi

**LinkedIn**:
- Stili: Classic, Cinematic
- Durata: 8 secondi
- Tone: Professional
- CTA chiaro e B2B

**Facebook**:
- Qualsiasi stile
- Durata: 8 secondi
- Tone: Casual o Professional
- Descrizione più lunga

### Per Categoria Prodotto

**Food & Beverage**:
- ✅ Premium, Dynamic, Classic
- ❌ Evita Explosive
- Focus: Freschezza, appetibilità

**Tech & Gadgets**:
- ✅ Dynamic, Explosive, Cinematic
- Focus: Innovazione, design

**Fashion & Accessories**:
- ✅ Premium, Cinematic, Classic
- ❌ Evita Explosive
- Focus: Eleganza, materiali

**Beauty & Cosmetics**:
- ✅ Premium, Classic
- ❌ Evita Explosive, Dynamic
- Focus: Lusso, texture

**Sport & Fitness**:
- ✅ Dynamic, Explosive, Cinematic
- Focus: Energia, performance

**Home & Decor**:
- ✅ Classic, Premium, Cinematic
- ❌ Evita Explosive
- Focus: Ambiente, lifestyle

---

## 🔧 API Reference

### POST `/api/social-ai/generate-marketing`

**Body**:
```typescript
{
  productImage: string;        // base64 (required)
  productName?: string;
  productDescription?: string;
  socialPlatform: 'instagram' | 'facebook' | 'tiktok' | 'linkedin';
  contentType: 'image' | 'video' | 'both';
  tone?: 'professional' | 'casual' | 'fun' | 'luxury';
  targetAudience?: string;

  // 🆕 Nuovi parametri v2.0
  videoStyle?: 'classic' | 'explosive' | 'premium' | 'dynamic' | 'cinematic';
  videoDuration?: 6 | 8;
  companyLogo?: string;        // base64 (opzionale)
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    copywriting: {
      caption: string;
      hashtags: string[];
      cta: string;
    },
    image?: {
      dataUrl: string;
    },
    video?: {
      operationId: string;
      status: 'generating' | 'completed';
      dataUrl?: string;
    },
    metadata: {
      platform: string;
      aspectRatio: string;
      generatedAt: string;
    }
  }
}
```

---

## 🚀 Tips & Tricks

### 1. Combinazioni Vincenti

**Per massima reach Instagram**:
- Stile: Premium
- Durata: 8 secondi
- Tone: Professional
- Logo: Sì
- Target: 25-45 anni professionisti

**Per viralità TikTok**:
- Stile: Explosive o Dynamic
- Durata: 6 secondi
- Tone: Fun
- Target: Gen Z (18-25)

**Per LinkedIn B2B**:
- Stile: Cinematic o Classic
- Durata: 8 secondi
- Tone: Professional
- Logo: Sì (essenziale)
- CTA chiaro verso website

### 2. Testing A/B

Prova diverse combinazioni:
- Stesso prodotto, 2 stili diversi
- Confronta performance
- Analizza engagement rate

### 3. Ottimizzazione Performance

**Copy**:
- Prime 2 parole cruciali
- Emoji strategici (non troppi)
- Domanda o affermazione forte

**Video**:
- Primi 2 secondi = tutto
- Movimento cattura attenzione
- Branding discreto ma presente

**Hashtags**:
- Mix: popolari (100k+) + nicchia (10k)
- 5-8 totali
- Rilevanti al prodotto

---

## 📊 Metriche Consigliate

Traccia queste metriche per ogni post:

- **Reach**: Quante persone lo hanno visto
- **Engagement Rate**: (Like + Commenti + Share) / Reach
- **Watch Time**: % video guardato (obiettivo >80%)
- **CTR**: Click sul link / Impressions
- **Conversion**: Acquisti / Click

**Benchmark**:
- Engagement Rate buono: >3%
- Watch Time buono: >75%
- CTR buono: >2%

---

## 🆘 Troubleshooting

### Video non si genera

**Possibili cause**:
1. API key Veo non configurata
2. Immagine prodotto troppo grande
3. Timeout (>5 minuti)

**Soluzioni**:
1. Verifica `VEO_API_KEY` in `.env`
2. Comprimi immagine (<2MB)
3. Riprova con durata 6 secondi

### Logo non appare nel video

**Nota**: L'integrazione logo è gestita dall'AI e potrebbe non apparire sempre visibilmente. È incluso nelle istruzioni del prompt ma il risultato dipende dal modello Veo.

### Video diverso dall'immagine prodotto

Veo cerca di ricreare il prodotto ma non è sempre identico al 100%. Per migliori risultati:
- Usa foto prodotto su sfondo neutro
- Illuminazione uniforme
- Prodotto ben visibile e centrato

---

## 📞 Supporto

Per domande o problemi:
1. Controlla questa documentazione
2. Verifica `config/video-prompts.toml`
3. Consulta logs del server
4. Contatta il team di sviluppo

---

## 🎓 Credits

- **AI Models**: Google Gemini 2.5 Flash + Veo 3.1
- **Framework**: Next.js + React
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

---

**Buon lavoro con Social Marketing AI Studio v2.0! 🚀**
