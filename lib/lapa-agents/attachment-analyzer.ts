/**
 * ATTACHMENT ANALYZER - Gemini Vision per analisi allegati
 *
 * Usa Gemini Pro Vision per analizzare immagini e documenti allegati
 * e generare una descrizione testuale da passare all'orchestratore
 */

// Import dinamico per Google AI SDK
async function getGemini() {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

export interface Attachment {
  name: string;
  content: string; // base64 encoded
  mimetype: string;
  size?: number;
}

export interface AnalyzedAttachment extends Attachment {
  analysis?: string;
  extractedText?: string;
  category?: 'image' | 'document' | 'pdf' | 'other';
  isAnalyzed: boolean;
}

/**
 * Analizza un singolo allegato con Gemini Vision
 */
export async function analyzeAttachment(attachment: Attachment): Promise<AnalyzedAttachment> {
  const result: AnalyzedAttachment = {
    ...attachment,
    isAnalyzed: false,
    category: detectCategory(attachment.mimetype)
  };

  // Solo analizza immagini e PDF (i formati supportati da Gemini Vision)
  const supportedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf'
  ];

  if (!supportedTypes.includes(attachment.mimetype)) {
    result.analysis = `File "${attachment.name}" (${attachment.mimetype}) - non analizzabile automaticamente`;
    return result;
  }

  try {
    const genAI = await getGemini();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Prompt specifico per analisi immagini/documenti nel contesto customer service
    const prompt = `Analizza questa immagine/documento nel contesto di un servizio clienti per LAPA, un distributore di prodotti alimentari italiani in Svizzera.

CONTESTO:
- Il cliente potrebbe inviare foto di prodotti, scontrini, fatture, etichette, packaging
- Potrebbe essere una foto di un problema (prodotto danneggiato, quantità errata, ecc.)
- Potrebbe essere un documento da analizzare (ordine, bolla, fattura)

ISTRUZIONI:
1. Descrivi brevemente cosa vedi nell'immagine/documento
2. Se ci sono prodotti alimentari, identifica quali sono (es. mozzarella, burrata, prosciutto, etc.)
3. Se ci sono numeri (codici prodotto, quantità, prezzi, date), estraili
4. Se noti problemi evidenti (prodotto rotto, data scadenza, errore), segnalalo
5. Se è un documento (fattura, ordine, bolla), estrai le informazioni chiave

Rispondi in italiano in modo conciso (max 200 parole). Non fare supposizioni su ciò che non vedi chiaramente.`;

    const imagePart = {
      inlineData: {
        data: attachment.content,
        mimeType: attachment.mimetype
      }
    };

    const response = await model.generateContent([prompt, imagePart]);
    const text = response.response.text();

    result.analysis = text;
    result.isAnalyzed = true;

    console.log(`✅ Allegato analizzato: ${attachment.name}`);
    console.log(`   Analisi: ${text.substring(0, 100)}...`);

    return result;

  } catch (error) {
    console.error(`❌ Errore analisi allegato ${attachment.name}:`, error);
    result.analysis = `Impossibile analizzare "${attachment.name}": ${error instanceof Error ? error.message : 'errore sconosciuto'}`;
    return result;
  }
}

/**
 * Analizza tutti gli allegati e genera un summary per l'orchestratore
 */
export async function analyzeAttachments(attachments: Attachment[]): Promise<{
  analyzedAttachments: AnalyzedAttachment[];
  summary: string;
}> {
  if (!attachments || attachments.length === 0) {
    return { analyzedAttachments: [], summary: '' };
  }

  console.log(`📎 Analisi ${attachments.length} allegati con Gemini...`);

  // Analizza tutti in parallelo
  const analyzedAttachments = await Promise.all(
    attachments.map(att => analyzeAttachment(att))
  );

  // Genera summary per l'orchestratore
  const summaryParts: string[] = [];

  for (const att of analyzedAttachments) {
    if (att.isAnalyzed && att.analysis) {
      summaryParts.push(`📎 [${att.name}]: ${att.analysis}`);
    } else if (att.analysis) {
      summaryParts.push(`📎 ${att.analysis}`);
    }
  }

  const summary = summaryParts.length > 0
    ? `\n\n--- ALLEGATI ANALIZZATI ---\n${summaryParts.join('\n\n')}`
    : '';

  console.log(`✅ Analisi allegati completata. Summary length: ${summary.length}`);

  return { analyzedAttachments, summary };
}

/**
 * Detect categoria allegato dal mimetype
 */
function detectCategory(mimetype: string): 'image' | 'document' | 'pdf' | 'other' {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.includes('document') || mimetype.includes('spreadsheet') || mimetype.includes('text')) {
    return 'document';
  }
  return 'other';
}

/**
 * Crea un messaggio arricchito con l'analisi degli allegati
 */
export async function enrichMessageWithAttachments(
  message: string,
  attachments?: Attachment[]
): Promise<{ enrichedMessage: string; analyzedAttachments?: AnalyzedAttachment[] }> {
  if (!attachments || attachments.length === 0) {
    return { enrichedMessage: message };
  }

  const { analyzedAttachments, summary } = await analyzeAttachments(attachments);

  // Aggiungi summary al messaggio
  const enrichedMessage = message + summary;

  return {
    enrichedMessage,
    analyzedAttachments
  };
}
