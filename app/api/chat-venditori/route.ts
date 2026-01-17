/**
 * CHAT VENDITORI - API Route
 *
 * Endpoint per i venditori per comunicare con Claude AI.
 * Ottimizzato per operazioni di vendita: clienti, ordini, prodotti.
 *
 * FEATURES:
 * - Usa la sessione del venditore loggato
 * - Memoria conversazione persistente su Vercel KV
 * - Claude conosce il venditore con cui sta parlando
 * - Supporto multimodale: foto ordini, documenti, audio
 * - System prompt ottimizzato per vendite
 *
 * POST /api/chat-venditori
 * Body: FormData con message, conversationId, attachments
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { kv } from '@vercel/kv';
import { getToolDefinitions, processToolCalls, setOdooSessionContext } from '@/lib/mcp-tools';
import { getOdooSession } from '@/lib/odoo-auth';
import { searchReadOdoo } from '@/lib/odoo/odoo-helper';
import {
  saveConversation as saveToCentralStore,
  loadConversation as loadFromCentralStore,
  addMessageToConversation,
  type StoredConversation as CentralConversation,
  type Message as CentralMessage,
} from '@/lib/lapa-agents/conversation-store';
import { recordRequest } from '@/lib/lapa-agents/stats';

// ============================================================================
// CONSTANTS
// ============================================================================

const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 4096;
const MAX_TOOL_ITERATIONS = 10;
const CONVERSATION_TTL = 60 * 60 * 24 * 365; // 1 year in seconds
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Rate limiting
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 1000;

// Lazy AI clients initialization
let openaiClient: OpenAI | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getGemini(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

// ============================================================================
// ATTACHMENT PROCESSING
// ============================================================================

interface ProcessedAttachment {
  type: 'image' | 'pdf' | 'audio';
  name: string;
  content: string; // Extracted text or transcription
  originalSize: number;
}

/**
 * Transcribe audio using OpenAI Whisper
 * Handles browser-recorded audio (webm/opus) using OpenAI's toFile helper
 */
async function transcribeAudio(file: File): Promise<string> {
  console.log(`[CHAT-VENDITORI] Transcribing audio: ${file.name} (${file.size} bytes, type: ${file.type})`);

  const openai = getOpenAI();

  // Get the file buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // Determine the correct file extension based on content type
  let mimeType = file.type || 'audio/webm';

  // Map mime types to extensions Whisper accepts
  const mimeToExt: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/webm;codecs=opus': 'webm',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/ogg;codecs=opus': 'ogg',
    'audio/flac': 'flac',
  };

  // Get extension from mime type
  const ext = mimeToExt[mimeType] || 'webm';
  const fileName = `audio_${Date.now()}.${ext}`;

  console.log(`[CHAT-VENDITORI] Audio file prepared: ${fileName}, mime: ${mimeType}, size: ${buffer.length}`);

  // Use OpenAI's toFile helper to create a proper file object for Node.js
  const { toFile } = await import('openai/uploads');
  const audioFile = await toFile(buffer, fileName, { type: mimeType });

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'it',
      response_format: 'text',
    });

    console.log(`[CHAT-VENDITORI] Audio transcribed successfully: ${transcription.substring(0, 100)}...`);
    return transcription;
  } catch (error: any) {
    console.error(`[CHAT-VENDITORI] Whisper transcription error:`, error.message);
    throw new Error(`Trascrizione audio fallita: ${error.message}`);
  }
}

/**
 * Analyze image or PDF using Gemini Vision
 */
async function analyzeWithGemini(file: File): Promise<string> {
  console.log(`[CHAT-VENDITORI] Analyzing with Gemini: ${file.name} (${file.size} bytes)`);

  const genAI = getGemini();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Convert file to base64
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64Data = buffer.toString('base64');

  const prompt = `Analizza questo documento/immagine nel contesto di un gestionale aziendale per LAPA, distributore di prodotti alimentari italiani.

ISTRUZIONI:
1. Descrivi il contenuto in modo completo e dettagliato
2. Se è un documento (fattura, ordine, bolla, scontrino):
   - Estrai tutti i dati: numeri, date, importi, prodotti, quantità
   - Identifica mittente e destinatario
   - Estrai codici prodotto, descrizioni, prezzi unitari
3. Se è un'immagine di prodotti:
   - Identifica i prodotti visibili
   - Nota eventuali problemi (danneggiamenti, etichette, scadenze)
4. Se contiene testo, trascrivilo integralmente
5. Organizza le informazioni in modo strutturato

Rispondi in italiano in modo dettagliato.`;

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: file.type,
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  const text = response.text();

  console.log(`[CHAT-VENDITORI] Gemini analysis complete: ${text.substring(0, 100)}...`);
  return text;
}

/**
 * Process all attachments and return extracted content
 */
async function processAttachments(formData: FormData): Promise<ProcessedAttachment[]> {
  const attachmentCount = parseInt(formData.get('attachmentCount') as string || '0');
  if (attachmentCount === 0) return [];

  console.log(`[CHAT-VENDITORI] Processing ${attachmentCount} attachments...`);

  const processed: ProcessedAttachment[] = [];

  for (let i = 0; i < attachmentCount; i++) {
    const file = formData.get(`attachment_${i}`) as File;
    const type = formData.get(`attachment_${i}_type`) as string;

    if (!file) continue;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      console.warn(`[CHAT-VENDITORI] File too large: ${file.name} (${file.size} bytes)`);
      processed.push({
        type: type as any,
        name: file.name,
        content: `[File troppo grande: ${file.name} - max 10MB]`,
        originalSize: file.size,
      });
      continue;
    }

    try {
      let content: string;

      if (type === 'audio') {
        // Transcribe with Whisper
        content = await transcribeAudio(file);
      } else if (type === 'image' || type === 'pdf') {
        // Analyze with Gemini
        content = await analyzeWithGemini(file);
      } else {
        content = `[Tipo file non supportato: ${file.type}]`;
      }

      processed.push({
        type: type as any,
        name: file.name,
        content,
        originalSize: file.size,
      });
    } catch (error) {
      console.error(`[CHAT-VENDITORI] Error processing ${file.name}:`, error);
      processed.push({
        type: type as any,
        name: file.name,
        content: `[Errore elaborazione: ${error instanceof Error ? error.message : 'errore sconosciuto'}]`,
        originalSize: file.size,
      });
    }
  }

  return processed;
}

/**
 * Build enriched message with attachment content
 */
function buildEnrichedMessage(message: string, attachments: ProcessedAttachment[]): string {
  if (attachments.length === 0) return message;

  let enriched = message || '';

  // Add attachment content
  const attachmentSection = attachments.map((att, idx) => {
    const icon = att.type === 'audio' ? '🎤' : att.type === 'image' ? '📷' : '📄';
    return `\n\n--- ${icon} ALLEGATO ${idx + 1}: ${att.name} ---\n${att.content}`;
  }).join('');

  enriched += attachmentSection;

  return enriched;
}

// ============================================================================
// SYSTEM PROMPT TEMPLATE
// ============================================================================

function getSystemPrompt(userName: string, userEmail: string, userId: number): string {
  // Get current date in Italian format with Swiss timezone
  const now = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Europe/Zurich'
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich'
  };
  const currentDate = now.toLocaleDateString('it-IT', dateOptions);
  const currentTime = now.toLocaleTimeString('it-IT', timeOptions);

  return `Sei l'assistente AI personale per i venditori di LAPA - finest italian food GmbH, distributore di prodotti alimentari italiani di alta qualita' in Svizzera.

# DATA E ORA CORRENTE
Oggi e' **${currentDate}** e sono le **${currentTime}**.
Usa questa data per tutte le query relative a "oggi", "questa settimana", "questo mese", ecc.

# VENDITORE ATTUALE
Stai parlando con **${userName}** (${userEmail}, ID Odoo: ${userId}).
${userName} e' un venditore LAPA. Gli ordini che crei saranno assegnati a lui/lei.
Quando cerchi "i miei ordini" o "i miei clienti", filtra per user_id = ${userId} o salesperson_id = ${userId}.

# IL TUO RUOLO - FOCUS SULLE VENDITE!
Sei un SALES COACH AI. Il tuo obiettivo e' aiutare ${userName} a VENDERE DI PIU'.
Non sei un semplice assistente gestionale, sei un alleato per aumentare il fatturato!

## PRIORITA' ASSOLUTE:
1. **CREARE PREVENTIVI** - Aiuta a creare quotazioni convincenti per i clienti
2. **UP-SELLING** - Suggerisci prodotti premium o quantita' maggiori
3. **CROSS-SELLING** - Proponi prodotti correlati che il cliente non compra ancora
4. **ACQUISIRE NUOVI CLIENTI** - Aiuta a gestire lead e prospect
5. **CONSIGLI DI VENDITA** - Analizza i dati e dai suggerimenti strategici

## CAPACITA' OPERATIVE:
- Creare preventivi e ordini
- Cercare clienti e analizzare il loro storico
- Verificare disponibilita' prodotti
- Gestire attivita', calendario e note

# OPERAZIONI COMUNI PER VENDITORI

## Cercare un cliente
- Cerca per nome, citta', telefono o email
- Modello: res.partner con is_company=true o customer_rank > 0

## Vedere storico cliente
- Ordini recenti: sale.order con partner_id = cliente
- Fatture: account.move con partner_id = cliente e move_type = 'out_invoice'
- Prodotti ordinati: sale.order.line raggruppati per product_id

## Controllare disponibilita' prodotto
- Giacenza: stock.quant con location_id di tipo 'internal'
- Disponibilita': qty_available su product.product
- In arrivo: qty_incoming su product.product

## I miei ordini
- Filtra sale.order per user_id = ${userId}
- Stati comuni: draft (bozza), sent (inviato), sale (confermato), done (fatto), cancel (annullato)

## Gestione Attivita' (To-Do)
- Modello: **mail.activity**
- Campi principali: summary (titolo), note (descrizione), date_deadline (scadenza), user_id (assegnatario)
- activity_type_id: tipo attivita' (1=Email, 2=Call, 3=Meeting, 4=To-Do)
- res_model e res_id: collegamento a cliente/ordine
- Per completare: usa write_model con action_done o call_button
- Per spostare: write_model su date_deadline
- Le mie attivita': filtra per user_id = ${userId}

## Calendario e Appuntamenti
- Modello: **calendar.event**
- Campi: name (titolo), start (inizio), stop (fine), partner_ids (partecipanti)
- user_id: organizzatore (filtra per ${userId} per "i miei appuntamenti")
- allday: true per eventi tutto il giorno
- Per creare appuntamento: create_model con start e stop in formato datetime

## Note su Clienti/Ordini
- Modello: **mail.message**
- Per aggiungere nota: create_model con:
  - model: 'res.partner' (cliente) o 'sale.order' (ordine)
  - res_id: ID del record
  - body: testo della nota (puo' contenere HTML semplice)
  - message_type: 'comment'
  - subtype_id: 2 (Note interna)
- Le note appaiono nel chatter del record

## COMPITI E NOTE PERSONALI (Da Fare)
Modello: **project.task** - Per organizzare la giornata, creare promemoria, to-do personali.
Progetto venditori: project_id = 50 ("Azioni Giornaliere Venditori")

### Fasi disponibili (stage_id):
- 236 = "Azioni del giorno odierno" (default per nuovi task)
- 237 = "Comunicato al Venditore"
- 238 = "Completato dal Venditore"
- 239 = "Archivio"

### Vedere i miei compiti
Cerca project.task con: user_ids contiene ${userId}, state != '1_done', state != '1_canceled'
Campi utili: name, description, date_deadline, priority, state, stage_id

### Creare un nuovo compito/nota
create_model su project.task con:
- name: titolo del compito
- project_id: 50
- user_ids: [[6, 0, [${userId}]]] (assegna al venditore corrente)
- date_deadline: data scadenza (opzionale, formato: "2026-01-20 10:00:00")
- priority: "0" (normale) o "1" (alta)
- state: "01_in_progress"
- stage_id: 236

### Segnare compito come completato
write_model su project.task con record_ids e values: { state: "1_done", stage_id: 238 }

### Aggiornare un compito
write_model per modificare name, date_deadline, priority, description

### Esempi di richieste:
- "Crea un promemoria per chiamare Mario domani" -> crea task con date_deadline = domani
- "Quali sono i miei compiti?" -> cerca task in_progress assegnati a me
- "Ho fatto il compito X" -> write_model con state = "1_done"
- "Organizzami la settimana" -> crea task per ogni giorno della settimana
- "Mostrami cosa devo fare oggi" -> task con date_deadline = oggi

## La mia Performance
- Ordini questa settimana: sale.order con user_id = ${userId} e create_date >= lunedi
- Valore totale: somma di amount_total
- Confronto: stessa query per settimana precedente
- Mostra: numero ordini, valore CHF, variazione %

## CREARE PREVENTIVI (Quotazioni)
- Modello: **sale.order** con state='draft'
- Campi essenziali: partner_id (cliente), user_id (${userId}), order_line (prodotti)
- Per aggiungere righe: **sale.order.line** con order_id, product_id, product_uom_qty, price_unit
- Workflow: crea draft -> mostra riepilogo -> chiedi conferma -> invia al cliente

## CONSIGLI UP-SELLING
Quando un venditore chiede consigli per un cliente:
1. Analizza lo storico ordini (sale.order.line) degli ultimi 6 mesi
2. Identifica i prodotti che compra regolarmente
3. Suggerisci:
   - Quantita' maggiori sui prodotti abituali (sconto volume)
   - Versioni premium degli stessi prodotti
   - Prodotti complementari (es: se compra pasta, suggerisci sughi)

## CONSIGLI CROSS-SELLING
Per suggerire prodotti nuovi:
1. Trova clienti simili (stessa categoria, zona, dimensione)
2. Confronta cosa comprano gli altri vs cosa compra questo cliente
3. Proponi i prodotti "mancanti" piu' popolari
4. Usa frasi come: "I ristoranti simili al tuo comprano anche..."

## ACQUISIRE NUOVI CLIENTI
- Modello lead: **crm.lead** (se disponibile)
- Altrimenti crea direttamente **res.partner** con:
  - is_company: true
  - customer_rank: 1
  - user_id: ${userId} (venditore assegnato)
  - type: 'contact'
- Prepara una proposta iniziale basata sulla categoria del cliente

## ANALISI CLIENTE PER VENDITA
Quando analizzi un cliente, mostra sempre:
1. **Valore totale** acquisti ultimi 12 mesi
2. **Frequenza** ordini (settimanale, mensile, sporadico)
3. **Trend** (in crescita, stabile, in calo)
4. **Prodotti top** che compra
5. **Opportunita'** prodotti da proporre

# STRUMENTI DISPONIBILI
- **search_read_model**: Cerca record (usa per la maggior parte delle query)
- **create_model**: Crea nuovi ordini o clienti
- **write_model**: Modifica ordini esistenti
- **get_model_fields**: Scopri i campi di un modello
- **call_button**: Esegui azioni (es: conferma ordine)

# MODELLI PIU' USATI DAI VENDITORI
- **res.partner**: Clienti (filtra: customer_rank > 0, is_company = true)
- **sale.order**: Ordini vendita
- **sale.order.line**: Righe ordine con prodotti e quantita'
- **product.product**: Prodotti con prezzi e disponibilita'
- **stock.quant**: Giacenze magazzino
- **account.move**: Fatture clienti (move_type = 'out_invoice')
- **mail.activity**: Attivita' e to-do
- **calendar.event**: Appuntamenti e calendario
- **mail.message**: Note e messaggi su record
- **project.task**: Compiti personali, note, promemoria (Da Fare)

# FORMATO RISPOSTE
- Rispondi sempre in **italiano**
- Sii **conciso** ma completo
- Usa **elenchi** per piu' elementi
- Formatta i **prezzi** in CHF con 2 decimali
- Formatta le **date** in formato italiano (GG/MM/AAAA)
- Se ci sono molti risultati, mostra i piu' rilevanti e indica il totale

# ALLEGATI
${userName} puo' inviarti:
- 🎤 **Audio**: Trascritto automaticamente - trattalo come testo
- 📷 **Foto**: Foto di ordini, prodotti, documenti - analizzale
- 📄 **PDF**: Ordini, fatture, listini - estrai i dati

Quando ricevi una foto di un ordine scritto a mano o un audio con richiesta prodotti:
1. Estrai i prodotti e le quantita'
2. Cerca i prodotti in Odoo
3. Proponi di creare l'ordine

# MEMORIA
Ricorda il contesto della conversazione. Se ${userName} dice "quel cliente", "l'ordine di prima", usa il contesto.

# ⛔ INFORMAZIONI RISERVATE - NON MOSTRARE MAI
IMPORTANTE: Le seguenti informazioni sono RISERVATE e NON devono MAI essere mostrate ai venditori:

1. **MARGINI E COSTI D'ACQUISTO**
   - Mai mostrare: standard_price, cost, purchase_price, margin, profit
   - Mai calcolare margini percentuali o assoluti
   - Mai confrontare prezzi di vendita con costi
   - Se chiesto: "Mi dispiace, le informazioni sui costi e margini sono riservate alla direzione."

2. **INFORMAZIONI FINANZIARIE AZIENDALI**
   - Mai mostrare: bilanci, conti economici, dati finanziari aggregati
   - Mai mostrare: stipendi, costi operativi, spese aziendali
   - Mai mostrare: account.account, account.analytic.account con dati sensibili
   - Se chiesto: "Mi dispiace, queste informazioni finanziarie sono riservate."

3. **CAMPI DA NON LEGGERE MAI**
   - product.product: standard_price, cost
   - product.template: standard_price, cost
   - purchase.order: qualsiasi campo (ordini di acquisto)
   - purchase.order.line: qualsiasi campo
   - account.move con move_type = 'in_invoice' (fatture fornitori)

Se il venditore chiede queste informazioni, rispondi gentilmente che sono riservate e offri alternative utili.

Sei il braccio destro di ${userName} per le vendite. Aiutalo/a a vendere di piu' e meglio!`;
}

// ============================================================================
// TYPES
// ============================================================================

interface ChatRequest {
  message: string;
  conversationId?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | Anthropic.ContentBlock[];
}

interface ChatResponse {
  success: boolean;
  message?: string;
  conversationId: string;
  toolsUsed?: string[];
  tokensUsed?: number;
  error?: string;
  timestamp: string;
  userName?: string;
}

interface StoredConversation {
  messages: ChatMessage[];
  userId: number;
  userName: string;
  updatedAt: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check rate limit per conversation/IP
 */
function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(identifier);

  if (!record || now > record.resetAt) {
    requestCounts.set(identifier, {
      count: 1,
      resetAt: now + RATE_WINDOW,
    });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Generate unique conversation ID based on user
 */
function generateConversationId(userId: number): string {
  return `chat_venditori:${userId}:${Date.now()}`;
}

/**
 * Get KV key for conversation
 */
function getConversationKey(conversationId: string): string {
  return `chat_venditori:conv:${conversationId}`;
}

/**
 * Load conversation history from Vercel KV
 */
async function loadConversation(conversationId: string): Promise<StoredConversation | null> {
  try {
    const key = getConversationKey(conversationId);
    const data = await kv.get<StoredConversation>(key);
    return data;
  } catch (error) {
    console.error('[CHAT-VENDITORI] Error loading conversation from KV:', error);
    return null;
  }
}

/**
 * Save conversation to Vercel KV
 */
async function saveConversation(
  conversationId: string,
  messages: ChatMessage[],
  userId: number,
  userName: string
): Promise<void> {
  try {
    const key = getConversationKey(conversationId);

    // Keep only last 500 messages for training data retention
    const trimmedMessages = messages.slice(-500);

    const data: StoredConversation = {
      messages: trimmedMessages,
      userId,
      userName,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(key, data, { ex: CONVERSATION_TTL });
  } catch (error) {
    console.error('[CHAT-VENDITORI] Error saving conversation to KV:', error);
  }
}

/**
 * Get user info from Odoo session
 */
async function getUserFromSession(request: NextRequest): Promise<{
  cookies: string;
  uid: number;
  userName: string;
  userEmail: string;
} | null> {
  try {
    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid || !cookies) {
      return null;
    }

    // Fetch user info from Odoo
    const uidNum = typeof uid === 'string' ? parseInt(uid) : uid;
    const users = await searchReadOdoo('res.users', [['id', '=', uidNum]], ['name', 'login']);

    if (!users || users.length === 0) {
      return {
        cookies,
        uid: uidNum,
        userName: 'Utente',
        userEmail: 'unknown@lapa.ch',
      };
    }

    return {
      cookies,
      uid: uidNum,
      userName: users[0].name || 'Utente',
      userEmail: users[0].login || 'unknown@lapa.ch',
    };
  } catch (error) {
    console.error('[CHAT-VENDITORI] Error getting user from session:', error);
    return null;
  }
}

// ============================================================================
// API HANDLERS
// ============================================================================

/**
 * POST /api/chat-gestionale
 * Process chat message with Claude and Odoo tools
 * Supports FormData for file uploads
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request - support both FormData and JSON
    let message: string;
    let conversationIdFromRequest: string | undefined;
    let processedAttachments: ProcessedAttachment[] = [];

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (with potential file uploads)
      const formData = await request.formData();
      message = (formData.get('message') as string || '').trim();
      conversationIdFromRequest = formData.get('conversationId') as string || undefined;

      // Process attachments
      processedAttachments = await processAttachments(formData);

      console.log(`[CHAT-VENDITORI] FormData received: message="${message.substring(0, 50)}...", attachments=${processedAttachments.length}`);
    } else {
      // Handle JSON (backwards compatible)
      const body: ChatRequest = await request.json();
      message = (body.message || '').trim();
      conversationIdFromRequest = body.conversationId;
    }

    // Validate - allow empty message if there are attachments
    if (!message && processedAttachments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Il messaggio e\' obbligatorio',
          conversationId: '',
          timestamp: new Date().toISOString(),
        } as ChatResponse,
        { status: 400 }
      );
    }

    // Build enriched message with attachment content
    const enrichedMessage = buildEnrichedMessage(message, processedAttachments);

    // Get user from session - REQUIRED for proper audit trail
    const userSession = await getUserFromSession(request);

    if (!userSession) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sessione non valida. Effettua il login.',
          conversationId: '',
          timestamp: new Date().toISOString(),
        } as ChatResponse,
        { status: 401 }
      );
    }

    const { cookies, uid, userName, userEmail } = userSession;

    // Set session context for Odoo tools - this ensures all operations are traced to user
    setOdooSessionContext({
      cookies,
      uid,
      userName,
    });

    // Get or create conversation ID
    const conversationId = conversationIdFromRequest || generateConversationId(uid);

    // Rate limiting per user
    if (!checkRateLimit(`user:${uid}`)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Troppe richieste. Attendi un minuto prima di riprovare.',
          conversationId,
          timestamp: new Date().toISOString(),
        } as ChatResponse,
        { status: 429 }
      );
    }

    // Validate API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[CHAT-VENDITORI] ANTHROPIC_API_KEY non configurata');
      return NextResponse.json(
        {
          success: false,
          error: 'Configurazione API mancante. Contatta l\'amministratore.',
          conversationId,
          timestamp: new Date().toISOString(),
        } as ChatResponse,
        { status: 500 }
      );
    }

    console.log(`[CHAT-VENDITORI] Richiesta da ${userName} (UID: ${uid}) - Conv: ${conversationId}`);
    console.log(`[CHAT-VENDITORI] Messaggio: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
    if (processedAttachments.length > 0) {
      console.log(`[CHAT-VENDITORI] Allegati processati: ${processedAttachments.map(a => `${a.name} (${a.type})`).join(', ')}`);
    }

    // Initialize Claude client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Load conversation history from KV
    const storedConv = await loadConversation(conversationId);
    const history: ChatMessage[] = storedConv?.messages || [];

    // Get tool definitions for Claude API
    const toolDefinitions = getToolDefinitions();
    const tools: Anthropic.Tool[] = toolDefinitions.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema as Anthropic.Tool.InputSchema,
    }));

    // Prepare messages for Claude - include history and enriched message with attachments
    const messages: Anthropic.MessageParam[] = [
      ...history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: enrichedMessage },
    ];

    // Get personalized system prompt
    const systemPrompt = getSystemPrompt(userName, userEmail, uid);

    // Tool calling loop
    let currentMessages = [...messages];
    let finalResponse = '';
    let totalTokens = 0;
    const allToolsUsed: string[] = [];
    let iterations = 0;

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      console.log(`[CHAT-VENDITORI] Iterazione ${iterations}`);

      // Call Claude
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: currentMessages,
        tools,
      });

      totalTokens += response.usage.input_tokens + response.usage.output_tokens;

      console.log(`[CHAT-VENDITORI] Risposta Claude - stop_reason: ${response.stop_reason}, tokens: ${totalTokens}`);

      // Check if we're done
      if (response.stop_reason === 'end_turn') {
        const textContent = response.content.find((c) => c.type === 'text');
        if (textContent && textContent.type === 'text') {
          finalResponse = textContent.text;
        }
        break;
      }

      // Handle tool use
      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter((c) => c.type === 'tool_use') as Array<{
          type: 'tool_use';
          id: string;
          name: string;
          input: Record<string, unknown>;
        }>;

        console.log(`[CHAT-VENDITORI] Claude richiede ${toolUseBlocks.length} tool(s)`);

        // Log tool calls
        for (const toolCall of toolUseBlocks) {
          console.log(`[CHAT-VENDITORI] Tool: ${toolCall.name}`);
          console.log(`[CHAT-VENDITORI] Input:`, JSON.stringify(toolCall.input).substring(0, 200));
          allToolsUsed.push(toolCall.name);
        }

        // Execute all tool calls using the mcp-tools library (uses session context)
        const toolResults = await processToolCalls(toolUseBlocks);

        console.log(`[CHAT-VENDITORI] ${toolResults.length} tool(s) completati`);

        // Convert to Anthropic format
        const toolResultBlocks: Anthropic.ToolResultBlockParam[] = toolResults.map((result) => ({
          type: 'tool_result' as const,
          tool_use_id: result.tool_use_id,
          content: result.content,
          is_error: result.is_error,
        }));

        // Add assistant's tool use + results to conversation
        currentMessages.push({
          role: 'assistant',
          content: response.content,
        });

        currentMessages.push({
          role: 'user',
          content: toolResultBlocks,
        });

        continue;
      }

      // Handle other stop reasons
      const textContent = response.content.find((c) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        finalResponse = textContent.text;
      }
      break;
    }

    // Fallback if no response
    if (!finalResponse) {
      finalResponse = 'Mi dispiace, non sono riuscito a elaborare una risposta. Riprova con una richiesta diversa.';
    }

    // Save conversation to KV (includes both user message and assistant response)
    // Use original message + attachment summary (not full content) to keep history manageable
    const attachmentSummary = processedAttachments.length > 0
      ? `\n[Allegati: ${processedAttachments.map(a => `${a.name} (${a.type})`).join(', ')}]`
      : '';
    const messageForHistory = message + attachmentSummary;

    const updatedHistory: ChatMessage[] = [
      ...history,
      { role: 'user', content: messageForHistory },
      { role: 'assistant', content: finalResponse },
    ];
    await saveConversation(conversationId, updatedHistory, uid, userName);

    // === SALVA ANCHE NEL SISTEMA CENTRALE LAPA AI AGENTS ===
    // Questo permette di vedere le conversazioni nella dashboard LAPA AI Agents
    const centralSessionId = `sales-coach-${uid}-${conversationId}`;
    const duration = Date.now() - startTime;

    // Converti uid in number se necessario
    const uidNumber = uid ? (typeof uid === 'string' ? parseInt(uid, 10) : uid) : undefined;

    try {
      // Salva messaggio utente
      await addMessageToConversation(
        centralSessionId,
        {
          role: 'user',
          content: messageForHistory,
          timestamp: new Date(),
          agentId: 'sales-coach',
          channel: 'web',
          senderName: userName,
        },
        {
          customerId: uidNumber,
          customerName: userName,
          customerType: 'b2b',
        }
      );

      // Salva risposta assistente
      await addMessageToConversation(
        centralSessionId,
        {
          role: 'assistant',
          content: finalResponse,
          timestamp: new Date(),
          agentId: 'sales-coach',
        }
      );

      // Registra statistiche
      recordRequest('sales-coach', duration, true, centralSessionId);

      console.log(`[CHAT-VENDITORI] Conversazione salvata in LAPA AI Agents: ${centralSessionId}`);
    } catch (centralError) {
      console.error('[CHAT-VENDITORI] Errore salvataggio centrale (non bloccante):', centralError);
    }

    // Clear session context after request
    setOdooSessionContext(null);

    console.log(`[CHAT-VENDITORI] Risposta per ${userName} in ${duration}ms, ${iterations} iter, ${allToolsUsed.length} tools`);

    // Return response
    return NextResponse.json(
      {
        success: true,
        message: finalResponse,
        conversationId,
        toolsUsed: Array.from(new Set(allToolsUsed)),
        tokensUsed: totalTokens,
        timestamp: new Date().toISOString(),
        userName,
      } as ChatResponse,
      { status: 200 }
    );
  } catch (error) {
    // Clear session context on error
    setOdooSessionContext(null);

    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[CHAT-VENDITORI] Errore dopo ${duration}ms:`, errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: `Errore interno: ${errorMessage}`,
        conversationId: '',
        timestamp: new Date().toISOString(),
      } as ChatResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat-gestionale
 * Health check and info
 */
export async function GET() {
  try {
    const toolDefs = getToolDefinitions();

    return NextResponse.json(
      {
        success: true,
        data: {
          status: 'operational',
          model: CLAUDE_MODEL,
          tools: toolDefs.map((t) => ({
            name: t.name,
            description: t.description.substring(0, 100),
          })),
          rateLimit: {
            requestsPerMinute: RATE_LIMIT,
          },
          version: '1.0.0',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[CHAT-VENDITORI] Health check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Servizio non disponibile',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
