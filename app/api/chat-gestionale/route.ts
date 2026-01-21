/**
 * CHAT GESTIONALE - API Route
 *
 * Endpoint per comunicare con Claude AI con accesso a strumenti Odoo.
 * Permette query, creazione, aggiornamento di record tramite linguaggio naturale.
 *
 * FEATURES:
 * - Usa la sessione dell'utente loggato per audit trail
 * - Memoria conversazione persistente su Vercel KV
 * - Claude conosce l'utente con cui sta parlando
 * - Supporto multimodale: immagini, PDF (Gemini), audio (Whisper)
 *
 * POST /api/chat-gestionale
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
  console.log(`[CHAT-GESTIONALE] Transcribing audio: ${file.name} (${file.size} bytes, type: ${file.type})`);

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

  console.log(`[CHAT-GESTIONALE] Audio file prepared: ${fileName}, mime: ${mimeType}, size: ${buffer.length}`);

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

    console.log(`[CHAT-GESTIONALE] Audio transcribed successfully: ${transcription.substring(0, 100)}...`);
    return transcription;
  } catch (error: any) {
    console.error(`[CHAT-GESTIONALE] Whisper transcription error:`, error.message);
    throw new Error(`Trascrizione audio fallita: ${error.message}`);
  }
}

/**
 * Analyze image or PDF using Gemini Vision
 */
async function analyzeWithGemini(file: File): Promise<string> {
  console.log(`[CHAT-GESTIONALE] Analyzing with Gemini: ${file.name} (${file.size} bytes)`);

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

  console.log(`[CHAT-GESTIONALE] Gemini analysis complete: ${text.substring(0, 100)}...`);
  return text;
}

/**
 * Process all attachments and return extracted content
 */
async function processAttachments(formData: FormData): Promise<ProcessedAttachment[]> {
  const attachmentCount = parseInt(formData.get('attachmentCount') as string || '0');
  if (attachmentCount === 0) return [];

  console.log(`[CHAT-GESTIONALE] Processing ${attachmentCount} attachments...`);

  const processed: ProcessedAttachment[] = [];

  for (let i = 0; i < attachmentCount; i++) {
    const file = formData.get(`attachment_${i}`) as File;
    const type = formData.get(`attachment_${i}_type`) as string;

    if (!file) continue;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      console.warn(`[CHAT-GESTIONALE] File too large: ${file.name} (${file.size} bytes)`);
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
      console.error(`[CHAT-GESTIONALE] Error processing ${file.name}:`, error);
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
  // Get current date in Swiss timezone using proper timezone conversion
  // Create a formatter that outputs ISO date parts in Swiss timezone
  const swissFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const now = new Date();

  // Get ISO date in Swiss timezone (format: YYYY-MM-DD)
  const isoDateSwiss = swissFormatter.format(now); // Returns "2026-01-21" format

  // Get human-readable date in Italian
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

  return `Sei un assistente AI avanzato per la gestione di Odoo ERP di LAPA - finest italian food GmbH.

# DATA E ORA CORRENTE
Oggi è **${currentDate}** e sono le **${currentTime}** (fuso orario: Europe/Zurich).

**DATA ISO PER QUERY ODOO: ${isoDateSwiss}**

IMPORTANTE: Per tutte le query Odoo relative a "oggi", usa SEMPRE la data **${isoDateSwiss}**.
- Per "oggi": usa domain con data >= "${isoDateSwiss} 00:00:00" e data <= "${isoDateSwiss} 23:59:59"
- Per "ieri": calcola ${isoDateSwiss} - 1 giorno
- Per "questa settimana": calcola dal lunedì della settimana corrente

# UTENTE ATTUALE
Stai parlando con **${userName}** (${userEmail}, ID Odoo: ${userId}).
Tutte le operazioni che esegui verranno registrate a nome di questo utente.
Quando crei ordini o record, verranno automaticamente assegnati a ${userName}.

# CAPACITA'
1. **Interrogare dati** - Cercare e recuperare qualsiasi informazione:
   - Ordini di vendita (sale.order)
   - Fatture (account.move)
   - Prodotti (product.product, product.template)
   - Clienti e Fornitori (res.partner)
   - Picking e movimenti magazzino (stock.picking, stock.move)
   - E qualsiasi altro modello Odoo

2. **Creare record** - Inserire nuovi dati:
   - Nuovi ordini
   - Nuovi clienti
   - Nuove righe ordine
   - Ticket helpdesk
   - ecc.

3. **Aggiornare record** - Modificare dati esistenti:
   - Cambiare stato ordini
   - Aggiornare quantita'
   - Modificare date consegna
   - ecc.

4. **Eseguire azioni** - Chiamare metodi Odoo:
   - Confermare ordini
   - Validare picking
   - Inviare email
   - ecc.

# STRUMENTI DISPONIBILI
- **search_read_model**: Cerca record con filtri e restituisce dati (metodo principale)
- **create_model**: Crea nuovi record
- **write_model**: Aggiorna record esistenti
- **get_model_fields**: Ottiene la struttura dei campi di un modello
- **get_model_relations**: Ottiene le relazioni di un modello
- **call_button**: Esegue azioni button (es: action_confirm)
- **list_models**: Elenca i modelli Odoo disponibili
- **execute_method**: Esegue metodi arbitrari su modelli Odoo

# LINEE GUIDA
1. **Sicurezza**: Mai eseguire operazioni distruttive senza conferma esplicita
2. **Precisione**: Verifica sempre i dati prima di modifiche
3. **Chiarezza**: Spiega cosa stai facendo e perche'
4. **Errori**: Se qualcosa fallisce, spiega il problema in modo chiaro
5. **Limiti**: Per query grandi, usa limit per evitare timeout

# MODELLI ODOO COMUNI
- sale.order: Ordini di vendita
- sale.order.line: Righe ordine vendita
- account.move: Fatture (move_type='out_invoice' per clienti)
- account.move.line: Righe fattura
- res.partner: Clienti, fornitori, contatti
- product.product: Varianti prodotto
- product.template: Template prodotto
- stock.picking: Trasferimenti/picking
- stock.move: Movimenti magazzino
- stock.quant: Giacenze
- purchase.order: Ordini acquisto
- project.task: Compiti, task, note personali (Da Fare)
- project.project: Progetti

# COMPITI E NOTE PERSONALI (Da Fare)
Modello: **project.task** - Per organizzare compiti, creare promemoria, gestire to-do.

## Vedere i compiti dell'utente
Cerca project.task con: user_ids contiene ${userId}, state != '1_done', state != '1_canceled'
Campi utili: id, name, description, date_deadline, priority, state, stage_id, project_id, user_ids

## Creare un nuovo compito
create_model su project.task con:
- name: titolo del compito (obbligatorio)
- user_ids: [[6, 0, [${userId}]]] (assegna all'utente corrente)
- date_deadline: data scadenza (opzionale, formato: "2026-01-20 10:00:00")
- priority: "0" (normale) o "1" (alta)
- state: "01_in_progress"
- description: descrizione dettagliata (opzionale, formato HTML)

## Segnare compito come completato
write_model su project.task con record_ids e values: { state: "1_done" }

## Aggiornare un compito
write_model per modificare name, date_deadline, priority, description, user_ids

## Cercare compiti per progetto
Filtra per project_id (es: project_id = 50 per "Azioni Giornaliere Venditori")

## Esempi di richieste:
- "Crea un compito: verificare fatture" -> crea task assegnato all'utente
- "Mostrami i miei compiti" -> cerca task in_progress assegnati a me
- "Segna come fatto il compito X" -> write_model con state = "1_done"
- "Compiti di oggi" -> task con date_deadline = oggi
- "Compiti in ritardo" -> task con date_deadline < oggi e state != done

# FORMATO RISPOSTE
- Rispondi sempre in italiano
- Usa formattazione chiara con elenchi e tabelle quando appropriato
- Per dati numerici, formatta con separatori migliaia
- Per date, usa formato italiano (GG/MM/AAAA)
- Se recuperi molti dati, riassumi i punti chiave

# MEMORIA CONVERSAZIONE
Ricorda il contesto della conversazione. Se l'utente fa riferimento a qualcosa menzionato prima (es: "quello", "il cliente di prima", "l'ordine"), usa il contesto precedente per capire.

# ALLEGATI E FILE
L'utente puo' inviarti allegati (immagini, PDF, audio). Il contenuto degli allegati viene estratto automaticamente e incluso nel messaggio:
- 🎤 **Audio**: Trascritto automaticamente in testo (Whisper)
- 📷 **Immagini**: Analizzate e descritte (foto prodotti, documenti, ecc.)
- 📄 **PDF**: Estratto il contenuto testuale e dati strutturati

Quando ricevi allegati:
1. Leggi attentamente il contenuto estratto
2. Se e' un documento (fattura, ordine, DDT), estrai i dati chiave
3. Se l'utente chiede di cercare in Odoo basandoti sull'allegato, usa i dati estratti
4. Se e' un audio, considera il testo trascritto come se l'utente l'avesse scritto

Rispondi in modo professionale, conciso e utile. Sei qui per aiutare ${userName} a lavorare meglio con Odoo!`;
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
  return `chat_gestionale:${userId}:${Date.now()}`;
}

/**
 * Get KV key for conversation
 */
function getConversationKey(conversationId: string): string {
  return `chat_gestionale:conv:${conversationId}`;
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
    console.error('[CHAT-GESTIONALE] Error loading conversation from KV:', error);
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
    console.error('[CHAT-GESTIONALE] Error saving conversation to KV:', error);
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
    console.error('[CHAT-GESTIONALE] Error getting user from session:', error);
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

      console.log(`[CHAT-GESTIONALE] FormData received: message="${message.substring(0, 50)}...", attachments=${processedAttachments.length}`);
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
      console.error('[CHAT-GESTIONALE] ANTHROPIC_API_KEY non configurata');
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

    console.log(`[CHAT-GESTIONALE] Richiesta da ${userName} (UID: ${uid}) - Conv: ${conversationId}`);
    console.log(`[CHAT-GESTIONALE] Messaggio: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
    if (processedAttachments.length > 0) {
      console.log(`[CHAT-GESTIONALE] Allegati processati: ${processedAttachments.map(a => `${a.name} (${a.type})`).join(', ')}`);
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

      console.log(`[CHAT-GESTIONALE] Iterazione ${iterations}`);

      // Call Claude
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: currentMessages,
        tools,
      });

      totalTokens += response.usage.input_tokens + response.usage.output_tokens;

      console.log(`[CHAT-GESTIONALE] Risposta Claude - stop_reason: ${response.stop_reason}, tokens: ${totalTokens}`);

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

        console.log(`[CHAT-GESTIONALE] Claude richiede ${toolUseBlocks.length} tool(s)`);

        // Log tool calls
        for (const toolCall of toolUseBlocks) {
          console.log(`[CHAT-GESTIONALE] Tool: ${toolCall.name}`);
          console.log(`[CHAT-GESTIONALE] Input:`, JSON.stringify(toolCall.input).substring(0, 200));
          allToolsUsed.push(toolCall.name);
        }

        // Execute all tool calls using the mcp-tools library (uses session context)
        const toolResults = await processToolCalls(toolUseBlocks);

        console.log(`[CHAT-GESTIONALE] ${toolResults.length} tool(s) completati`);

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

    // Clear session context after request
    setOdooSessionContext(null);

    const duration = Date.now() - startTime;
    console.log(`[CHAT-GESTIONALE] Risposta per ${userName} in ${duration}ms, ${iterations} iter, ${allToolsUsed.length} tools`);

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
    console.error(`[CHAT-GESTIONALE] Errore dopo ${duration}ms:`, errorMessage);

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
    console.error('[CHAT-GESTIONALE] Health check error:', error);
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
