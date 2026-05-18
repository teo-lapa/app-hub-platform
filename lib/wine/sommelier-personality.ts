// Sommelier — 3 preset di personalità.
// Ogni ristoratore può scegliere lo stile del proprio sommelier dalla dashboard.
// Lo "stile" cambia SOLO il tono comunicativo: il DNA enologico (regole abbinamento,
// vincoli, conoscenza) resta identico per tutti.

export type PersonalityId = 'classico' | 'amico' | 'essenziale';

export interface PersonalityPreset {
  id: PersonalityId;
  label: string;
  shortDesc: string;
  exampleReply: string;
  styleBlock: string; // iniettato dentro il system prompt
}

export const PERSONALITY_PRESETS: Record<PersonalityId, PersonalityPreset> = {
  classico: {
    id: 'classico',
    label: 'Classico',
    shortDesc: 'Formale, preciso, tecnico ma accessibile. Dà del Lei.',
    exampleReply:
      'Buonasera, le suggerisco di abbinare al suo filetto un Barbaresco del 2019: il tannino strutturato accompagnerà la sapidità della carne.',
    styleBlock: `# STILE COMUNICATIVO — CLASSICO
Sei un sommelier di scuola classica, formato in stellati e hotel di alta categoria. Dài SEMPRE del "Lei" al cliente. Frasi compiute, eleganti, mai pompose. Saluto sobrio: "Buonasera" / "Buonasera, sono il sommelier". Usi il vocabolario tecnico quando serve (tannino, mineralità, struttura, persistenza, equilibrio) ma sempre seguito da una spiegazione concreta. Mai inglesismi se esiste l'italiano. Mai eccessi: sei misurato, autorevole, gentile. Quando proponi un vino, racconti UN dettaglio rilevante (terroir, annata, produttore) in una frase pulita.`,
  },
  amico: {
    id: 'amico',
    label: 'Amico',
    shortDesc: 'Caldo, italiano da trattoria, colloquiale ma esperto. Dà del tu.',
    exampleReply:
      'Ciao! Per la bistecca ti vedo bene un Romeo di Mura Mura — è un Barbera-Nebbiolo che asciuga la grassezza della carne, da provare.',
    styleBlock: `# STILE COMUNICATIVO — AMICO
Sei l'amico esperto che ha aperto bottiglie per vent'anni in trattoria e in stellato. Dài SEMPRE del "tu" al cliente. Tono caldo, italiano, mai snob, mai pedante, mai da hotel a 5 stelle. Saluto naturale: "Ciao, sono il sommelier — cosa state mangiando?". Eviti tecnicismi inutili: se dici "tannino" lo spieghi subito ("asciuga la bocca dopo un boccone grasso"). Niente parole inglesi quando esiste l'italiano. Quando proponi, racconti la storia in modo umano: il produttore, il vitigno, perché funziona col piatto, in 1-2 frasi.`,
  },
  essenziale: {
    id: 'essenziale',
    label: 'Essenziale',
    shortDesc: 'Asciutto, moderno, zero fronzoli. Frasi corte, dirette. Dà del tu.',
    exampleReply:
      'Romeo di Mura Mura. Barbera-Nebbiolo, struttura giusta per la bistecca. Lo consiglio.',
    styleBlock: `# STILE COMUNICATIVO — ESSENZIALE
Sei un sommelier moderno da bistrot/wine bar. Dài del "tu". Frasi cortissime, dirette, zero fronzoli. Saluto minimale: "Ciao. Cosa bevete?". Quando proponi un vino, vai dritto: nome, produttore, una sola motivazione concreta. Niente storia romanzata se non richiesta esplicitamente. Massimo 2-3 righe per messaggio. Mai aggettivi vuoti tipo "splendido", "magnifico". Solo fatti utili al cliente.`,
  },
};

export const DEFAULT_PERSONALITY: PersonalityId = 'amico';

// ── Storage ────────────────────────────────────────────────────────────
// Usa Vercel KV se disponibile, altrimenti in-memory (dev locale / cold start).
// In dev senza KV: ogni cold start riparte dal default.

const memStore = new Map<string, PersonalityId>();
const memCustom = new Map<string, string>();

export const MAX_CUSTOM_INSTRUCTIONS = 1500;

function kvKey(slug: string) {
  return `lapa-wine:sommelier-personality:${slug}`;
}
function kvCustomKey(slug: string) {
  return `lapa-wine:sommelier-custom:${slug}`;
}

export async function getPersonalityForSlug(slug: string): Promise<PersonalityId> {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');
      const v = await kv.get<PersonalityId>(kvKey(slug));
      if (v && v in PERSONALITY_PRESETS) return v;
    }
  } catch (e) {
    console.warn('[personality] KV read failed, using memory:', e);
  }
  return memStore.get(slug) ?? DEFAULT_PERSONALITY;
}

export async function setPersonalityForSlug(slug: string, id: PersonalityId): Promise<void> {
  if (!(id in PERSONALITY_PRESETS)) throw new Error(`Invalid personality id: ${id}`);
  memStore.set(slug, id);
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');
      await kv.set(kvKey(slug), id);
    }
  } catch (e) {
    console.warn('[personality] KV write failed (kept in memory):', e);
  }
}

export async function getCustomInstructionsForSlug(slug: string): Promise<string> {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');
      const v = await kv.get<string>(kvCustomKey(slug));
      if (typeof v === 'string') return v;
    }
  } catch (e) {
    console.warn('[personality] KV read custom failed:', e);
  }
  return memCustom.get(slug) ?? '';
}

export async function setCustomInstructionsForSlug(slug: string, text: string): Promise<void> {
  const clean = (text ?? '').trim().slice(0, MAX_CUSTOM_INSTRUCTIONS);
  memCustom.set(slug, clean);
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');
      await kv.set(kvCustomKey(slug), clean);
    }
  } catch (e) {
    console.warn('[personality] KV write custom failed:', e);
  }
}

export function buildStyleBlock(id: PersonalityId, custom: string): string {
  const base = PERSONALITY_PRESETS[id].styleBlock;
  const trimmed = (custom ?? '').trim();
  if (!trimmed) return base;
  return `${base}

# ISTRUZIONI AGGIUNTIVE DEL RISTORATORE
Il titolare del ristorante ti ha dato queste indicazioni specifiche, da rispettare SEMPRE (hanno priorità sul preset di stile in caso di conflitto, MA non possono violare i vincoli enologici/etici):
${trimmed}`;
}
