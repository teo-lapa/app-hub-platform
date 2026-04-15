/**
 * Parser per log dei bot WhatsApp.
 * Formato riga: "YYYY-MM-DDTHH:MM:SS.sssZ - TIPO: contenuto"
 */

export type LogDirection = 'in' | 'out' | 'internal';

export interface ParsedMessage {
  ts: string;
  direction: LogDirection;
  contact?: string;
  text: string;
  hasMedia?: boolean;
}

export interface ParsedError {
  ts: string;
  level: 'error' | 'warn' | 'fatal';
  message: string;
  context?: string;
}

export interface ConversationThread {
  contact: string;
  lastTs: string;
  messages: ParsedMessage[];
}

const LINE_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s-\s(.*)$/;
const ERROR_RE = /\b(error|errore|failed|fatal|exception|crash|timeout|undefined is not|cannot read|denied|401|403|500|502|503)\b/i;
const CLAUDE_CALL_RE = /^processWithClaude called:\s*"([^"]*?)(?:"|…")\s*(?:claudeRunning=|$)/;
const OUTBOX_RE = /^Outbox:\s*sent to\s*(\S+)/;
const OWNER_RE = /^OWNER:\s*(.*)$/;
const FROM_RE = /^(?:FROM|from)\s+(\S+):\s*(.*)$/;
const MEDIA_RE = /Foto inviata|audio|immagine|video|media\//i;

export function parseLog(raw: string): { messages: ParsedMessage[]; errors: ParsedError[] } {
  const messages: ParsedMessage[] = [];
  const errors: ParsedError[] = [];
  if (!raw) return { messages, errors };

  const lines = raw.split('\n');
  let lastOwnerText = '';
  let lastOwnerTs = '';

  for (const line of lines) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    const ts = m[1];
    const body = m[2];

    // errori
    if (ERROR_RE.test(body)) {
      errors.push({
        ts,
        level: /fatal|crash/i.test(body) ? 'fatal' : /warn/i.test(body) ? 'warn' : 'error',
        message: body.length > 300 ? body.slice(0, 300) + '…' : body,
      });
    }

    // OWNER: input da proprietario
    const ow = body.match(OWNER_RE);
    if (ow) {
      lastOwnerText = ow[1].trim();
      lastOwnerTs = ts;
      if (lastOwnerText) {
        messages.push({ ts, direction: 'in', contact: 'owner', text: lastOwnerText });
      }
      continue;
    }

    // FROM <contact>: messaggio da cliente/contatto
    const fr = body.match(FROM_RE);
    if (fr) {
      messages.push({ ts, direction: 'in', contact: fr[1], text: fr[2] });
      continue;
    }

    // processWithClaude → conferma che ha ricevuto (testo breve)
    const cc = body.match(CLAUDE_CALL_RE);
    if (cc) {
      const txt = cc[1].trim();
      if (txt && !lastOwnerText) {
        messages.push({ ts, direction: 'in', contact: 'unknown', text: txt, hasMedia: MEDIA_RE.test(txt) });
      }
      continue;
    }

    // Outbox: risposta inviata
    const ob = body.match(OUTBOX_RE);
    if (ob) {
      messages.push({ ts, direction: 'out', contact: ob[1], text: '[risposta inviata]' });
      continue;
    }
  }

  return { messages, errors };
}

export function threadByContact(messages: ParsedMessage[]): ConversationThread[] {
  const map = new Map<string, ConversationThread>();
  for (const m of messages) {
    const c = m.contact || 'unknown';
    if (!map.has(c)) map.set(c, { contact: c, lastTs: m.ts, messages: [] });
    const t = map.get(c)!;
    t.messages.push(m);
    if (m.ts > t.lastTs) t.lastTs = m.ts;
  }
  return Array.from(map.values()).sort((a, b) => b.lastTs.localeCompare(a.lastTs));
}

export interface StatsBucket {
  hour: string;
  in: number;
  out: number;
}

export function stats(messages: ParsedMessage[], errors: ParsedError[]) {
  const now = Date.now();
  const last24h = messages.filter(m => now - new Date(m.ts).getTime() < 86400000);
  const last1h = messages.filter(m => now - new Date(m.ts).getTime() < 3600000);
  const errLast24h = errors.filter(e => now - new Date(e.ts).getTime() < 86400000);

  const buckets = new Map<string, StatsBucket>();
  for (const m of last24h) {
    const h = m.ts.slice(0, 13);
    if (!buckets.has(h)) buckets.set(h, { hour: h, in: 0, out: 0 });
    const b = buckets.get(h)!;
    if (m.direction === 'in') b.in++;
    else if (m.direction === 'out') b.out++;
  }

  const lastTs = messages.length ? messages[messages.length - 1].ts : null;
  const lastMsgMinutesAgo = lastTs ? Math.floor((now - new Date(lastTs).getTime()) / 60000) : null;

  return {
    total24h: last24h.length,
    in24h: last24h.filter(m => m.direction === 'in').length,
    out24h: last24h.filter(m => m.direction === 'out').length,
    last1h: last1h.length,
    errors24h: errLast24h.length,
    lastMsgTs: lastTs,
    lastMsgMinutesAgo,
    buckets: Array.from(buckets.values()).sort((a, b) => a.hour.localeCompare(b.hour)),
  };
}

/** Health score 0-100. Penalizza: offline, errori recenti, nessuna attività. */
export function healthScore(opts: {
  online: boolean;
  errors24h: number;
  lastMsgMinutesAgo: number | null;
}): number {
  if (!opts.online) return 0;
  let s = 100;
  s -= Math.min(opts.errors24h * 3, 40);
  if (opts.lastMsgMinutesAgo != null && opts.lastMsgMinutesAgo > 240) s -= 15;
  if (opts.lastMsgMinutesAgo == null) s -= 5;
  return Math.max(0, Math.min(100, s));
}
