# 🤖 Anthropic AI Skills

Questa cartella contiene gli **Skills** per gli agenti AI basati su Anthropic Claude.

## Cos'è uno Skill?

Uno Skill è un insieme di istruzioni specializzate che guidano l'AI a eseguire un compito specifico con alta precisione.

Ogni skill contiene:
- **SKILL.md**: Istruzioni dettagliate per l'agente
- **Metadata YAML**: Configurazione (versione, tags, modello)
- **Examples** (opzionale): File di esempio per testing

## Skills Disponibili

### 1. invoice-parsing
**Scopo**: Estrae dati strutturati da fatture fornitori (PDF o immagini)
**Modello**: Claude 3.5 Sonnet
**Uso**: `/api/arrivo-merce/parse-invoice`

### 2. product-matching
**Scopo**: Match intelligente tra prodotti fattura e righe inventario Odoo
**Modello**: Claude 3.5 Sonnet
**Uso**: `/api/arrivo-merce/process-reception`

## Come Usare uno Skill

```typescript
import { loadSkill } from '@/lib/ai/skills-loader';

// Carica lo skill
const skill = loadSkill('invoice-parsing');

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

## Struttura Skill

```markdown
---
name: skill-name
version: 1.0.0
description: Brief description
tags: [tag1, tag2]
model: claude-3-5-sonnet-20241022
---

# Skill Title

## Context
What is the skill for?

## Rules
Detailed instructions...

## Output Format
Expected output structure...
```

## Versioning

Gli skills seguono **Semantic Versioning**:
- **1.0.0** → Prima versione stabile
- **1.1.0** → Nuove funzionalità (backward compatible)
- **2.0.0** → Breaking changes

## Testing

Per testare uno skill:
1. Modifica il file SKILL.md
2. Salva
3. Riavvia il dev server (`npm run dev`)
4. Testa l'endpoint che usa quello skill

**IMPORTANTE**: Le modifiche agli skills NON richiedono rebuild, solo restart del server!

## Best Practices

1. ✅ **Sii specifico**: Più dettagli = migliori risultati
2. ✅ **Usa esempi**: Mostra input/output attesi
3. ✅ **Elenca errori comuni**: Cosa NON fare
4. ✅ **Formatta output**: Specifica JSON schema preciso
5. ✅ **Versiona**: Incrementa versione ad ogni modifica significativa

## Contribuire

Per creare un nuovo skill:
1. Crea cartella in `.skills/nome-skill/`
2. Crea file `SKILL.md` con metadata YAML
3. Testa con endpoint dedicato
4. Documenta qui nel README

---

**Ultimo aggiornamento**: 2025-01-15
**Maintainer**: Lapa Team
