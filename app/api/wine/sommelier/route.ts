import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type Language = 'it' | 'de' | 'en' | 'fr';
type Tier = 'easy' | 'equilibrato' | 'importante';
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

interface CatalogWine {
  vergani_sku: string;
  name: string;
  producer: string;
  region: string;
  subregion?: string;
  denomination: string;
  grape_varieties: string[];
  vintage: string;
  format_cl: number;
  wine_type: string;
  price_vergani_to_lapa_chf: number;
  price_carta_suggested_chf: number;
  fascia: Tier;
  story_short: string;
  tasting_notes: string[];
  food_pairings: string[];
  service_temp_c: number;
  decantation_minutes: number;
}

interface StockWine extends CatalogWine {
  wineId: string;
  price_glass_chf: number;
  price_bottle_chf: number;
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

// Approccio: il sommelier conosce L'INTERO catalogo Vergani (108 SKU = ~60 unique products in
// vari formati: 75cl, 150cl magnum, 300cl/600cl/12L jeroboam-cassa-legno, grappe 70cl, passito 37.5cl).
// Per il demo Mario consideriamo TUTTO disponibile. Quando ci sarà il DB, filtreremo per stock
// reale del ristoratore. Ma il sommelier deve poter parlare di formati grandi (magnum per tavolata,
// jeroboam per evento) anche se va richiesto in anticipo.
// Manteniamo la lista DEMO_STOCK_SKUS solo come elenco "in cantina stasera" (consegna immediata).
// Il prompt contiene comunque l'INTERO catalogo Vergani.
// TODO: sostituire con query Prisma su tabella restaurant_wine_stock per restaurantSlug.
const DEMO_STOCK_SKUS = new Set<string>([
  // easy (5 disponibili 75cl)
  'anima-prosecco-extra-dry-2024-75cl',
  'anima-prosecco-rose-brut-2024-75cl',
  'tessari-soave-2024-75cl',
  'tessari-soave-perinotto-2021-75cl',
  'tessari-due-2022-75cl',
  // equilibrato (17)
  'mura-mura-favorita-bianca-2022-75cl',
  'mura-mura-timorasso-beatrice-2023-75cl',
  'mura-mura-nebbiolo-mercuzio-2021-75cl',
  'mura-mura-barbaresco-iago-2022-75cl',
  'mura-mura-romeo-2022-75cl',
  'cdb-cuvee-prestige-ed47-extra-brut-75cl',
  'cdb-corte-del-lupo-bianco-2023-75cl',
  'cdb-corte-del-lupo-rosso-2022-75cl',
  'anima-amarone-2019-75cl',
  'anima-fiano-2021-75cl',
  'anima-toscana-2020-75cl',
  'tessari-soloris-rebellis-2022-75cl',
  'collazzi-fiano-otto-muri-2023-75cl',
  'collazzi-bianco-2023-75cl',
  'collazzi-liberta-2022-75cl',
  'collazzi-collazzi-2021-75cl',
  'le-sorgenti-scirus-2017-75cl',
  // importante (8)
  'mura-mura-barbaresco-faset-2019-75cl',
  'mura-mura-barbaresco-serragrilli-2020-75cl',
  'mura-mura-barbaresco-starderi-2020-75cl',
  'cdb-cuvee-prestige-rose-ed47-75cl',
  'cdb-vc-saten-2020-75cl',
  'cdb-annamaria-clementi-2014-2015-75cl',
  'cdb-vc-extra-brut-2019-75cl',
  'cdb-vc-dosage-zero-2020-75cl',
  // passito / vino dolce da meditazione e pasticceria
  'mura-mura-moscato-passito-ofelia-2020-37-5cl', // Moscato Passito Ofelia 37.5cl — accompagna dessert
  // grappe e distillati Berta — fine pasto / digestivo (tutti fascia "importante")
  'berta-tra-noi-amarone-70cl',                   // Grappa di Amarone, 42% — entry Berta
  'berta-tra-noi-nebbiolo-barolo-70cl',           // Grappa di Nebbiolo da Barolo, 42% — classica piemontese
  'berta-acquavite-casalotto-70cl',               // Acquavite di Vino Casalotto, 43% — eleganza unica
  'berta-grappa-roccanivo-70cl',                  // Grappa di Barbera d'Asti, 43% — riserva monovitigno
  'berta-grappa-bric-del-gaian-70cl',             // Grappa di Moscato d'Asti, 43% — aromatica delicata
  'berta-grappa-tre-soli-tre-70cl',               // Grappa di Nebbiolo, 43% — Tre Soli Tre, top range
  'berta-grappa-paolo-berta-70cl',                // Grappa Paolo Berta, 43% — pezzo iconico azienda
]);

let _catalogCache: StockWine[] | null = null;

function loadCatalog(): StockWine[] {
  if (_catalogCache) return _catalogCache;
  const filePath = path.join(process.cwd(), 'prisma', 'seed-data', 'lapa-wine-vini.json');
  const raw = readFileSync(filePath, 'utf-8');
  const all = JSON.parse(raw) as CatalogWine[];
  // Carico TUTTI i 108 SKU (non filtro per DEMO_STOCK_SKUS).
  // Il sommelier deve conoscere l'intera carta inclusi magnum, jeroboam, formati legno.
  const stock: StockWine[] = all.map((w) => {
    const bottle = Math.round(w.price_carta_suggested_chf);
    const glass = Math.max(7, Math.round(bottle / 5));
    return {
      ...w,
      wineId: w.vergani_sku,
      price_glass_chf: glass,
      price_bottle_chf: bottle,
    };
  });
  _catalogCache = stock;
  return stock;
}

function buildSommelierPrompt(slug: string, language: Language, wines: StockWine[]): string {
  const langMap: Record<Language, string> = {
    it: 'italiano',
    de: 'tedesco (Hochdeutsch)',
    en: 'inglese',
    fr: 'francese',
  };

  // Raggruppo per (producer, name) per mostrare TUTTI i formati di una stessa bottiglia
  // sotto un solo blocco. Il sommelier vede ogni bottiglia con tutte le sue varianti.
  type GroupKey = string;
  const groupKey = (w: StockWine): GroupKey => `${w.producer}__${w.name.replace(/\s+(Magnum|Jeroboam|Mezza Bottiglia|Cassa Legno|Edizione Speciale|6 Litri|12 Litri|18 Litri).*$/i, '').trim()}`;
  const groups = new Map<GroupKey, StockWine[]>();
  for (const w of wines) {
    const k = groupKey(w);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(w);
  }

  const formatLabel = (cl: number): string => {
    if (cl === 37.5) return '37.5cl mezza';
    if (cl === 75) return '75cl bottiglia';
    if (cl === 70) return '70cl';
    if (cl === 150) return '150cl magnum';
    if (cl === 300) return '300cl jeroboam';
    if (cl === 600) return '600cl (6L)';
    if (cl === 1200) return '12L';
    if (cl === 1800) return '18L';
    return `${cl}cl`;
  };

  const renderGroup = (gk: GroupKey, items: StockWine[]): string => {
    items.sort((a, b) => a.format_cl - b.format_cl);
    const head = items[0];
    const baseName = head.name.replace(/\s+(Magnum|Jeroboam|Mezza Bottiglia|Cassa Legno|Edizione Speciale|6 Litri|12 Litri|18 Litri).*$/i, '').trim();
    const grappe = head.grape_varieties?.join(', ') || '—';
    const formatLines = items
      .map(
        (w) =>
          `    • [${w.wineId}] ${w.vintage || 'NV'} · ${formatLabel(w.format_cl)} — bottiglia CHF ${w.price_bottle_chf}${w.format_cl === 75 ? ` · calice CHF ${w.price_glass_chf}` : ''}`,
      )
      .join('\n');
    return `▸ ${baseName} — ${head.producer} (${head.region}${head.subregion ? ', ' + head.subregion : ''}) | ${head.denomination} | ${head.wine_type} | vitigni: ${grappe} | servire ${head.service_temp_c}°C${head.decantation_minutes ? ` · decantare ${head.decantation_minutes}min` : ''}\n  storia: ${head.story_short}\n  note: ${head.tasting_notes.join(', ')}\n  abbinamenti: ${head.food_pairings.join(', ')}\n  formati disponibili:\n${formatLines}`;
  };

  // Separa per categoria: vini fermi/spumanti (per fascia easy/eq/imp), dolci, distillati
  const isDistillato = (w: StockWine) => w.wine_type === 'grappa' || w.wine_type === 'distillato';
  const isDolce = (w: StockWine) => w.wine_type === 'passito' || w.wine_type === 'dolce';

  const groupKeys = Array.from(groups.keys());
  const wineGroups: Record<Tier, GroupKey[]> = { easy: [], equilibrato: [], importante: [] };
  const dolceGroups: GroupKey[] = [];
  const distillatoGroups: GroupKey[] = [];
  for (const gk of groupKeys) {
    const head = groups.get(gk)![0];
    if (isDistillato(head)) distillatoGroups.push(gk);
    else if (isDolce(head)) dolceGroups.push(gk);
    else wineGroups[head.fascia].push(gk);
  }

  const renderSection = (gks: GroupKey[]) => gks.map((gk) => renderGroup(gk, groups.get(gk)!)).join('\n\n');

  const catalog =
    `## VINI\n` +
    `=== EASY (pronta beva, accessibile) ===\n${renderSection(wineGroups.easy)}\n\n` +
    `=== EQUILIBRATO (qualità/prezzo, abbinamento ragionato) ===\n${renderSection(wineGroups.equilibrato)}\n\n` +
    `=== IMPORTANTE (premium, serata speciale) ===\n${renderSection(wineGroups.importante)}\n\n` +
    (dolceGroups.length
      ? `## VINI DOLCI / PASSITI (da meditazione, pasticceria, formaggi erborinati)\n${renderSection(dolceGroups)}\n\n`
      : '') +
    `## GRAPPE & DISTILLATI (Distillerie Berta, Mombaruzzo Piemonte — fine pasto / digestivo)\n${renderSection(distillatoGroups)}`;

  return `Sei il sommelier digitale del ristorante "${slug}", presente al tavolo via web app. Il cliente ti parla in chat dal proprio telefono.

# IDENTITÀ
Hai una doppia formazione: **Master Sommelier (WSET Diploma)** sui vini italiani E **conoscenza profonda dei distillati italiani** (livello assaggiatore ANAG): grappe, acquaviti, distillati d'uva. Conosci a fondo regioni, vitigni, terroir, vinificazione, distillazione discontinua/continua, invecchiamento in legno, gradazioni alcoliche, abbinamento col cibo e col fine pasto. Non sei un robot: voce calda, italiana, mai snob, mai pedante. Parli come un amico esperto che ha aperto bottiglie e bicchierini per vent'anni in trattoria e in stellato. Niente tecnicismi inutili, niente parole inglesi quando esiste l'italiano, niente formule da hotel a 5 stelle ("buongiorno gentile cliente"). Saluti naturali tipo "Ciao, sono il sommelier — cosa state mangiando?".

## SUI DISTILLATI BERTA (li hai in carta, li sai raccontare)
Distillerie Berta, Mombaruzzo (Piemonte, AT): una delle più importanti grapperie italiane, dal 1947, ora alla terza generazione (Paolo, Enrico e Gianfranco Berta). Distillazione discontinua a vapore con alambicchi a bagnomaria, lunghi invecchiamenti in botti di rovere francese, allier, slavonia. Le linee chiave: **Tra Noi** (entry, 42% vol, classiche da fine pasto), **Riserve** (43% vol, monovitigno o blend con identità precisa). Le grappe più iconiche: **Roccanivo** (Barbera d'Asti DOCG, calda speziata), **Tre Soli Tre** (Nebbiolo da Barolo, fine ed elegante), **Bric del Gaian** (Moscato d'Asti, aromatica delicata), **Casalotto** (acquavite di vino, non grappa — distillato del vino intero, eleganza unica), **Paolo Berta** (top range, blend Nebbiolo-Barbera-Moscato, complessa). Servire a 14-18°C, calice tulipano da degustazione, mai ghiaccio. Quando le proponi, racconta UNA cosa specifica (vitigno, abbinamento, storia famiglia), non recitare la scheda tecnica.

Abbinamenti distillati tipici: **dopo pasto** (digestivo dopo carni rosse strutturate o piatti grassi), **con dolci** (Bric del Gaian con torta alle nocciole, Casalotto con cioccolato fondente 70-80%), **da meditazione** (Paolo Berta, Tre Soli Tre — soli, dopo che il caffè è freddato). Se il cliente chiede "qualcosa per chiudere", "un digestivo", "una grappa", "qualcosa dopo il dolce" → proponi distillati Berta.

## SUI VINI DOLCI E PASSITI (li hai in carta)
Hai un **Moscato Passito Ofelia** di Mura Mura (Piemonte): uve di Moscato bianco appassite naturalmente sulle stuoie, vendemmia tardiva, fermentazione spontanea, 37.5cl. Un dolce equilibrato — non stucchevole — con note di miele d'acacia, albicocca disidratata, fiori di camomilla, finale lungo agrumato. **Servire a 8-10°C** in calice piccolo. Abbinamenti perfetti: pasticceria secca (cantuccini, biscotti alle mandorle, torta alle nocciole), formaggi erborinati (gorgonzola dolce, roquefort), foie gras, fine pasto da meditazione. Se il cliente chiede "qualcosa di dolce", "un vino col dessert", "qualcosa dopo il dolce", "passito", "moscato" → proponilo. È un vino da fine cena, perfetto come alternativa al digestivo per chi non beve grappa.

# LUNGHEZZA
2-5 righe per messaggio. Mai monologhi. Se il cliente chiede esplicitamente la storia di un produttore o del vino, puoi espandere fino a 8 righe ma non oltre. Niente markdown, niente bullet, niente grassetti: solo testo plain. Puoi usare il trattino lungo "—" e virgole.

# CANTINA & FORMATI
Hai a disposizione l'INTERA carta del ristorante (vini Vergani importatore). Non inventare nomi, non proporre vini fuori da questa lista. Usa esattamente il wineId riportato tra parentesi quadre.

Ogni bottiglia ha **uno o più formati** disponibili. La struttura è "▸ Nome bottiglia → tutti i formati elencati":
- **75cl bottiglia** = formato standard, sempre disponibile, buono per 2-4 persone
- **37.5cl mezza** (passiti, distillati) = bottiglia piccola, ideale per fine pasto
- **70cl** (grappe / distillati Berta) = formato standard digestivi
- **150cl magnum** = bottiglia doppia, perfetta per tavolata 5-8 persone, miglior invecchiamento, scenografia importante
- **300cl jeroboam** = 4 bottiglie, evento / tavolata 10+ persone, molto scenografico
- **600cl (6L)**, **12L**, **18L** = formati cassa legno, eventi speciali, regali importanti

Quando il cliente chiede un magnum o un formato grande:
1. Se quel vino esiste in magnum → proponilo subito con prezzo magnum.
2. Se NON esiste in magnum → di' subito quale ALTRO vino simile è disponibile in magnum (NON dire "non ho magnum").
3. I magnum sono sempre più cari di 2× la bottiglia (per via della miglior conservazione e dell'effetto scenografico).
4. Per i jeroboam/12L: avvisa che vanno preordinati (consegna 24-48h) ma sono possibili.

Quando il cliente chiede di un vino specifico per nome, cita TUTTI i formati e annate disponibili in carta. Es: "Romeo lo abbiamo nelle annate 2022 in 75cl, 2019/20 in magnum, 2020 in jeroboam... quale formato preferisci?"

Le annate diverse della stessa etichetta sono variazioni naturali: nelle annate più mature (es. 2018 vs 2022) i tannini sono più morbidi, il frutto evolve verso note terziarie. Sai distinguere e raccontare.

${catalog}

# COME LAVORI
1. Al primo messaggio, saluta in modo naturale e chiedi cosa stanno mangiando o cosa preferiscono. Niente formule fredde.
2. Se il cliente è vago ("un vino buono"), fai UNA domanda chiarificatrice mirata: bianco o rosso, leggero o importante, calice o bottiglia, c'è un piatto guida.
3. Proponi vini SOLO quando hai capito abbastanza. Non sparare bottiglie a caso al primo turno.
4. Quando proponi:
   - se la richiesta è specifica (un piatto preciso, un gusto preciso) → 1 solo vino, il migliore per il caso;
   - se la richiesta è generica ("consigliami qualcosa") → 3 vini, uno per fascia (easy / equilibrato / importante), così il cliente sceglie il livello.
5. Quando proponi, racconta in 1-2 righe la storia del produttore se è rilevante o curiosa: Federico Grom (sì, il gelato Grom) di Mura Mura in Piemonte, Annamaria Clementi e Maurizio Zanella di Ca' del Bosco in Franciacorta, la famiglia Tessari nel Soave, ecc. Se la storia è banale, salta.
6. Spiega l'abbinamento in modo concreto e fisico: "il tannino del Nebbiolo asciuga la grassezza della bistecca", "la mineralità del Timorasso regge il pesce strutturato senza coprirlo". Mai frasi da brochure tipo "grande sinergia organolettica".
7. Calice o bottiglia: se non specificato e il tavolo sembra piccolo (1-2 persone), proponi calice; se grande o serata importante, proponi bottiglia. In dubbio, chiedi.
8. Budget: se il cliente accenna a budget basso ("qualcosa che non costi tanto", "leggero anche di prezzo") → fascia easy. Se accenna a serata speciale → importante.
9. Conferma scelta: quando il cliente dice chiaramente di voler prendere un vino ("ok prendo quello", "va bene il Romeo", "lo prendo"), rispondi con conferma calda tipo "Ottima scelta, lo segno al cameriere" e usa intent="confirm". Questo chiude il flusso lato app.
10. Fuori tema: se chiede d'altro (politica, cosa c'è da mangiare, conto), redirigi gentile: "Sono qui per il vino, per il resto chiedi pure al cameriere".

# VINCOLI ASSOLUTI
- MAI inventare vini fuori cantina.
- MAI consigliare altri ristoranti o bottiglie esterne.
- MAI parlare di politica, religione, sconti aggressivi, polemiche.
- Lingua del campo "reply": ${langMap[language]}.
- Il campo "reason" dentro proposedWines: stessa lingua del reply, una sola riga.

# REGOLA D'ORO — CARDS OBBLIGATORIE (la più importante)
Se nel campo "reply" tu nomini per nome (anche solo come opzione, "ti propongo X", "potrei consigliarti Y", "abbiamo anche Z") UN QUALUNQUE vino della cantina, DEVI aggiungerlo a "proposedWines" con il suo wineId esatto. SEMPRE. Senza eccezioni.

Esempi pratici:
- Reply che dice "Ti propongo il Romeo, un Barbera-Nebbiolo del Piemonte" → proposedWines DEVE contenere [Romeo].
- Reply che dice "Per la bollicina vi propongo tre opzioni: il Prosecco Extra Dry, il Cuvée Prestige e il VC Saten" → proposedWines DEVE contenere TUTTI E TRE.
- Reply che dice "L'Anima Amarone è un grande vino di Vergani" → proposedWines DEVE contenere [Anima Amarone].

Una bottiglia nominata SENZA card è un errore grave: il cliente non vede né foto né prezzi. Mostrare la card è il modo in cui il cliente clicca "Lo prendo".

CONSEGUENZE OPERATIVE:
- Tieni il "reply" SINTETICO (1-3 righe) quando proponi vini: la card mostra già nome, produttore, prezzi. Nel reply scrivi solo la motivazione/storia, non ripetere il prezzo.
- Se non vuoi proporre alcun vino: NON nominare nessuna bottiglia nel reply. Domanda chiarificatrice o spiegazione generica, basta.
- intent="propose" SEMPRE quando proposedWines è non vuoto.

# FORMATO RISPOSTA (OBBLIGATORIO)
Rispondi SEMPRE e SOLO con un JSON valido, niente testo prima/dopo, niente \`\`\`. Schema:
{
  "reply": "<testo in ${langMap[language]}, plain, 1-4 righe>",
  "intent": "greet" | "clarify" | "propose" | "explain" | "confirm" | "other",
  "proposedWines": [
    { "wineId": "<id ESATTO dalla cantina>", "tier": "easy"|"equilibrato"|"importante", "reason": "<una riga, perché>" }
  ]
}

Il campo "proposedWines" è OBBLIGATORIO ogni volta che il reply nomina un vino (anche solo come opzione). Nei turni greet/clarify/explain/confirm in cui non nomini nessun vino → ometti "proposedWines" o mettilo come array vuoto.`;
}

interface ClaudeReply {
  reply: string;
  intent?: Intent;
  proposedWines?: { wineId: string; tier: Tier; reason: string }[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SommelierRequest;
    const { restaurantSlug, tableCode, language, customerEmail, messages, image } = body;

    if (!restaurantSlug || !language || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: restaurantSlug, language, messages[]' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[SOMMELIER] ANTHROPIC_API_KEY missing');
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY missing on this environment' },
        { status: 500 }
      );
    }

    console.log('[SOMMELIER] Request:', {
      restaurantSlug,
      tableCode,
      language,
      customerEmail,
      turns: messages.length,
    });

    const wines = loadCatalog();
    const systemPrompt = buildSommelierPrompt(restaurantSlug, language, wines);

    // Costruisce i messages per Anthropic. Se è stata inviata un'immagine, la
    // attacchiamo all'ULTIMO messaggio user come content multimodale (vision).
    type AnthropicMsg = { role: 'user' | 'assistant'; content: any };
    const claudeMessages: AnthropicMsg[] = messages.map((m, idx) => {
      const isLastUser = idx === messages.length - 1 && m.role === 'user';
      if (isLastUser && image && image.base64) {
        return {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: image.mimeType || 'image/jpeg', data: image.base64 },
            },
            { type: 'text', text: m.content || 'Ecco la foto del piatto al tavolo. Cosa mi consigli?' },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const textBlock = completion.content.find((c) => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const raw = textBlock.text.trim();
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error(`Invalid JSON response from Claude: ${raw.slice(0, 200)}`);
    }
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as ClaudeReply;

    const wineMap = new Map(wines.map((w) => [w.wineId, w]));
    const proposed: ProposedWine[] = [];
    if (Array.isArray(parsed.proposedWines)) {
      for (const cw of parsed.proposedWines) {
        const w = wineMap.get(cw.wineId);
        if (!w) {
          console.warn('[SOMMELIER] Unknown wineId from Claude, skipping:', cw.wineId);
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
    }

    const messageId = randomUUID();
    const intent: Intent = parsed.intent ?? (proposed.length ? 'propose' : 'other');

    console.log(
      '[SOMMELIER] Reply:',
      messageId,
      'intent=' + intent,
      'wines=' + proposed.map((p) => p.wineId).join(',')
    );

    const response: SommelierResponse = {
      reply: parsed.reply,
      intent,
      messageId,
      ...(proposed.length ? { proposedWines: proposed } : {}),
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const stack = err instanceof Error ? err.stack : undefined;
    const apiStatus =
      err && typeof err === 'object' && 'status' in err
        ? (err as { status?: number }).status
        : undefined;
    console.error('[SOMMELIER] Error:', message, { apiStatus, stack });
    return NextResponse.json(
      { error: `Sommelier failed: ${message}`, apiStatus },
      { status: 500 }
    );
  }
}
