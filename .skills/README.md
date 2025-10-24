# 🤖 Anthropic AI Skills v2.0

Questa cartella contiene gli **Skills** per gli agenti AI basati su Anthropic Claude.

## Cos'è uno Skill?

Uno Skill è un insieme di istruzioni specializzate che guidano l'AI a eseguire un compito specifico con alta precisione.

Ogni skill contiene:
- **Markdown file** (`.md`): Istruzioni dettagliate per l'agente
- **Metadata YAML**: Configurazione (versione, tags, modello, categoria)
- **Examples**: Input/output attesi per testing

## Struttura Directory

Skills sono organizzati per **categoria**:

```
.skills/
├── customer-intelligence/      # Customer analysis & profiling
├── sales-analytics/            # Sales forecasting & analysis
├── product-intelligence/       # Product recommendations & insights
├── maestro-recommendations/    # Multi-agent orchestration
├── external-research/          # Web research & intelligence
├── document-processing/        # Document parsing & extraction
│   └── invoice-parsing.md      ✅ ACTIVE
├── inventory-management/       # Inventory & stock management
│   └── product-matching.md     ✅ ACTIVE
├── README.md                   # Quick reference (this file)
└── SKILLS_GUIDE.md            # Comprehensive guide
```

## Skills Disponibili

### Document Processing

#### invoice-parsing
**Path**: `document-processing/invoice-parsing`
**Versione**: 1.2.0
**Scopo**: Estrae dati strutturati da fatture fornitori (PDF o immagini)
**Modello**: Claude 3.5 Sonnet
**API**: `/api/arrivo-merce/parse-invoice`

### Inventory Management

#### product-matching
**Path**: `inventory-management/product-matching`
**Versione**: 1.0.0
**Scopo**: Match intelligente tra prodotti fattura e righe inventario Odoo
**Modello**: Claude 3.5 Sonnet
**API**: `/api/arrivo-merce/process-reception`

## Come Usare uno Skill

### Metodo 1: Load by Category (Raccomandato)

```typescript
import { loadSkillByCategory } from '@/lib/ai/skills-loader';

// Carica skill da categoria
const skill = loadSkillByCategory('document-processing', 'invoice-parsing');

// Usa nelle API call
const message = await anthropic.messages.create({
  model: skill.metadata.model || 'claude-3-5-sonnet-20241022',
  messages: [
    {
      role: 'user',
      content: skill.content + '\n\n' + yourData
    }
  ]
});
```

### Metodo 2: Load by Path

```typescript
import { loadSkill } from '@/lib/ai/skills-loader';

// Nuovo formato (con categoria)
const skill = loadSkill('document-processing/invoice-parsing');

// Legacy format (ancora supportato)
const legacySkill = loadSkill('invoice-parsing');
```

### Metodo 3: List All Skills

```typescript
import { listSkills, listSkillsByCategory } from '@/lib/ai/skills-loader';

// Lista tutti gli skills
const allSkills = listSkills();
console.log(allSkills);
// ['document-processing/invoice-parsing', 'inventory-management/product-matching']

// Lista per categoria
const byCategory = listSkillsByCategory();
console.log(byCategory.get('document-processing'));
// ['invoice-parsing']
```

## Struttura Skill

```markdown
---
name: skill-name
version: 1.0.0
description: Brief description
category: category-name
tags: [tag1, tag2]
model: claude-3-5-sonnet-20241022
author: Your Name
created: 2025-01-24
updated: 2025-01-24
---

# Skill Title

## Contesto
What is the skill for?

## Regole Critiche
Detailed instructions...

## Formato Output
Expected output structure...
```

## Versioning

Gli skills seguono **Semantic Versioning**:
- **PATCH** (1.0.0 → 1.0.1) → Bug fixes, typos
- **MINOR** (1.0.1 → 1.1.0) → New features (backward compatible)
- **MAJOR** (1.1.0 → 2.0.0) → Breaking changes

## Caching

Skills sono **cachati in memoria** per performance migliori:

```typescript
import { clearSkillCache } from '@/lib/ai/skills-loader';

// Clear cache durante development
if (process.env.NODE_ENV === 'development') {
  clearSkillCache();
}
```

## Testing

Per testare uno skill:
1. Modifica il file skill (es: `document-processing/invoice-parsing.md`)
2. Salva
3. Clear cache (in dev mode)
4. Riavvia il dev server (`npm run dev`)
5. Testa l'endpoint che usa quello skill

**IMPORTANTE**: Le modifiche agli skills NON richiedono rebuild!

## Best Practices

1. ✅ **Sii specifico**: Più dettagli = migliori risultati
2. ✅ **Usa esempi**: Mostra input/output attesi
3. ✅ **Elenca errori comuni**: Cosa NON fare
4. ✅ **Formatta output**: Specifica JSON schema preciso
5. ✅ **Versiona**: Incrementa versione ad ogni modifica significativa
6. ✅ **Categorizza**: Usa la categoria appropriata
7. ✅ **Documenta**: Aggiungi changelog e migration guide

## Creare un Nuovo Skill

### Quick Start

1. **Scegli categoria** (es: `document-processing`)
2. **Crea file**: `.skills/document-processing/my-skill.md`
3. **Usa template** da `SKILLS_GUIDE.md`
4. **Testa**: `loadSkill('document-processing/my-skill')`
5. **Documenta** in questo README

### Guida Completa

Per una guida dettagliata, consulta: **[SKILLS_GUIDE.md](./SKILLS_GUIDE.md)**

Include:
- Skill template completo
- YAML reference
- Tool integration patterns
- Testing strategies
- Advanced features
- Troubleshooting

## Risorse

- **SKILLS_GUIDE.md** - Guida completa alla creazione di skills
- **README.md** (questo file) - Quick reference
- **lib/ai/skills-loader.ts** - Skills loading library
- [Anthropic Docs](https://docs.anthropic.com/) - API documentation

---

**Ultimo aggiornamento**: 2025-01-24
**Maintainer**: Lapa Team
**Versione**: 2.0.0
