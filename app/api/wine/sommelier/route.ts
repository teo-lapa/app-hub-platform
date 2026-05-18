import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import {
  loadCatalog,
  searchWines,
  getWineDetails,
  findWineById,
  fuzzyFindWine,
  type SearchCriteria,
  type Tier,
} from '@/lib/wine/catalog';
import {
  getPersonalityForSlug,
  getCustomInstructionsForSlug,
  buildStyleBlock,
  PERSONALITY_PRESETS,
} from '@/lib/wine/sommelier-personality';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Language = 'it' | 'de' | 'en' | 'fr';
type Intent = 'greet' | 'clarify' | 'propose' | 'explain' | 'confirm' | 'other';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SommelierRequest {
  restaurantSlug: string;
  tableCode: string;
  language: Language;
  customerEmail?: string | null;
  messages: ChatMessage[];
  image?: { base64: string; mimeType: string };
}

interface ProposedWine {
  wineId: string;
  name: string;
  producer: string;
  region: string;
  vintage: string;
  tier: Tier;
  price_glass_chf: number;
  price_bottle_chf: number;
  reason: string;
}

interface SommelierResponse {
  reply: string;
  proposedWines?: ProposedWine[];
  intent: Intent;
  messageId: string;
}

// ── DNA SOMMELIER (cachato — system prompt fisso) ─────────────────────
// Questo blocco è IDENTICO per ogni ristorante e ogni richiesta. Anthropic
// può cachare tutto fino al prossimo blocco con cache_control.
const CORE_DNA = `Sei un sommelier digitale presente al tavolo del cliente via web app.

# IDENTITÀ
Hai una doppia formazione: **Master Sommelier (WSET Diploma)** sui vini italiani E **conoscenza profonda dei distillati italiani** (livello assaggiatore ANAG): grappe, acquaviti, distillati d'uva. Conosci a fondo le 20 regioni vitivinicole italiane, vitigni autoctoni, terroir, vinificazione, distillazione discontinua/continua, invecchiamento in legno, gradazioni alcoliche, abbinamento col cibo e col fine pasto. Conosci le classificazioni (DOC, DOCG, IGT, DOP, IGP) e sai quando rilevarle.

# REGOLE D'ABBINAMENTO (usale come griglia mentale)
- **Concordanza**: dolce con dolce (passito + dessert), aromatico con aromatico.
- **Contrapposizione**: tannino contro grasso (Nebbiolo + bistecca), acidità contro untuosità (Riesling + fritto), bollicine contro grasso (Franciacorta + salumi).
- **Tradizione territoriale**: piatto di una regione → vino di quella regione (ossobuco + Nebbiolo, branzino + Vermentino, cassoeula + Valtellina).
- **Intensità**: piatto delicato → vino delicato; piatto strutturato → vino strutturato. Mai schiacciare il piatto, mai farsi schiacciare dal piatto.
- **Preparazione**: cottura lunga / brasatura / griglia → rosso strutturato; crudo / vapore → bianco fresco o bollicine.

# SERVIZIO
Bollicine 6-8°C, bianchi giovani 8-10°C, bianchi strutturati 10-12°C, rosati 10-12°C, rossi giovani 14-16°C, rossi importanti 16-18°C, passiti 8-10°C, grappe 14-18°C in calice tulipano. Decantare i rossi importanti giovani (Barolo, Barbaresco) almeno 30-60min. I bianchi non si decantano. Ordine in un menu degustazione: bolle → bianchi leggeri → bianchi strutturati → rosati → rossi giovani → rossi importanti → dolci → distillati.

# GESTIONE CLIENTE
- Cliente vago → UNA domanda chiarificatrice mirata (bianco/rosso, piatto guida, calice/bottiglia).
- Cliente che chiede "il più caro" → proponi fascia importante con motivazione, non per vanità.
- Cliente con budget basso → fascia easy, mai farglielo pesare.
- Cliente che propone abbinamento "sbagliato" (es. rosso col pesce) → MAI correggerlo seccamente. Conferma se ha senso o suggerisci alternativa con garbo.
- Allergia solfiti / gravidanza / astemio / guida → proponi acqua/analcolico, mai insistere.
- Tavolo indeciso → 3 vini uno per fascia (easy/equilibrato/importante), così sceglie il livello.

# LUNGHEZZA E STILE
2-5 righe per messaggio (mai monologhi). Solo se il cliente chiede esplicitamente la storia di un produttore, puoi espandere fino a 8 righe. Niente markdown, niente bullet, niente grassetti: solo testo plain. Puoi usare il trattino lungo "—" e virgole. MAI inglesismi se esiste l'italiano. MAI frasi da brochure ("grande sinergia organolettica"): sempre concreto e fisico.

# COME LAVORI CON LA CANTINA — STRUMENTI
Hai 3 strumenti per accedere alla cantina del ristorante. NON conosci a memoria il catalogo: lo cerchi quando serve.

1. **search_wines(criteri)** — cerca vini per tipo, fascia, regione, vitigno, abbinamento, range prezzo. Ritorna max 8 candidati. USA SEMPRE QUESTO prima di proporre.
2. **get_wine_details(wineId)** — scheda completa di un vino: storia, note, abbinamenti, formati alternativi (magnum/jeroboam), temperatura, decantazione. Usalo se il cliente chiede dettagli su una bottiglia specifica o se devi raccontare una storia approfondita.
3. **propose_wines(wines)** — output finale: lista di vini da mostrare come card al cliente. SEMPRE l'ultimo strumento del turno quando vuoi proporre. NON nominare vini nel reply senza chiamare propose_wines.

## REGOLA DURA
Se nel "reply" nomini per nome anche solo come opzione UN QUALUNQUE vino, DEVI chiamare propose_wines con quel vino (wineId esatto preso dal risultato di search_wines). Una bottiglia nominata senza card è un errore grave: il cliente non vede né foto né prezzi.

# REGOLA DEI FORMATI (DURA)
Default SEMPRE 75cl (vini), 70cl (grappe), 37.5cl (passito). NON proporre MAI di tua iniziativa magnum, jeroboam o formati grandi. Solo se il cliente li chiede esplicitamente OPPURE hai capito con certezza che il tavolo è 4-5+ persone — e in quel caso CHIEDI conferma prima ("siete una bella tavolata, vi servo un magnum o due bottiglie standard?"). Per jeroboam/6L/12L: avvisa preorder 24-48h.

# VINCOLI ASSOLUTI
- MAI inventare wineId: usa SOLO quelli ritornati da search_wines o get_wine_details.
- MAI proporre vini fuori cantina (se search_wines non trova nulla, dillo onestamente e chiedi se cambiare criteri).
- MAI consigliare altri ristoranti o bottiglie esterne.
- MAI politica, religione, sconti aggressivi, polemiche.
- Fuori tema (cibo, conto, ecc): redirigi al cameriere con garbo.

# CONOSCENZE PROFONDE QUANDO CAPITANO IN CARTA
- **Distillerie Berta** (Mombaruzzo, Piemonte, dal 1947, terza generazione): distillazione discontinua a vapore con alambicchi a bagnomaria, lunghi invecchiamenti in rovere francese/allier/slavonia. Linee: Tra Noi (entry, 42%), Riserve (43%, monovitigno o blend). Iconiche: Roccanivo (Barbera d'Asti), Tre Soli Tre (Nebbiolo Barolo), Bric del Gaian (Moscato d'Asti), Casalotto (acquavite di vino, eleganza unica), Paolo Berta (top range). Servire 14-18°C calice tulipano, mai ghiaccio. Abbinamenti: digestivo dopo carni rosse, con dolci (Bric del Gaian + nocciole, Casalotto + cioccolato fondente), da meditazione.
- **Mura Mura** (Piemonte): progetto di Federico Grom (sì, il gelato Grom). Vini di territorio piemontese, etichette con nomi shakespeariani (Romeo, Mercuzio, Iago, Beatrice).
- **Ca' del Bosco** (Franciacorta): Annamaria Clementi e Maurizio Zanella, riferimento assoluto del metodo classico italiano.
- **L'Anima di Vergani**: linea proprietaria dell'importatore, taglio prezzo-qualità.
- **Tessari** (Soave, Veneto): famiglia storica, riferimento per il Soave Classico.
- **Moscato Passito Ofelia** di Mura Mura: Moscato bianco appassito sulle stuoie, vendemmia tardiva, fermentazione spontanea, 37.5cl. Note miele d'acacia, albicocca, camomilla, finale agrumato. 8-10°C calice piccolo. Perfetto con pasticceria secca, formaggi erborinati, foie gras, fine pasto.

# CONFERMA SCELTA
Quando il cliente sceglie chiaramente un vino ("ok lo prendo", "va bene quello", "sì il Romeo"), rispondi con conferma calda ("Ottima scelta, lo segno al cameriere") e setta intent="confirm". NON serve richiamare propose_wines in questa fase: la card è già stata mostrata.`;

// ── DEFINIZIONE TOOLS ─────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'search_wines',
    description:
      'Cerca vini nella cantina del ristorante. Ritorna max 8 candidati che matchano i criteri (vuoti = top vini di tutte le fasce). Default solo formati standard 75/70/37.5cl. Usa questo PRIMA di proporre qualsiasi vino al cliente.',
    input_schema: {
      type: 'object',
      properties: {
        wine_type: {
          oneOf: [
            { type: 'string', enum: ['spumante', 'bianco', 'rosato', 'rosso', 'passito', 'dolce', 'grappa', 'distillato'] },
            { type: 'array', items: { type: 'string', enum: ['spumante', 'bianco', 'rosato', 'rosso', 'passito', 'dolce', 'grappa', 'distillato'] } },
          ],
          description: 'Tipologia. Una stringa o array.',
        },
        fascia: {
          oneOf: [
            { type: 'string', enum: ['easy', 'equilibrato', 'importante'] },
            { type: 'array', items: { type: 'string', enum: ['easy', 'equilibrato', 'importante'] } },
          ],
          description: 'Fascia prezzo/qualità.',
        },
        region: { type: 'string', description: 'Regione italiana (es. "Piemonte", "Veneto", "Toscana").' },
        grape: { type: 'string', description: 'Vitigno (es. "Nebbiolo", "Vermentino").' },
        pairing_keyword: { type: 'string', description: 'Keyword di abbinamento (es. "carne rossa", "pesce", "formaggi", "dessert").' },
        max_price_bottle_chf: { type: 'number', description: 'Prezzo max bottiglia 75cl in CHF.' },
        min_price_bottle_chf: { type: 'number', description: 'Prezzo min bottiglia 75cl in CHF.' },
        query: { type: 'string', description: 'Testo libero, cerca in nome/produttore/regione/denominazione.' },
        limit: { type: 'number', description: 'Max risultati (default 8, max 12).' },
      },
    },
  },
  {
    name: 'get_wine_details',
    description: 'Scheda completa di un vino specifico (storia, note, abbinamenti, formati alternativi, temperatura, decantazione). Usalo per raccontare in profondità o per scoprire formati grandi disponibili.',
    input_schema: {
      type: 'object',
      properties: { wineId: { type: 'string', description: 'ID esatto del vino da search_wines.' } },
      required: ['wineId'],
    },
  },
  {
    name: 'propose_wines',
    description:
      "STRUMENTO FINALE del turno quando vuoi proporre vini al cliente. Genera le card visuali. SEMPRE chiamato se nomini un vino nel reply. Il 'reply' resta sintetico (1-3 righe) — la card mostra già nome/prezzi/foto.",
    input_schema: {
      type: 'object',
      properties: {
        reply: { type: 'string', description: 'Messaggio testuale al cliente, 1-3 righe, nella lingua richiesta. Spiega motivazione/storia, NON ripetere il prezzo.' },
        wines: {
          type: 'array',
          minItems: 1,
          maxItems: 4,
          items: {
            type: 'object',
            properties: {
              wineId: { type: 'string', description: 'wineId esatto da search_wines.' },
              tier: { type: 'string', enum: ['easy', 'equilibrato', 'importante'] },
              reason: { type: 'string', description: 'Una riga, perché questo vino, nella lingua del reply.' },
            },
            required: ['wineId', 'tier', 'reason'],
          },
        },
      },
      required: ['reply', 'wines'],
    },
  },
  {
    name: 'final_reply',
    description: "Output finale del turno SENZA proporre vini (saluto, domanda chiarificatrice, spiegazione, conferma scelta). Usa questo quando il reply NON nomina alcun vino.",
    input_schema: {
      type: 'object',
      properties: {
        reply: { type: 'string', description: 'Messaggio al cliente, 1-4 righe, lingua richiesta.' },
        intent: { type: 'string', enum: ['greet', 'clarify', 'explain', 'confirm', 'other'] },
      },
      required: ['reply', 'intent'],
    },
  },
];

interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  id: string;
}

function buildContextBlock(slug: string, table: string, language: Language, personalityStyle: string): string {
  const langMap: Record<Language, string> = { it: 'italiano', de: 'tedesco (Hochdeutsch)', en: 'inglese', fr: 'francese' };
  return `${personalityStyle}

# CONTESTO DEL TURNO
- Ristorante: "${slug}"
- Tavolo: ${table}
- Lingua del cliente (per "reply" e "reason"): ${langMap[language]}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SommelierRequest;
    const { restaurantSlug, tableCode, language, customerEmail, messages, image } = body;

    if (!restaurantSlug || !language || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: restaurantSlug, language, messages[]' }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[SOMMELIER] ANTHROPIC_API_KEY missing');
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing on this environment' }, { status: 500 });
    }

    // Pre-load catalogo (warmup cache modulo)
    loadCatalog();

    const personalityId = await getPersonalityForSlug(restaurantSlug);
    const customInstructions = await getCustomInstructionsForSlug(restaurantSlug);
    const styleBlock = buildStyleBlock(personalityId, customInstructions);

    console.log('[SOMMELIER] Request:', { restaurantSlug, tableCode, language, customerEmail, turns: messages.length, personality: personalityId, customLen: customInstructions.length });

    // System prompt = [CORE_DNA cachato] + [contesto variabile non cachato]
    const systemBlocks = [
      { type: 'text' as const, text: CORE_DNA, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: buildContextBlock(restaurantSlug, tableCode, language, styleBlock) },
    ];

    // Costruisci messages per Anthropic. Eventuale immagine attaccata all'ultimo user.
    type AnthropicMsg = { role: 'user' | 'assistant'; content: any };
    const claudeMessages: AnthropicMsg[] = messages.map((m, idx) => {
      const isLastUser = idx === messages.length - 1 && m.role === 'user';
      if (isLastUser && image && image.base64) {
        return {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.mimeType || 'image/jpeg', data: image.base64 } },
            { type: 'text', text: m.content || 'Ecco la foto del piatto al tavolo. Cosa mi consigli?' },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });

    // ── Loop agentic: chiama Claude, esegui tool, ripeti finché propose_wines/final_reply ──
    const MAX_ITER = 6;
    let finalReply: string | null = null;
    let finalIntent: Intent = 'other';
    let finalProposed: ProposedWine[] = [];
    const toolCallsLog: { name: string; input: Record<string, unknown> }[] = [];

    for (let iter = 0; iter < MAX_ITER; iter++) {
      const completion = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1500,
        system: systemBlocks,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: TOOLS as any,
        tool_choice: { type: 'auto' },
        messages: claudeMessages,
      });

      // Log cache usage al primo giro
      if (iter === 0) {
        const u = completion.usage as unknown as Record<string, number | undefined>;
        console.log('[SOMMELIER] Usage iter0:', {
          input: u.input_tokens,
          cache_create: u.cache_creation_input_tokens,
          cache_read: u.cache_read_input_tokens,
          output: u.output_tokens,
        });
      }

      // Estrai tool_use blocks
      const toolUses = completion.content.filter((c) => c.type === 'tool_use') as Array<{
        type: 'tool_use';
        id: string;
        name: string;
        input: Record<string, unknown>;
      }>;

      if (toolUses.length === 0) {
        // Modello ha risposto solo testo — fallback: usa il testo come reply
        const textBlock = completion.content.find((c) => c.type === 'text');
        if (textBlock && textBlock.type === 'text') {
          finalReply = textBlock.text.trim();
          finalIntent = 'other';
        }
        break;
      }

      // Aggiungi assistant message con tool_use al thread
      claudeMessages.push({ role: 'assistant', content: completion.content });

      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }> = [];
      let stopLoop = false;

      for (const tu of toolUses) {
        toolCallsLog.push({ name: tu.name, input: tu.input });

        if (tu.name === 'search_wines') {
          const criteria = tu.input as SearchCriteria;
          const results = searchWines(criteria);
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify({ count: results.length, wines: results }) });
        } else if (tu.name === 'get_wine_details') {
          const wineId = String(tu.input.wineId || '');
          let det = getWineDetails(wineId);
          if (!det) {
            const fuzzy = fuzzyFindWine(wineId);
            if (fuzzy) det = getWineDetails(fuzzy.wineId);
          }
          if (!det) {
            toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify({ error: 'wine_not_found', wineId }), is_error: true });
          } else {
            toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(det) });
          }
        } else if (tu.name === 'propose_wines') {
          const input = tu.input as { reply: string; wines: { wineId: string; tier: Tier; reason: string }[] };
          const proposed: ProposedWine[] = [];
          const skipped: string[] = [];
          for (const cw of input.wines || []) {
            let w = findWineById(cw.wineId);
            if (!w) {
              const fuzzy = fuzzyFindWine(cw.wineId);
              if (fuzzy) w = fuzzy;
            }
            if (!w) {
              skipped.push(cw.wineId);
              continue;
            }
            proposed.push({
              wineId: w.wineId,
              name: w.name,
              producer: w.producer,
              region: w.region,
              vintage: w.vintage,
              tier: cw.tier ?? w.fascia,
              price_glass_chf: w.price_glass_chf,
              price_bottle_chf: w.price_bottle_chf,
              reason: cw.reason ?? '',
            });
          }
          if (proposed.length === 0 && (input.wines || []).length > 0) {
            // Tutti scartati — chiedi al modello di ricercare e riprovare
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify({ error: 'no_valid_wines', skipped, hint: 'Usa search_wines per trovare wineId validi.' }),
              is_error: true,
            });
          } else {
            finalReply = input.reply;
            finalIntent = 'propose';
            finalProposed = proposed;
            toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify({ ok: true, count: proposed.length }) });
            stopLoop = true;
          }
        } else if (tu.name === 'final_reply') {
          const input = tu.input as { reply: string; intent: Intent };
          finalReply = input.reply;
          finalIntent = input.intent || 'other';
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify({ ok: true }) });
          stopLoop = true;
        } else {
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify({ error: 'unknown_tool' }), is_error: true });
        }
      }

      claudeMessages.push({ role: 'user', content: toolResults });

      if (stopLoop) break;
    }

    if (!finalReply) {
      throw new Error('Sommelier did not produce a final reply within iteration budget');
    }

    const messageId = randomUUID();
    console.log('[SOMMELIER] Reply:', messageId, 'intent=' + finalIntent, 'wines=' + finalProposed.map((p) => p.wineId).join(','), 'tools=' + toolCallsLog.map((t) => t.name).join('>'));

    const response: SommelierResponse = {
      reply: finalReply,
      intent: finalIntent,
      messageId,
      ...(finalProposed.length ? { proposedWines: finalProposed } : {}),
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const stack = err instanceof Error ? err.stack : undefined;
    const apiStatus = err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : undefined;
    console.error('[SOMMELIER] Error:', message, { apiStatus, stack });
    return NextResponse.json({ error: `Sommelier failed: ${message}`, apiStatus }, { status: 500 });
  }
}
