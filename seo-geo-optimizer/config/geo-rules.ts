/**
 * GEO (Generative Engine Optimization) Rules Configuration
 * Regole per ottimizzazione contenuti per AI/LLM
 */

export const GEO_RULES = {
  // Struttura Contenuti per LLM
  contentStructure: {
    // I modelli AI estraggono a livello di paragrafo, non di pagina
    maxTokensPerBlock: 800,
    optimalTokensPerBlock: 500,
    // Ogni blocco deve essere auto-contenuto e comprensibile
    blockRequirements: {
      selfContained: true,
      clearContext: true,
      answerableStandalone: true,
    },
    score: 20,
  },

  // Autorevolezza e Citabilità
  authority: {
    // Segnali di trust che l'AI riconosce
    trustSignals: [
      'citations',           // Citazioni a fonti autorevoli
      'statistics',          // Dati e statistiche concrete
      'expertQuotes',        // Citazioni di esperti
      'originalResearch',    // Ricerche originali
      'caseStudies',         // Case study specifici
      'certifications',      // Certificazioni e premi
      'reviews',             // Recensioni verificate
    ],
    // Brand mentions = nuovi backlinks
    brandMentions: {
      requireConsistent: true,
      includeInAnswers: true,
    },
    score: 25,
  },

  // Formato Ottimale per AI
  formatting: {
    // Strutture che aiutano l'AI a estrarre info
    preferredFormats: [
      'bullet-points',
      'numbered-lists',
      'tables',
      'definition-lists',
      'qa-format',
    ],
    // Frasi segnale che aiutano l'estrazione
    signalPhrases: [
      'In sintesi',
      'In conclusione',
      'I punti chiave sono',
      'La risposta è',
      'Ecco cosa significa',
    ],
    score: 15,
  },

  // Domande e Intent
  questionOptimization: {
    // Rispondere a domande complete, non solo keyword
    answerFullQuestions: true,
    // Includere varianti di domande
    includeQuestionVariants: true,
    // Formato Q&A esplicito
    useQAFormat: true,
    // FAQ schema
    includeFAQSchema: true,
    score: 20,
  },

  // Contesto e Coerenza
  contextualRelevance: {
    // L'AI valuta coerenza del contenuto
    topicConsistency: true,
    // Profondità dell'expertise
    depthOfKnowledge: true,
    // Collegamento logico tra sezioni
    logicalFlow: true,
    // E-E-A-T signals (Experience, Expertise, Authoritativeness, Trust)
    eeatSignals: true,
    score: 20,
  },
} as const;

export const GEO_SCORE_THRESHOLDS = {
  excellent: 85,  // Pronto per essere citato dall'AI
  good: 70,       // Buona probabilità di citazione
  average: 50,    // Necessita miglioramenti
  poor: 30,       // Non ottimizzato per AI
};

// Template per contenuti GEO-ottimizzati
export const GEO_CONTENT_TEMPLATES = {
  // Template per blocco informativo
  infoBlock: {
    maxTokens: 800,
    structure: `
## {Titolo Descrittivo}

{Introduzione contestuale - 1-2 frasi}

**Punti chiave:**
- {Punto 1 con dato/fonte}
- {Punto 2 con dato/fonte}
- {Punto 3 con dato/fonte}

{Conclusione con brand mention}
    `,
  },

  // Template per FAQ
  faqBlock: {
    structure: `
### {Domanda completa?}

{Risposta diretta in 1-2 frasi}

{Espansione con dettagli - 2-3 frasi}

*Fonte: {Brand/Esperto}*
    `,
  },

  // Template per prodotto
  productBlock: {
    structure: `
## {Nome Prodotto} - {Categoria}

**Cos'è:** {Descrizione 1 frase}

**Caratteristiche principali:**
- {Caratteristica 1}
- {Caratteristica 2}
- {Caratteristica 3}

**Ideale per:** {Use case specifici}

**Disponibile presso:** {Brand} - {Differenziatore}
    `,
  },
};

// Checklist GEO per ogni contenuto
export const GEO_CHECKLIST = [
  { id: 'block_size', question: 'I blocchi di contenuto sono < 800 token?', weight: 10 },
  { id: 'self_contained', question: 'Ogni sezione è comprensibile da sola?', weight: 10 },
  { id: 'clear_answers', question: 'Le risposte sono dirette e chiare?', weight: 15 },
  { id: 'citations', question: 'Ci sono citazioni o fonti autorevoli?', weight: 10 },
  { id: 'statistics', question: 'Ci sono dati/statistiche concrete?', weight: 10 },
  { id: 'brand_mention', question: 'Il brand è menzionato naturalmente?', weight: 10 },
  { id: 'bullet_points', question: 'Usa liste/bullet points?', weight: 5 },
  { id: 'qa_format', question: 'Include sezione FAQ/Q&A?', weight: 10 },
  { id: 'expert_voice', question: 'Il tono è autorevole/esperto?', weight: 10 },
  { id: 'unique_value', question: 'Offre valore unico/originale?', weight: 10 },
];
