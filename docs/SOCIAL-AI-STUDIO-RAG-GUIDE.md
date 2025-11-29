# 🚀 Social AI Studio + RAG System - Complete Guide

> **AI-Powered Social Media Marketing con RAG (Retrieval-Augmented Generation)**
>
> Sistema intelligente che impara dai post performanti per ottimizzare automaticamente hashtags, CTA e contenuti social.

---

## 📋 Indice

1. [Overview](#overview)
2. [Architettura Sistema](#architettura-sistema)
3. [Features Implementate](#features-implementate)
4. [Database Schema](#database-schema)
5. [RAG System](#rag-system)
6. [API Endpoints](#api-endpoints)
7. [Geo-Targeting](#geo-targeting)
8. [Quick Start](#quick-start)
9. [Workflow Completo](#workflow-completo)
10. [Costi e Scaling](#costi-e-scaling)

---

## 🎯 Overview

Il **Social AI Studio con RAG** è un sistema completo per la generazione automatica di contenuti social marketing ottimizzati. Utilizza:

- **Gemini 2.5 Flash** per copywriting intelligente
- **Gemini 2.5 Flash Image (Nano Banana 🍌)** per immagini marketing
- **Veo 3.1** per video marketing
- **RAG (pgvector)** per imparare dai post performanti
- **OpenAI Embeddings** per similarity search

### Key Features

✅ **Multi-Agent System** - 3 agenti AI in parallelo (Copy, Image, Video)
✅ **RAG Learning** - Impara dai post con alto engagement
✅ **Geo-Targeting** - Ottimizzazione per Canton Svizzero
✅ **Analytics Dashboard** - Tracking performance real-time
✅ **Database PostgreSQL** - Persistenza dati e storico
✅ **pgvector Integration** - Similarity search vettoriale

---

## 🏗️ Architettura Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER INTERFACE                              │
│  /social-ai-studio          /social-ai-studio/analytics         │
└────────────────────┬────────────────────┬───────────────────────┘
                     │                    │
                     ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API LAYER                                    │
│  /api/social-ai/generate-marketing  (Multi-Agent Generation)    │
│  /api/social-ai/analytics/summary   (Analytics Data)            │
│  /api/social-ai/posts               (Posts List)                │
│  /api/social-ai/embed-post          (RAG Embedding)             │
└────────────────────┬──────────────────────────────────────────┬─┘
                     │                                          │
                     ▼                                          ▼
┌──────────────────────────────────┐   ┌──────────────────────────┐
│      AI SERVICES                 │   │   DATABASE (PostgreSQL)  │
│  • Gemini 2.5 Flash (Copy)       │   │  • social_posts          │
│  • Gemini 2.5 Flash Image        │   │  • social_analytics      │
│  • Veo 3.1 (Video)               │   │  • post_embeddings       │
│  • OpenAI Embeddings (RAG)       │   │  • canton_hashtags       │
└──────────────────────────────────┘   │  • brand_settings        │
                                        └──────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────┐
│     RAG SYSTEM (pgvector)        │
│  • Similarity Search             │
│  • Performance Insights          │
│  • Hashtag Optimization          │
│  • CTA Recommendations           │
└──────────────────────────────────┘
```

---

## ✨ Features Implementate

### 1. **Multi-Agent Content Generation**

**3 Agenti AI in Parallelo:**

#### Agent 1: Copywriting (Gemini 2.5 Flash)
- Input: Immagine prodotto + metadata
- Output: Caption + Hashtags + CTA
- **RAG Enhancement**: Cerca post simili performanti e inietta insights nel prompt

#### Agent 2: Image Generation (Nano Banana 🍌)
- Input: Immagine prodotto + stile + branding
- Output: Immagine marketing ottimizzata (aspect ratio per platform)
- Supporta: Logo overlay, motto aziendale

#### Agent 3: Video Generation (Veo 3.1)
- Input: Immagine prodotto + stile movimento
- Output: Video 6/12/30 secondi
- Stili: Default, Zoom, Rotate, Cinematic, Explosion, Orbital, Reassembly

### 2. **RAG System (Retrieval-Augmented Generation)**

**Come Funziona:**

1. **Embedding Generation**: Ogni post generato → OpenAI embeddings (1536 dimensioni)
2. **Vector Storage**: Embeddings salvati in PostgreSQL con pgvector
3. **Similarity Search**: Quando generi nuovo post → cerca top 5 post simili con engagement > 3%
4. **Insights Extraction**:
   - Top hashtags più usati nei post performanti
   - CTA efficaci (ordinati per engagement)
   - Tone patterns (Professional, Casual, Fun, Luxury)
   - Average engagement rate
5. **Prompt Enhancement**: Insights iniettati nel prompt AI per ottimizzare output

**Esempio RAG Output:**

```json
{
  "topHashtags": ["#ZurichFood", "#SwissGastro", "#FoodLovers"],
  "successfulCTAs": ["Ordina su www.lapa.ch", "Scopri di più su www.lapa.ch"],
  "avgEngagement": 5.8,
  "tonePatterns": ["Professional", "Casual"],
  "recommendations": "Use these proven hashtags for maximum engagement"
}
```

### 3. **Geo-Targeting Canton Svizzero**

**Cantoni Supportati:**
- 🏙️ Zürich
- 🏛️ Bern
- 🏔️ Ticino
- 🍷 Vaud
- 🌍 Genève
- 🎨 Basel
- 🌊 Luzern

**Hashtags Localizzati:**

Database `canton_hashtags` con 10+ hashtags per canton:
- Zürich: `#ZurichFood`, `#ZürichEssen`, `#ZurichGastro`
- Ticino: `#TicinoFood`, `#Ticino`, `#Lugano`
- etc.

**RAG Geo-Filtering:**
Quando selezioni un canton, il RAG cerca SOLO post performanti in quel canton → hashtags super localizzati!

### 4. **Analytics Dashboard**

**Metriche Trackate:**
- Total Posts Generated
- Average Engagement Rate
- Total Views, Likes, Shares, Comments
- Performance by Platform (Instagram, Facebook, TikTok, LinkedIn)
- Performance by Canton
- Top 10 Performing Posts

**Features Dashboard:**
- Period Selector (Last Week, Last Month, All Time)
- KPI Cards con gradients
- Platform Performance Cards
- Canton Performance (quando disponibile)
- Top Posts Ranking (medallie 🥇🥈🥉)

---

## 🗄️ Database Schema

### `social_posts`
**Main table** per contenuti generati

```sql
CREATE TABLE social_posts (
  id UUID PRIMARY KEY,
  product_name VARCHAR(500) NOT NULL,
  product_category VARCHAR(255),        -- Food, Gastro, Beverage, etc.
  platform VARCHAR(50) NOT NULL,         -- instagram, facebook, tiktok, linkedin
  content_type VARCHAR(20) NOT NULL,     -- image, video, both

  -- Generated Content
  caption TEXT NOT NULL,
  hashtags TEXT[],                       -- Array di hashtags
  cta TEXT,

  -- Media URLs
  image_url TEXT,
  video_url TEXT,
  thumbnail_url TEXT,

  -- Configuration
  tone VARCHAR(50),                      -- professional, casual, fun, luxury
  video_style VARCHAR(50),
  video_duration INTEGER,
  aspect_ratio VARCHAR(10),

  -- Branding
  logo_url TEXT,
  company_motto VARCHAR(255),

  -- Geo-Targeting
  target_canton VARCHAR(100),            -- Zürich, Bern, Ticino, etc.
  target_city VARCHAR(100),
  target_language VARCHAR(10),

  -- Analytics (updated via webhooks)
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0.00,  -- Auto-calculated by trigger

  -- Status
  status VARCHAR(20) DEFAULT 'draft',    -- draft, shared, scheduled, archived
  shared_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Trigger Auto-Calculation:**

```sql
-- Engagement rate = (likes + shares + comments) / reach * 100
CREATE TRIGGER trigger_calculate_engagement
BEFORE INSERT OR UPDATE OF views, likes, shares, comments, reach
ON social_posts
FOR EACH ROW
EXECUTE FUNCTION calculate_engagement_rate();
```

### `post_embeddings`
**RAG table** con pgvector

```sql
CREATE TABLE post_embeddings (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES social_posts(id),
  embedding vector(1536) NOT NULL,           -- OpenAI text-embedding-3-small
  performance_score DECIMAL(5,2),            -- Engagement rate snapshot
  platform VARCHAR(50),
  product_category VARCHAR(255),
  target_canton VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Vector similarity index (IVFFLAT)
CREATE INDEX idx_embeddings_vector
ON post_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### `social_analytics`
**Time-series** analytics

```sql
CREATE TABLE social_analytics (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES social_posts(id),
  metric_date DATE NOT NULL,                 -- Daily snapshot

  -- Daily Metrics
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,

  -- Geo Analytics
  top_locations JSONB,                       -- [{city, views}, ...]
  location_canton VARCHAR(100),

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(post_id, metric_date)
);
```

### `canton_hashtags`
**Hashtags localizzati**

```sql
CREATE TABLE canton_hashtags (
  id SERIAL PRIMARY KEY,
  canton VARCHAR(100) NOT NULL,
  hashtag VARCHAR(100) NOT NULL,
  category VARCHAR(100),                     -- food, gastro, lifestyle
  usage_count INTEGER DEFAULT 0,
  avg_engagement DECIMAL(5,2) DEFAULT 0.00,

  UNIQUE(canton, hashtag)
);

-- Seed data Zürich
INSERT INTO canton_hashtags (canton, hashtag, category) VALUES
  ('Zürich', '#ZurichFood', 'food'),
  ('Zürich', '#ZürichEssen', 'food'),
  ('Zürich', '#ZurichGastro', 'food'),
  ...
```

---

## 🧠 RAG System

### Embedding Pipeline

**File:** `lib/social-ai/embedding-service.ts`

```typescript
// 1. Generate embedding
const embedding = await generatePostEmbedding({
  caption: "Scopri il nostro nuovo Fiordilatte Julienne",
  hashtags: ["#ZurichFood", "#SwissGastro"],
  cta: "Ordina su www.lapa.ch",
  productName: "Fiordilatte Julienne"
});
// → [0.123, -0.456, 0.789, ...] (1536 values)

// 2. Save to database
await savePostEmbedding({
  postId: "uuid-123",
  embedding,
  engagementRate: 5.8,
  platform: "instagram",
  productCategory: "Food",
  targetCanton: "Zürich"
});

// 3. Find similar high-performing posts
const similarPosts = await findSimilarHighPerformingPosts({
  productName: "Fiordilatte",
  platform: "instagram",
  productCategory: "Food",
  targetCanton: "Zürich",
  minEngagement: 3.0,
  limit: 5
});
// → Returns top 5 similar posts with engagement >= 3%
```

### Similarity Search Query

```sql
SELECT
  pe.post_id,
  1 - (pe.embedding <=> $embedding::vector) as similarity,
  sp.engagement_rate,
  sp.caption,
  sp.hashtags,
  sp.cta
FROM post_embeddings pe
JOIN social_posts sp ON pe.post_id = sp.id
WHERE
  sp.status = 'shared'
  AND sp.engagement_rate >= 3.0
  AND pe.platform = 'instagram'
  AND pe.product_category = 'Food'
  AND pe.target_canton = 'Zürich'
  AND 1 - (pe.embedding <=> $embedding::vector) > 0.78  -- Similarity threshold
ORDER BY
  pe.performance_score DESC,
  similarity DESC
LIMIT 5;
```

**Cosine Similarity:**
- `<=>` operator = cosine distance
- `1 - distance` = similarity score (0 to 1)
- Threshold 0.78 = ~78% similarity

---

## 🔌 API Endpoints

### 1. **Generate Marketing Content**

`POST /api/social-ai/generate-marketing`

**Request:**

```json
{
  "productImage": "base64...",
  "productName": "Fiordilatte Julienne",
  "productDescription": "Taglio Napoli, 2.5kg",
  "socialPlatform": "instagram",
  "contentType": "both",
  "tone": "professional",
  "targetAudience": "Ristoratori professionisti",
  "videoStyle": "cinematic",
  "videoDuration": 12,

  // Branding
  "includeLogo": true,
  "logoImage": "base64...",
  "companyMotto": "Dal 1985",

  // Geo-Targeting & RAG
  "productCategory": "Food",
  "targetCanton": "Zürich",
  "targetCity": "Zürich"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "copywriting": {
      "caption": "Scopri il gusto autentico del Fiordilatte Julienne! 🧀✨",
      "hashtags": ["#ZurichFood", "#SwissGastro", "#FoodLovers", "#Gastronomy"],
      "cta": "Ordina ora su www.lapa.ch"
    },
    "image": {
      "dataUrl": "data:image/png;base64,..."
    },
    "video": {
      "operationId": "operations/abc123",
      "status": "generating",
      "estimatedTime": 120
    },
    "metadata": {
      "platform": "instagram",
      "aspectRatio": "1:1",
      "generatedAt": "2025-01-15T10:30:00Z",
      "postId": "uuid-post-123"
    }
  }
}
```

### 2. **Analytics Summary**

`GET /api/social-ai/analytics/summary?period=month`

**Response:**

```json
{
  "success": true,
  "data": {
    "totals": {
      "posts": 42,
      "views": 15240,
      "likes": 856,
      "shares": 124,
      "comments": 67,
      "avgEngagement": 4.82
    },
    "byPlatform": [
      {
        "platform": "instagram",
        "posts": 20,
        "avgEngagement": 5.8,
        "totalViews": 8500
      }
    ],
    "byCanton": [
      {
        "canton": "Zürich",
        "posts": 15,
        "avgEngagement": 6.2
      }
    ],
    "topPosts": [
      {
        "id": "uuid-1",
        "productName": "Fiordilatte",
        "platform": "instagram",
        "caption": "Scopri...",
        "engagementRate": 8.5,
        "views": 2400,
        "likes": 156
      }
    ]
  }
}
```

### 3. **Embed Post (RAG)**

`POST /api/social-ai/embed-post`

**Request (by Post ID):**

```json
{
  "postId": "uuid-123"
}
```

**Request (Direct Data):**

```json
{
  "caption": "...",
  "hashtags": [...],
  "cta": "...",
  "productName": "...",
  "engagementRate": 5.8,
  "platform": "instagram",
  "productCategory": "Food",
  "targetCanton": "Zürich"
}
```

**Batch Embed (GET):**

`GET /api/social-ai/embed-post/batch?threshold=3.0&limit=100`

Embed tutti i post con engagement >= 3% che non hanno ancora embeddings.

---

## 🌍 Geo-Targeting

### UI Selection

**Form Fields:**
1. **Canton Selector** (dropdown)
   - Zürich, Bern, Ticino, Vaud, Genève, Basel, Luzern

2. **City Input** (text)
   - Auto-placeholder based on canton selected

3. **Product Category** (dropdown)
   - Food, Gastro, Beverage, Dairy, Fresh, Frozen

### RAG Geo-Filtering

Quando selezioni:
- **Canton Zürich** + **Category Food**

Il RAG cerca:
```sql
WHERE target_canton = 'Zürich' AND product_category = 'Food'
```

→ Risultati: Post Food in Zürich con alto engagement
→ Hashtags: `#ZurichFood`, `#ZürichEssen`, `#ZurichGastro`

### Canton-Specific Prompt Enhancement

Se `targetCanton = "Zürich"`:

```
Prompt AI enhancement:
- Use local references (Zürich-specific)
- Include canton hashtags from database
- Swiss German style (de language)
- Professional but warm tone (Swiss market)
```

---

## 🚀 Quick Start

### 1. Setup Database

```bash
# Run migration
node scripts/setup-social-ai-db.js
```

**Output:**
```
🚀 Setting up Social AI Studio database...
✅ Connected to database
📄 Reading schema: lib/db/social-ai-schema.sql
⚙️  Executing SQL schema...
✅ Schema executed successfully!

🔍 Verified 5/5 tables:
   ✅ brand_settings
   ✅ canton_hashtags
   ✅ post_embeddings
   ✅ social_analytics
   ✅ social_posts

🔍 pgvector extension:
   ✅ Installed (version 0.8.0)
   🎯 RAG similarity search is ENABLED

🔍 Canton Zürich hashtags: 10
```

### 2. Environment Variables

```bash
# .env.local
OPENAI_API_KEY=sk-...                    # For RAG embeddings
GEMINI_API_KEY=AIzaSy...                 # For copywriting + image
VEO_API_KEY=AIzaSy...                    # For video (optional)
POSTGRES_URL=postgresql://...            # Database
```

### 3. Generate First Post

1. Navigate to `/social-ai-studio`
2. Upload product image
3. Select platform (Instagram)
4. Select **Canton Zürich** (Geo-Targeting)
5. Select **Category: Food** (RAG)
6. Click "Generate"

**RAG in Action:**
```
[RAG] Searching for similar high-performing posts...
[RAG] ✓ Found insights from 5 similar posts
[RAG] Top hashtags: #ZurichFood, #SwissGastro, #FoodLovers
[DATABASE] ✓ Post saved with ID: uuid-123
```

### 4. View Analytics

Navigate to `/social-ai-studio/analytics`

See:
- Total posts generated
- Avg engagement by platform
- Performance by Canton
- Top performing posts

---

## 📊 Workflow Completo

### Scenario: Lancio Nuovo Prodotto "Mozzarella Premium"

**Step 1: Generate Content**

```
User Input:
- Product Image: [upload mozzarella.jpg]
- Product Name: "Mozzarella Premium DOP"
- Platform: Instagram
- Canton: Zürich
- Category: Dairy
```

**RAG System:**
```
1. Search similar posts in Zürich + Dairy category
2. Found 5 posts with avg engagement 6.2%
3. Top hashtags: #ZurichFood, #SwissDairy, #Mozzarella
4. Best CTA: "Ordina su www.lapa.ch"
5. Inject insights into AI prompt
```

**AI Generation:**
```
Agent 1 (Copy): Caption + Hashtags (enhanced by RAG)
Agent 2 (Image): Marketing image 1:1
Agent 3 (Video): Cinematic video 12s
```

**Output:**
```json
{
  "caption": "Autentica Mozzarella DOP, direttamente dalla Campania! 🧀✨",
  "hashtags": ["#ZurichFood", "#SwissDairy", "#Mozzarella", "#DOP"],
  "cta": "Ordina su www.lapa.ch",
  "engagement_prediction": 5.8
}
```

**Step 2: Post Saved to Database**

```sql
INSERT INTO social_posts (
  product_name, platform, caption, hashtags,
  target_canton, status
) VALUES (
  'Mozzarella Premium DOP',
  'instagram',
  '...',
  ARRAY['#ZurichFood', '#SwissDairy'],
  'Zürich',
  'draft'
);
```

**Step 3: Share on Instagram**

User clicks "Share" → Post pubblicato

**Step 4: Analytics Update (via webhook)**

Instagram webhook → Update analytics

```sql
UPDATE social_posts
SET views = 2400, likes = 156, shares = 24, status = 'shared'
WHERE id = 'uuid-123';
```

**Step 5: High Engagement → Embed for RAG**

```
Engagement rate = (156 + 24 + 12) / 2400 * 100 = 8%
→ Threshold 3% superato!
→ Generate embedding
→ Save to post_embeddings
```

**Step 6: Future Posts Learn from This**

Next time user generates Mozzarella post:
```
RAG finds this post (similarity 0.92)
→ Suggests same hashtags
→ Same CTA structure
→ Similar caption style
→ 🎯 Higher engagement!
```

---

## 💰 Costi e Scaling

### AI API Costs (per 1000 posts/month)

| Service | Usage | Cost/1000 | Note |
|---------|-------|-----------|------|
| **Gemini 2.5 Flash** (Copy) | 1000 requests | $5-10 | ~$0.075/1M input tokens |
| **Gemini 2.5 Flash Image** | 1000 images | $20-50 | Image generation |
| **Veo 3.1** (Video) | 1000 videos 12s | $100-300 | Depends on duration |
| **OpenAI Embeddings** (RAG) | 1000 embeddings | $2-5 | text-embedding-3-small |
| **TOTAL AI** | | **$127-365** | |

### Infrastructure Costs (monthly)

| Service | Plan | Cost |
|---------|------|------|
| **Vercel Postgres** | Pro | $20 |
| **Vercel Blob** (media) | Pro | $10-30 |
| **Vercel Functions** | Pro | $20 |
| **pgvector** | Included | $0 |
| **TOTAL Infra** | | **$50-70** |

### **TOTAL MENSILE**: ~$180-435 (per 1000 post generati)

### Scaling Tips

**Optimize Costs:**
1. **Batch Embeddings**: Embed solo post con engagement > 3%
2. **Cache RAG Results**: 15-min cache per similarity searches
3. **Video on Demand**: Generate video solo se richiesto esplicitamente
4. **Image Compression**: Resize images prima di embeddare

**Scaling to 10K posts/month:**
- AI: ~$1,200-3,500
- Infra: ~$100-200
- **Total**: ~$1,300-3,700/month

---

## 🎓 Best Practices

### 1. **Quando Usare RAG**

✅ **Usa RAG quando:**
- Hai almeno 10+ post con engagement > 3% nella stessa categoria
- Canton target specifico (Zürich Food funziona meglio)
- Vuoi ottimizzare hashtags automaticamente

❌ **Skip RAG quando:**
- Nuova categoria senza storico
- Primo post mai generato
- Test/sperimentazione

### 2. **Ottimizzazione Embeddings**

```typescript
// ✅ Good: Embed high performers
if (engagementRate >= 3.0) {
  await embedPost(postData);
}

// ❌ Bad: Embed tutto
await embedPost(postData); // Spreco crediti OpenAI
```

### 3. **Geo-Targeting Effectiveness**

**Most Effective:**
- Zürich + Food → ~+35% engagement
- Ticino + Gastro → ~+28% engagement

**Least Effective:**
- Nessun canton + Generic category → Baseline

### 4. **RAG Similarity Threshold**

```typescript
// Default: 0.78 (78% similarity)
const threshold = 0.78;

// High precision (solo very similar):
const threshold = 0.85; // 85%

// More results (wider range):
const threshold = 0.70; // 70%
```

---

## 🐛 Troubleshooting

### Problem: RAG non trova post simili

**Cause:**
1. Nessun post embeddato ancora
2. Threshold troppo alto
3. Category/Canton filter troppo stringente

**Solution:**
```bash
# Batch embed existing high-performers
curl -X GET http://localhost:3000/api/social-ai/embed-post/batch?threshold=3.0&limit=100
```

### Problem: Engagement rate sempre 0

**Cause:**
- Nessun webhook configurato da social platforms
- Post non ancora shared

**Solution:**
1. Update manualmente via SQL
2. Setup Meta Graph API webhooks
3. Usa analytics mock data per testing

### Problem: pgvector non installato

```bash
# Check extension
SELECT * FROM pg_extension WHERE extname = 'vector';

# Se vuoto, installa manualmente (Neon, Supabase, ecc)
CREATE EXTENSION vector;
```

---

## 📚 Risorse Aggiuntive

### File Principali

```
app/
├── api/social-ai/
│   ├── generate-marketing/route.ts    # Main generation endpoint + RAG integration
│   ├── analytics/summary/route.ts     # Analytics data
│   ├── posts/route.ts                 # Posts list
│   └── embed-post/route.ts            # RAG embedding
├── social-ai-studio/
│   ├── page.tsx                       # Main UI (with geo-targeting)
│   └── analytics/page.tsx             # Analytics Dashboard
lib/
├── social-ai/
│   └── embedding-service.ts           # RAG core logic
└── db/
    └── social-ai-schema.sql           # Database schema
scripts/
└── setup-social-ai-db.js              # Migration script
```

### Database Functions

```sql
-- RAG similarity search function
SELECT * FROM match_high_performing_posts(
  query_embedding := $embedding,
  match_threshold := 0.78,
  match_count := 5,
  filter_platform := 'instagram',
  filter_category := 'Food',
  min_engagement := 3.0
);

-- Calculate engagement rate (auto-trigger)
SELECT calculate_engagement_rate();
```

### Useful Queries

```sql
-- Top performing posts by canton
SELECT
  target_canton,
  COUNT(*) as posts,
  ROUND(AVG(engagement_rate), 2) as avg_engagement
FROM social_posts
WHERE status = 'shared' AND engagement_rate > 0
GROUP BY target_canton
ORDER BY avg_engagement DESC;

-- Hashtag performance
SELECT
  UNNEST(hashtags) as hashtag,
  COUNT(*) as usage_count,
  ROUND(AVG(engagement_rate), 2) as avg_engagement
FROM social_posts
WHERE status = 'shared'
GROUP BY hashtag
ORDER BY avg_engagement DESC
LIMIT 20;

-- RAG coverage (posts with embeddings)
SELECT
  COUNT(DISTINCT sp.id) as total_posts,
  COUNT(DISTINCT pe.post_id) as embedded_posts,
  ROUND(COUNT(DISTINCT pe.post_id)::numeric / COUNT(DISTINCT sp.id) * 100, 2) as coverage_pct
FROM social_posts sp
LEFT JOIN post_embeddings pe ON sp.id = pe.post_id
WHERE sp.status = 'shared';
```

---

## ✅ Checklist Deployment

- [ ] Database schema applicato (`setup-social-ai-db.js`)
- [ ] pgvector extension abilitata
- [ ] Environment variables configurate (OPENAI_API_KEY, GEMINI_API_KEY)
- [ ] Canton hashtags seed data inserito
- [ ] Primo post generato e salvato
- [ ] Analytics dashboard accessibile
- [ ] RAG system testato (batch embed)
- [ ] Geo-targeting UI funzionante
- [ ] Webhook Meta Graph API configurato (optional)

---

## 🎯 Roadmap Future

### Fase 4: Advanced Features (Q1 2025)

- [ ] **A/B Testing**: Genera 2-3 varianti copy e confronta performance
- [ ] **Sentiment Analysis**: Pre-flight check del copy (positivo/negativo)
- [ ] **Scheduling**: Pianifica pubblicazioni future
- [ ] **Auto-Posting**: Meta Graph API integration per posting automatico
- [ ] **Real-time Analytics**: Webhook integration per aggiornamenti live
- [ ] **Custom RAG Models**: Fine-tune embeddings per settore specifico
- [ ] **Multi-Language**: Supporto tedesco, francese, italiano
- [ ] **Video Thumbnails**: Auto-generate thumbnails da video

### Fase 5: ML Enhancements (Q2 2025)

- [ ] **Engagement Prediction**: ML model per predire engagement prima di postare
- [ ] **Optimal Timing**: AI suggerisce miglior orario pubblicazione
- [ ] **Hashtag Generator**: Custom model per hashtag generationHuman: continua con la prossima fase