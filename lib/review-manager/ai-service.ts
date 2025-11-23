/**
 * Review Manager AI Service
 * Genera risposte intelligenti alle recensioni usando Claude/OpenAI
 */

import Anthropic from '@anthropic-ai/sdk';

// Tipi
export interface ReviewData {
  reviewerName: string;
  rating: number;
  content: string;
  language: string;
  platform: 'google' | 'instagram' | 'tiktok' | 'facebook' | 'trustpilot';
}

export interface BusinessConfig {
  businessName: string;
  responseTone: 'friendly' | 'elegant' | 'professional' | 'casual';
  responseLanguages: string[];
  customInstructions?: string;
}

export interface SentimentAnalysis {
  score: number;          // -1.0 to +1.0
  label: 'positive' | 'neutral' | 'negative';
  keyTopics: string[];
  summary: string;
}

export interface GeneratedResponse {
  response: string;
  sentiment: SentimentAnalysis;
  confidence: number;
}

// Configurazione toni
const TONE_PROMPTS: Record<string, string> = {
  friendly: 'Usa un tono amichevole, caloroso e personale. Come se stessi parlando con un amico.',
  elegant: 'Usa un tono elegante, raffinato e professionale. Linguaggio curato ma non freddo.',
  professional: 'Usa un tono professionale e formale, ma comunque cordiale e rispettoso.',
  casual: 'Usa un tono casual e rilassato, come una conversazione informale.'
};

// Prompt per generazione risposte
const RESPONSE_SYSTEM_PROMPT = `Sei un esperto di customer service per ristoranti e attività commerciali.
Il tuo compito è generare risposte perfette alle recensioni dei clienti.

REGOLE IMPORTANTI:
1. La risposta deve essere nella STESSA LINGUA della recensione
2. Personalizza sempre la risposta menzionando dettagli specifici della recensione
3. Per recensioni negative: sii empatico, scusati, offri una soluzione
4. Per recensioni positive: ringrazia calorosamente, invita a tornare
5. NON usare mai frasi generiche o template ovvi
6. Mantieni la risposta concisa: 2-4 frasi per positive, 3-5 frasi per negative
7. NON iniziare mai con "Gentile cliente" - usa il nome del recensore se disponibile
8. NON usare emoji eccessive - massimo 1-2 se appropriato`;

// Prompt per sentiment analysis
const SENTIMENT_SYSTEM_PROMPT = `Analizza la seguente recensione e fornisci:
1. sentiment_score: un numero da -1.0 (molto negativo) a +1.0 (molto positivo)
2. sentiment_label: "positive", "neutral", o "negative"
3. key_topics: array di argomenti menzionati (es. ["cibo", "servizio", "prezzo", "ambiente"])
4. summary: riassunto in 1 frase

Rispondi SOLO in formato JSON valido, senza markdown o altro testo.`;

/**
 * Inizializza il client Anthropic
 */
function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY non configurata');
  }
  return new Anthropic({ apiKey });
}

/**
 * Analizza il sentiment di una recensione
 */
export async function analyzeSentiment(review: ReviewData): Promise<SentimentAnalysis> {
  const client = getAnthropicClient();

  const prompt = `Recensione (${review.rating} stelle su ${review.platform}):
"${review.content}"

Analizza e rispondi in JSON:`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      system: SENTIMENT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON response
    const parsed = JSON.parse(text);

    return {
      score: parsed.sentiment_score ?? (review.rating - 3) / 2,
      label: parsed.sentiment_label ?? (review.rating >= 4 ? 'positive' : review.rating <= 2 ? 'negative' : 'neutral'),
      keyTopics: parsed.key_topics ?? [],
      summary: parsed.summary ?? ''
    };
  } catch (error) {
    console.error('Errore sentiment analysis:', error);
    // Fallback basato su rating
    return {
      score: (review.rating - 3) / 2,
      label: review.rating >= 4 ? 'positive' : review.rating <= 2 ? 'negative' : 'neutral',
      keyTopics: [],
      summary: ''
    };
  }
}

/**
 * Genera una risposta personalizzata per una recensione
 */
export async function generateResponse(
  review: ReviewData,
  business: BusinessConfig
): Promise<GeneratedResponse> {
  const client = getAnthropicClient();

  // Prima analizza il sentiment
  const sentiment = await analyzeSentiment(review);

  // Costruisci il prompt
  const toneInstruction = TONE_PROMPTS[business.responseTone] || TONE_PROMPTS.friendly;

  const prompt = `ATTIVITA': ${business.businessName}
TONO RICHIESTO: ${toneInstruction}
${business.customInstructions ? `ISTRUZIONI AGGIUNTIVE: ${business.customInstructions}` : ''}

RECENSIONE DA RISPONDERE:
- Piattaforma: ${review.platform}
- Recensore: ${review.reviewerName || 'Cliente'}
- Stelle: ${review.rating}/5
- Lingua: ${review.language}
- Contenuto: "${review.content}"

SENTIMENT RILEVATO: ${sentiment.label} (${sentiment.score.toFixed(2)})
ARGOMENTI PRINCIPALI: ${sentiment.keyTopics.join(', ') || 'non specificati'}

Genera la risposta perfetta per questa recensione. Rispondi SOLO con il testo della risposta, senza preamboli.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      system: RESPONSE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    return {
      response: responseText.trim(),
      sentiment,
      confidence: 0.95
    };
  } catch (error) {
    console.error('Errore generazione risposta:', error);
    throw error;
  }
}

/**
 * Genera risposte batch per multiple recensioni
 */
export async function generateBatchResponses(
  reviews: ReviewData[],
  business: BusinessConfig
): Promise<GeneratedResponse[]> {
  const results: GeneratedResponse[] = [];

  for (const review of reviews) {
    try {
      const response = await generateResponse(review, business);
      results.push(response);
      // Rate limiting - aspetta 500ms tra le richieste
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Errore per review:`, error);
      results.push({
        response: '',
        sentiment: {
          score: 0,
          label: 'neutral',
          keyTopics: [],
          summary: ''
        },
        confidence: 0
      });
    }
  }

  return results;
}

/**
 * Rileva la lingua di un testo
 */
export async function detectLanguage(text: string): Promise<string> {
  const client = getAnthropicClient();

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: `Rispondi SOLO con il codice lingua ISO 639-1 (es: it, en, de, fr) per questo testo: "${text.substring(0, 200)}"`
      }]
    });

    const lang = response.content[0].type === 'text' ? response.content[0].text.trim().toLowerCase() : 'it';
    return lang.length === 2 ? lang : 'it';
  } catch {
    return 'it';
  }
}

/**
 * Migliora una risposta esistente
 */
export async function improveResponse(
  originalResponse: string,
  feedback: string,
  review: ReviewData,
  business: BusinessConfig
): Promise<string> {
  const client = getAnthropicClient();

  const prompt = `RISPOSTA ORIGINALE:
"${originalResponse}"

FEEDBACK PER MIGLIORARLA:
${feedback}

CONTESTO RECENSIONE:
- Rating: ${review.rating}/5
- Contenuto: "${review.content}"
- Business: ${business.businessName}
- Tono: ${business.responseTone}

Riscrivi la risposta incorporando il feedback. Rispondi SOLO con la nuova risposta.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      system: RESPONSE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.content[0].type === 'text' ? response.content[0].text.trim() : originalResponse;
  } catch (error) {
    console.error('Errore miglioramento risposta:', error);
    return originalResponse;
  }
}
