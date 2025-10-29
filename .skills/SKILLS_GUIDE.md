# Anthropic Skills Development Guide

## Table of Contents

1. [Overview](#overview)
2. [Skill Categories](#skill-categories)
3. [Creating a New Skill](#creating-a-new-skill)
4. [Skill Template](#skill-template)
5. [YAML Frontmatter Reference](#yaml-frontmatter-reference)
6. [Tool Integration Best Practices](#tool-integration-best-practices)
7. [Testing Skills](#testing-skills)
8. [Versioning Guidelines](#versioning-guidelines)
9. [Advanced Features](#advanced-features)
10. [Troubleshooting](#troubleshooting)

---

## Overview

**Skills** are specialized instruction sets that guide Claude AI agents to perform specific tasks with high precision and consistency. Each skill is a markdown file with YAML metadata that contains:

- **Context**: What the skill is designed to do
- **Rules**: Critical instructions and constraints
- **Examples**: Input/output demonstrations
- **Output Format**: Expected structure of responses

### Why Use Skills?

- **Consistency**: Same instructions every time = predictable results
- **Expertise**: Encode domain knowledge into reusable prompts
- **Maintainability**: Update skills without changing code
- **Testing**: Iterate on prompts independently
- **Documentation**: Self-documenting AI behavior

---

## Skill Categories

Skills are organized into categories for better management:

### 1. `customer-intelligence/`
Customer analysis, profiling, and insights generation.

**Example Skills:**
- `customer-profiling.md` - Analyze customer behavior patterns
- `churn-prediction.md` - Identify at-risk customers
- `segmentation.md` - Group customers by characteristics

### 2. `sales-analytics/`
Sales data analysis, forecasting, and performance metrics.

**Example Skills:**
- `sales-forecasting.md` - Predict future sales trends
- `pipeline-analysis.md` - Analyze sales pipeline health
- `territory-optimization.md` - Optimize sales territory assignments

### 3. `product-intelligence/`
Product analysis, recommendations, and inventory insights.

**Example Skills:**
- `product-recommendations.md` - Generate personalized product suggestions
- `demand-forecasting.md` - Predict product demand
- `category-analysis.md` - Analyze product category performance

### 4. `maestro-recommendations/`
Multi-agent orchestration and recommendation systems.

**Example Skills:**
- `agent-routing.md` - Route tasks to appropriate agents
- `workflow-optimization.md` - Optimize multi-step workflows
- `decision-synthesis.md` - Combine multiple agent outputs

### 5. `external-research/`
Web research, data gathering, and external intelligence.

**Example Skills:**
- `competitor-analysis.md` - Research competitor strategies
- `market-research.md` - Gather market intelligence
- `trend-analysis.md` - Identify industry trends

### 6. `document-processing/`
Document parsing, extraction, and analysis.

**Current Skills:**
- `invoice-parsing.md` - Extract structured data from invoices
- `contract-analysis.md` - Analyze contract terms
- `receipt-parsing.md` - Parse receipt data

### 7. `inventory-management/`
Inventory tracking, matching, and optimization.

**Current Skills:**
- `product-matching.md` - Match products between systems
- `stock-optimization.md` - Optimize stock levels
- `reorder-analysis.md` - Analyze reorder points

---

## Creating a New Skill

### Step 1: Choose a Category

Decide which category best fits your skill. If none fit, propose a new category.

### Step 2: Create the Skill File

**New Format (Recommended):**
```
.skills/[category]/[skill-name].md
```

**Example:**
```
.skills/customer-intelligence/customer-profiling.md
```

**Legacy Format (Still Supported):**
```
.skills/[skill-name]/SKILL.md
```

### Step 3: Use the Template

Copy the skill template (see below) and customize it for your use case.

### Step 4: Test the Skill

Load and test your skill with the TypeScript API:

```typescript
import { loadSkill } from '@/lib/ai/skills-loader';

// New format
const skill = loadSkill('customer-intelligence/customer-profiling');

// Legacy format
const legacySkill = loadSkill('invoice-parsing');
```

### Step 5: Integrate with API

Use the skill in your API endpoint:

```typescript
import { loadSkillByCategory } from '@/lib/ai/skills-loader';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: Request) {
  const skill = loadSkillByCategory('document-processing', 'invoice-parsing');
  const userInput = await req.json();

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!
  });

  const message = await anthropic.messages.create({
    model: skill.metadata.model || 'claude-sonnet-4-5-20250929',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `${skill.content}\n\n---\n\n${userInput}`
      }
    ]
  });

  return Response.json(message);
}
```

---

## Skill Template

Use this template when creating a new skill:

```markdown
---
name: skill-name
version: 1.0.0
description: Brief description of what this skill does (1-2 sentences)
category: category-name
tags: [tag1, tag2, tag3]
model: claude-sonnet-4-5-20250929
author: Your Name or Team
created: 2025-01-24
updated: 2025-01-24
---

# Skill Title

## Contesto

Explain what this skill is designed to do. Be clear and specific about:
- The input the AI will receive
- The task it needs to perform
- The expected outcome

**CRITICITÀ**: Highlight any critical aspects or potential failure points.

---

## Regole Critiche

### REGOLA #1: [Most Important Rule]

**Description**: Explain the rule clearly.

**PROBLEMA COMUNE**: Describe a common mistake or issue.

**SOLUZIONE**: Provide step-by-step guidance to avoid the problem.

**Esempi**:
```
Input: Example input
Output: Example output
```

---

### REGOLA #2: [Second Important Rule]

Continue with additional rules...

---

## Formato Output

Specify the exact format expected. For JSON:

```json
{
  "field1": "value",
  "field2": 123,
  "nested": {
    "field3": true
  }
}
```

### Schema Dettagliato

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| field1 | string | ✅ | Description |
| field2 | number | ❌ | Description |

---

## Errori Comuni da Evitare

### Errore #1: [Common Mistake]
```
❌ SBAGLIATO: Wrong example
✅ CORRETTO: Correct example
```

### Errore #2: [Another Mistake]
Continue with more examples...

---

## Esempi

### Esempio 1: [Simple Case]
**Input**:
```
Sample input data
```

**Output**:
```json
{
  "result": "expected output"
}
```

### Esempio 2: [Complex Case]
Continue with more examples...

---

## Note Tecniche

- **Modello consigliato**: Claude 3.5 Sonnet
- **Max tokens**: 8192
- **Temperature**: 0 (deterministic)
- **Timeout**: 60 secondi

---

## Changelog

### v1.0.0 (2025-01-24)
- ✅ Prima versione stabile
- ✅ Feature list
```

---

## YAML Frontmatter Reference

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Unique identifier (kebab-case) | `invoice-parsing` |
| `version` | string | Semantic version | `1.0.0` |
| `description` | string | Brief description (1-2 sentences) | `Extract data from invoices` |
| `tags` | array | Searchable tags | `[parsing, pdf, ocr]` |

### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `category` | string | Skill category | `document-processing` |
| `model` | string | Preferred Claude model | `claude-sonnet-4-5-20250929` |
| `author` | string | Creator name or team | `Lapa Team` |
| `created` | string | Creation date (YYYY-MM-DD) | `2025-01-24` |
| `updated` | string | Last update date (YYYY-MM-DD) | `2025-01-24` |

### Model Options

| Model ID | Best For | Token Limit |
|----------|----------|-------------|
| `claude-sonnet-4-5-20250929` | General tasks, vision | 8192 |
| `claude-3-5-haiku-20241022` | Fast, simple tasks | 8192 |
| `claude-3-opus-20240229` | Complex reasoning | 4096 |

### Validation Rules

1. **name**: Must be kebab-case, unique within category
2. **version**: Must follow semantic versioning (MAJOR.MINOR.PATCH)
3. **description**: Must not be empty
4. **tags**: Must be an array (can be empty)
5. **category**: Auto-detected from path if not specified

---

## Tool Integration Best Practices

### 1. Vision API (PDFs & Images)

When your skill needs to analyze visual documents:

```typescript
const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 8192,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: base64Image
          }
        },
        {
          type: 'text',
          text: skill.content
        }
      ]
    }
  ]
});
```

### 2. PDF Processing

For multi-page PDFs:

```typescript
import { Anthropic } from '@anthropic-ai/sdk';

const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 8192,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64Pdf
          }
        },
        {
          type: 'text',
          text: skill.content
        }
      ]
    }
  ]
});
```

### 3. Streaming Responses

For long-running tasks:

```typescript
const stream = await anthropic.messages.stream({
  model: skill.metadata.model || 'claude-sonnet-4-5-20250929',
  max_tokens: 8192,
  messages: [
    {
      role: 'user',
      content: skill.content + '\n\n' + userInput
    }
  ]
});

for await (const chunk of stream) {
  if (chunk.type === 'content_block_delta') {
    // Process streaming chunk
  }
}
```

### 4. Tool Use (Function Calling)

Enable Claude to use external tools:

```typescript
const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 8192,
  tools: [
    {
      name: 'search_products',
      description: 'Search for products in inventory',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string' }
        },
        required: ['query']
      }
    }
  ],
  messages: [
    {
      role: 'user',
      content: skill.content + '\n\n' + userInput
    }
  ]
});
```

---

## Testing Skills

### Manual Testing

1. **Create Test Input**: Prepare sample data
2. **Load Skill**: Use `loadSkill()` function
3. **Call API**: Send request with test data
4. **Validate Output**: Check against expected format

### Automated Testing

```typescript
import { loadSkill } from '@/lib/ai/skills-loader';
import { describe, it, expect } from 'vitest';

describe('invoice-parsing skill', () => {
  it('should load successfully', () => {
    const skill = loadSkill('document-processing/invoice-parsing');
    expect(skill.metadata.name).toBe('invoice-parsing');
    expect(skill.metadata.version).toBe('1.2.0');
  });

  it('should have required sections', () => {
    const skill = loadSkill('document-processing/invoice-parsing');
    expect(skill.content).toContain('## Contesto');
    expect(skill.content).toContain('## Regole Critiche');
    expect(skill.content).toContain('## Formato Output');
  });
});
```

### Integration Testing

```typescript
import { POST as invoiceParseAPI } from '@/app/api/arrivo-merce/parse-invoice/route';

describe('Invoice Parsing API', () => {
  it('should parse invoice correctly', async () => {
    const testPdf = Buffer.from('test pdf content').toString('base64');

    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ pdfBase64: testPdf })
    });

    const response = await invoiceParseAPI(request);
    const data = await response.json();

    expect(data).toHaveProperty('supplier_name');
    expect(data).toHaveProperty('products');
    expect(Array.isArray(data.products)).toBe(true);
  });
});
```

### Cache Testing

Test that caching works correctly:

```typescript
import { loadSkill, clearSkillCache } from '@/lib/ai/skills-loader';

// Clear cache before test
clearSkillCache();

// First load (from disk)
console.time('First load');
const skill1 = loadSkill('document-processing/invoice-parsing');
console.timeEnd('First load'); // ~10ms

// Second load (from cache)
console.time('Second load');
const skill2 = loadSkill('document-processing/invoice-parsing');
console.timeEnd('Second load'); // ~0.1ms

// Verify they're the same object
expect(skill1).toBe(skill2);
```

---

## Versioning Guidelines

Skills follow **Semantic Versioning** (SemVer):

### Version Format: MAJOR.MINOR.PATCH

```
1.0.0
│ │ │
│ │ └─ PATCH: Bug fixes, typos, clarifications
│ └─── MINOR: New features, backward compatible
└───── MAJOR: Breaking changes, incompatible updates
```

### When to Increment

| Change Type | Version | Example |
|-------------|---------|---------|
| Fix typo in documentation | PATCH | 1.0.0 → 1.0.1 |
| Clarify existing rule | PATCH | 1.0.1 → 1.0.2 |
| Add new optional field | MINOR | 1.0.2 → 1.1.0 |
| Add new validation rule | MINOR | 1.1.0 → 1.2.0 |
| Change output schema | MAJOR | 1.2.0 → 2.0.0 |
| Remove required field | MAJOR | 2.0.0 → 3.0.0 |

### Changelog Best Practices

Always document changes in the skill's Changelog section:

```markdown
## Changelog

### v2.0.0 (2025-01-25)
- ⚠️ **BREAKING**: Changed `quantity` field from string to number
- ✅ Added `unit` field validation
- ✅ Improved multi-lotto handling

### v1.2.0 (2025-01-23)
- ✅ Added duplicate consolidation (REGOLA #7)
- ✅ Added `parsing_summary` field
- ✅ Improved error messages

### v1.1.0 (2025-01-22)
- ✅ Added multi-line invoice support (REGOLA #6)
- ✅ Improved lotto/scadenza detection

### v1.0.0 (2025-01-15)
- ✅ Initial stable release
```

### Migration Guide

When making breaking changes, provide a migration guide:

```markdown
## Migration Guide: v1.x → v2.0

### Breaking Changes

1. **quantity field now number instead of string**

   **Before (v1.x):**
   ```json
   { "quantity": "24.0" }
   ```

   **After (v2.0):**
   ```json
   { "quantity": 24.0 }
   ```

2. **unit field now required**

   **Before (v1.x):**
   ```json
   { "quantity": 24 }
   ```

   **After (v2.0):**
   ```json
   { "quantity": 24.0, "unit": "KG" }
   ```
```

---

## Advanced Features

### 1. Conditional Logic

Use conditional instructions for different scenarios:

```markdown
## Regole Condizionali

**Se la fattura contiene più DDT**:
1. Identifica i duplicati per `article_code + lot_number`
2. Somma le quantità
3. Crea una sola riga nel JSON finale

**Se la fattura ha UN SOLO DDT**:
1. Procedi normalmente senza consolidamento
```

### 2. Error Handling

Specify how to handle edge cases:

```markdown
## Gestione Errori

### Caso: Prodotto senza codice articolo
**Comportamento**: Usa `null` per `article_code`
**Validazione**: La `description` deve essere presente

### Caso: Data scadenza mancante
**Comportamento**: Usa `null` per `expiry_date`
**Nota**: Registra warning nel log
```

### 3. Multi-Step Workflows

Break complex tasks into steps:

```markdown
## Workflow

### Step 1: Estrazione Iniziale
1. Leggi l'intera fattura
2. Identifica le righe prodotto
3. Estrai dati grezzi

### Step 2: Validazione
1. Verifica completezza dati
2. Valida formati (date, numeri)
3. Controlla coerenza

### Step 3: Consolidamento
1. Identifica duplicati
2. Somma quantità
3. Genera output finale
```

### 4. Skill Chaining

Reference other skills for complex workflows:

```markdown
## Dipendenze

Questo skill richiede l'output di:
- `document-processing/invoice-parsing` per estrarre dati dalla fattura
- `inventory-management/product-lookup` per cercare prodotti in Odoo

**Workflow completo**:
1. Skill: `invoice-parsing` → Estrae prodotti da fattura
2. Skill: `product-matching` (questo) → Matcha prodotti
3. Skill: `inventory-update` → Aggiorna Odoo
```

### 5. Dynamic Model Selection

Choose model based on task complexity:

```typescript
const skill = loadSkill('document-processing/invoice-parsing');

// Override model for simple invoices
const modelToUse = invoicePages > 10
  ? 'claude-sonnet-4-5-20250929'  // Complex: use Sonnet
  : 'claude-3-5-haiku-20241022';   // Simple: use Haiku (faster/cheaper)

const message = await anthropic.messages.create({
  model: modelToUse,
  // ...
});
```

---

## Troubleshooting

### Problem: Skill not found

**Error:**
```
Skill "my-skill" non trovato.
```

**Solutions:**
1. Check file path: `.skills/category/skill-name.md`
2. Verify file extension is `.md`
3. Check for typos in skill name
4. Run `listSkills()` to see available skills

### Problem: Invalid YAML metadata

**Error:**
```
Skill metadata validation failed: "version" must be semantic
```

**Solutions:**
1. Ensure version follows format: `1.0.0` (not `1.0` or `v1.0.0`)
2. Check for missing required fields (name, version, description, tags)
3. Verify YAML frontmatter starts with `---` and ends with `---`

### Problem: Skill returns inconsistent results

**Solutions:**
1. **Set temperature to 0** for deterministic output
2. **Add more specific rules** with clear examples
3. **Use structured output** (JSON schema)
4. **Test with edge cases** and add them to the skill
5. **Increase max_tokens** if responses are truncated

### Problem: Slow skill loading

**Solutions:**
1. **Use cache**: Don't set `skipCache: true` unnecessarily
2. **Preload skills**: Load skills at server startup, not per-request
3. **Optimize skill size**: Large skills (>50KB) load slower

### Problem: Cache not updating after skill changes

**Solution:**
```typescript
import { clearSkillCache } from '@/lib/ai/skills-loader';

// Clear cache in development mode
if (process.env.NODE_ENV === 'development') {
  clearSkillCache();
}

const skill = loadSkill('document-processing/invoice-parsing');
```

### Problem: Category not detected

**Error:**
```
metadata.category is undefined
```

**Solutions:**
1. **Add category to YAML frontmatter**:
   ```yaml
   ---
   category: document-processing
   ---
   ```
2. **Or use category/skill-name.md format** (auto-detected)

### Problem: Skill validation failing

**Error:**
```
Skill metadata validation failed: "description" is required
```

**Solution:**
Ensure all required fields are present:
```yaml
---
name: my-skill
version: 1.0.0
description: A clear description of what this skill does
tags: [tag1, tag2]
---
```

---

## Best Practices Summary

1. **Be Specific**: The more detailed your instructions, the better the results
2. **Use Examples**: Show don't just tell - provide concrete input/output examples
3. **Document Errors**: List common mistakes and how to avoid them
4. **Version Properly**: Follow semantic versioning strictly
5. **Test Thoroughly**: Test edge cases, not just happy paths
6. **Cache Wisely**: Use caching but clear when developing
7. **Structure Content**: Use clear sections with ## headings
8. **JSON Schema**: Always specify exact output format with examples
9. **Incremental Development**: Start simple, add complexity iteratively
10. **Peer Review**: Have another developer review your skill before production

---

## Resources

### Documentation
- [Anthropic API Docs](https://docs.anthropic.com/)
- [Claude Model Guide](https://docs.anthropic.com/claude/docs/models-overview)
- [Vision API Guide](https://docs.anthropic.com/claude/docs/vision)

### Internal
- `lib/ai/skills-loader.ts` - Skills loading library
- `.skills/README.md` - Quick reference
- This guide - Comprehensive documentation

### Support
- Questions? Ask in #ai-development Slack channel
- Bug reports: Create issue in GitHub
- Feature requests: Discuss with AI team lead

---

**Last Updated**: 2025-01-24
**Maintainer**: Lapa Team
**Version**: 1.0.0
