# SEO-GEO Optimizer

Sistema RAG locale per ottimizzazione SEO + GEO (Generative Engine Optimization) per LAPA.

## Obiettivo

Dominare sia la ricerca tradizionale (Google SEO) che la ricerca AI (ChatGPT, Perplexity, Claude, Google AI Overviews).

## Installazione

```bash
cd seo-geo-optimizer
npm install
```

## Configurazione

Copia `.env.example` in `.env` e configura:

```env
# API Keys
ANTHROPIC_API_KEY=your-key
OPENAI_API_KEY=your-key

# Odoo
ODOO_URL=https://your-odoo.odoo.com
ODOO_DB=your-db
ODOO_USERNAME=your-user
ODOO_PASSWORD=your-password

# Website
WEBSITE_URL=https://lapa.ch
WEBSITE_NAME=LAPA
```

## Comandi CLI

### Audit SEO + GEO

```bash
# Audit completo (SEO + GEO) su tutti i contenuti
npm run audit

# Solo SEO
npm run audit:seo

# Solo GEO
npm run audit:geo

# Con opzioni
npx tsx src/cli.ts audit --type both --content articles --limit 20 --output report.json
```

### Analisi Singolo Contenuto

```bash
# Analisi dettagliata articolo
npx tsx src/cli.ts analyze 42 --type article

# Analisi dettagliata prodotto
npx tsx src/cli.ts analyze 123 --type product
```

### Ottimizzazione

```bash
# Ottimizza un articolo
npx tsx src/cli.ts optimize 42 --type article --what all

# Ottimizza solo title e description
npx tsx src/cli.ts optimize 42 --type article --what title

# Applica modifiche a Odoo
npx tsx src/cli.ts optimize 42 --type article --apply
```

### Sincronizzazione RAG

```bash
# Sincronizza tutti i contenuti nel database RAG locale
npm run sync

# Solo articoli
npx tsx src/cli.ts sync --type articles

# Solo prodotti
npx tsx src/cli.ts sync --type products
```

### Ricerca RAG

```bash
# Cerca contenuti simili
npm run search "formaggi italiani"

# Con filtro tipo
npx tsx src/cli.ts search "mozzarella" --type product --limit 10
```

## Architettura

```
seo-geo-optimizer/
├── src/
│   ├── agents/
│   │   ├── base-agent.ts        # Classe base agenti
│   │   ├── seo-analyzer.ts      # Agente analisi SEO
│   │   ├── geo-analyzer.ts      # Agente analisi GEO
│   │   └── content-optimizer.ts # Agente ottimizzazione
│   ├── rag/
│   │   ├── embedding-service.ts # Gestione embeddings
│   │   └── content-processor.ts # Elaborazione contenuti
│   ├── connectors/
│   │   └── odoo.ts              # Connettore Odoo XML-RPC
│   ├── utils/
│   │   └── config.ts            # Gestione configurazione
│   ├── cli.ts                   # CLI principale
│   └── index.ts                 # Export moduli
├── config/
│   ├── seo-rules.ts             # Regole SEO
│   └── geo-rules.ts             # Regole GEO
├── data/
│   ├── embeddings/              # Database embeddings locale
│   ├── reports/                 # Report generati
│   └── cache/                   # Cache dati
└── scripts/                     # Script utility
```

## Metriche SEO Analizzate

| Categoria | Metriche |
|-----------|----------|
| Title | Lunghezza, keyword, formato brand |
| Description | Lunghezza, keyword, CTA |
| Content | Word count, heading structure, keyword density |
| Technical | Canonical, hreflang, sitemap, robots |
| Structured Data | Schema.org (Product, Article, etc.) |
| Social | Open Graph, Twitter Cards |

## Metriche GEO Analizzate

| Categoria | Metriche |
|-----------|----------|
| Struttura | Blocchi <800 token, auto-contenuti |
| Autorevolezza | Statistiche, citazioni, brand mention |
| Formattazione | Liste, Q&A, frasi segnale |
| Citabilità | Passaggi quotabili, insights unici |
| AI Readiness | Simulazione risposta AI |

## Score e Gradi

### SEO Score
- **A (90-100)**: Eccellente
- **B (75-89)**: Buono
- **C (60-74)**: Medio
- **D (40-59)**: Scarso
- **F (0-39)**: Critico

### GEO Score
- **AI-Ready (85+)**: Pronto per essere citato dall'AI
- **Needs Work (50-84)**: Richiede ottimizzazioni
- **Not Optimized (<50)**: Non ottimizzato per AI

## Workflow Consigliato

1. **Audit iniziale**: `npm run audit` per valutare stato attuale
2. **Sync RAG**: `npm run sync` per indicizzare contenuti
3. **Analisi dettagliata**: `analyze` sui contenuti con score basso
4. **Ottimizzazione**: `optimize` per generare versioni migliorate
5. **Verifica**: Re-audit per verificare miglioramenti
6. **Applicazione**: `--apply` per salvare su Odoo

## Uso Programmatico

```typescript
import { seoAnalyzer, geoAnalyzer, runAudit } from 'seo-geo-optimizer';

// Audit completo
const results = await runAudit({
  type: 'both',
  contentType: 'articles',
  limit: 50,
});

// Analisi singola
const seoResult = await seoAnalyzer.execute({
  task: 'SEO Audit',
  data: {
    title: 'Il mio articolo',
    content: '<p>Contenuto...</p>',
    meta_title: 'Title SEO',
    meta_description: 'Description...',
    keywords: ['keyword1', 'keyword2'],
    content_type: 'article',
  },
  history: [],
});
```

## TODO / Roadmap

- [ ] Dashboard web per visualizzare report
- [ ] Scheduler per audit automatici
- [ ] Integrazione Google Search Console
- [ ] Monitoraggio ranking keywords
- [ ] A/B testing contenuti ottimizzati
- [ ] Export PDF report

## Licenza

Proprietario - LAPA
