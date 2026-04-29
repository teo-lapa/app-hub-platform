/**
 * OCR Attachments Pipeline
 * Helper per il cron `/api/cron/ocr-attachments`.
 *
 * Pulizia/filtri allegati, chiamata al servizio Jetson OCR, build nome file.
 */

const JETSON_OCR_URL = process.env.JETSON_OCR_URL || 'https://jetson.lapa.ch';
const JETSON_OCR_TIMEOUT_MS = parseInt(process.env.JETSON_OCR_TIMEOUT_MS || '240000', 10);

/** Progetti email Odoo da osservare. */
export const EMAIL_PROJECT_IDS = [109, 110, 111, 112, 113, 114];

/** Tag Odoo da garantire. */
export const TAG_OCR_DONE = 'OCR_done';
export const TAG_OCR_FAILED = 'OCR_failed';

/** Soglia minima dimensione file per essere candidato OCR (loghi/emoticon esclusi). */
export const MIN_ATTACHMENT_BYTES = 50 * 1024;

/** Pattern di file da escludere (loghi, icone, firme). */
const JUNK_NAME_PATTERNS = [
  /\blogo\b/i,
  /\bicona?\b/i,
  /\bicon\b/i,
  /\bemoticon/i,
  /\bsignature\b/i,
  /\bfirma\b/i,
  /\bfacebook\b/i,
  /\binstagram\b/i,
  /\btiktok\b/i,
  /\blinkedin\b/i,
  /\btwitter\b/i,
  /\bsito web\b/i,
  /tracking[-_]?pixel/i,
];

export function isJunkAttachment(name: string, fileSize: number, mimetype: string): { skip: boolean; reason?: string } {
  if (fileSize < MIN_ATTACHMENT_BYTES) {
    return { skip: true, reason: `troppo piccolo (${fileSize}B < ${MIN_ATTACHMENT_BYTES}B)` };
  }
  if (!mimetype) {
    return { skip: true, reason: 'mimetype mancante' };
  }
  if (mimetype !== 'application/pdf' && !mimetype.startsWith('image/')) {
    return { skip: true, reason: `mimetype non supportato: ${mimetype}` };
  }
  for (const pattern of JUNK_NAME_PATTERNS) {
    if (pattern.test(name)) {
      return { skip: true, reason: `match junk pattern: ${pattern}` };
    }
  }
  return { skip: false };
}

/** Vero se nella lista esiste un .md con stesso basename del file. */
export function hasCompanionMarkdown(name: string, allAttachmentNames: string[]): boolean {
  const base = name.replace(/\.[A-Za-z0-9]+$/, '');
  const expectedMd = `${base}.md`;
  return allAttachmentNames.some((n) => n === expectedMd);
}

// ---------------------------------------------------------------------------
// Jetson client
// ---------------------------------------------------------------------------
export interface OCRHeader {
  doc_type: string | null;
  vendor: string | null;
  customer: string | null;
  doc_date: string | null;
  doc_number: string | null;
  currency: string | null;
  total: number | null;
  iban: string | null;
  extras?: Record<string, unknown>;
}

export interface OCRResponse {
  filename: string;
  num_pages: number;
  wall_time_s: number;
  model_used: string;
  method: string;
  cached: boolean;
  markdown: string;
  cleaned_markdown?: string;
  header?: OCRHeader;
  has_invoice_table?: boolean;
}

export async function callJetsonOCR(
  filename: string,
  base64: string,
  mimetype: string,
): Promise<OCRResponse> {
  const buffer = Buffer.from(base64, 'base64');
  const blob = new Blob([buffer], { type: mimetype });
  const form = new FormData();
  form.append('file', blob, filename);
  form.append('clean', 'true');

  const endpoint = mimetype === 'application/pdf' ? '/ocr-pdf' : '/ocr-image';
  const url = `${JETSON_OCR_URL.replace(/\/+$/, '')}${endpoint}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), JETSON_OCR_TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: 'POST', body: form, signal: ctrl.signal });
    if (!r.ok) {
      const err = await r.text();
      throw new Error(`Jetson HTTP ${r.status}: ${err.slice(0, 300)}`);
    }
    return (await r.json()) as OCRResponse;
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// Async jobs API — per superare timeout 100s di Cloudflare su PDF lunghi
// ---------------------------------------------------------------------------
export interface JetsonJobStart {
  job_id: string;
  status: 'queued';
  kind: 'pdf' | 'image';
}

export interface JetsonJobStatus {
  id: string;
  kind: 'pdf' | 'image';
  filename: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  queued_at?: number;
  started_at?: number;
  finished_at?: number;
  wall_time_s?: number;
  error?: string;
  result?: {
    filename?: string;
    num_pages: number;
    method: string;
    markdown: string;
    cleaned_markdown?: string;
    header?: OCRHeader;
    has_invoice_table?: boolean;
  };
}

export async function jetsonJobStart(filename: string, base64: string, mimetype: string): Promise<JetsonJobStart> {
  const buffer = Buffer.from(base64, 'base64');
  const blob = new Blob([buffer], { type: mimetype });
  const form = new FormData();
  form.append('file', blob, filename);
  const url = `${JETSON_OCR_URL.replace(/\/+$/, '')}/jobs/start`;
  const r = await fetch(url, { method: 'POST', body: form });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Jetson jobs/start HTTP ${r.status}: ${err.slice(0, 300)}`);
  }
  return (await r.json()) as JetsonJobStart;
}

export async function jetsonJobStatus(jobId: string): Promise<JetsonJobStatus> {
  const url = `${JETSON_OCR_URL.replace(/\/+$/, '')}/jobs/${jobId}`;
  const r = await fetch(url);
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Jetson jobs/${jobId} HTTP ${r.status}: ${err.slice(0, 300)}`);
  }
  return (await r.json()) as JetsonJobStatus;
}

// ---------------------------------------------------------------------------
// Filename builder
// ---------------------------------------------------------------------------
function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
}

export function buildCleanedName(
  original: string,
  header: OCRHeader | undefined,
  extension: string,
): string {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  if (!header) {
    return original;
  }
  const parts: string[] = [];
  const docType = header.doc_type ? safeName(header.doc_type) : '';
  const vendor = header.vendor ? safeName(header.vendor) : '';
  const date = header.doc_date || todayIso();
  const number = header.doc_number ? safeName(header.doc_number) : '';

  if (docType && number && vendor) {
    parts.push(`${docType} ${number}`, vendor, date);
  } else if (docType && vendor) {
    parts.push(docType, vendor, date);
  } else if (docType) {
    parts.push(docType, date);
  } else if (vendor) {
    parts.push('Documento', vendor, date);
  } else {
    return safeName(original);
  }

  return parts.join(' - ') + ext;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function imageFallbackName(original: string, vlmSummary?: string): string {
  const date = todayIso();
  if (vlmSummary && vlmSummary.length > 5) {
    const short = safeName(vlmSummary).slice(0, 50);
    return `Foto - ${short} - ${date}` + extensionOf(original);
  }
  return `Foto - ${date}` + extensionOf(original);
}

export function extensionOf(name: string): string {
  const m = name.match(/\.[A-Za-z0-9]+$/);
  return m ? m[0] : '';
}

// ---------------------------------------------------------------------------
// Chatter HTML builder
// ---------------------------------------------------------------------------
export function buildChatterHtml(opts: {
  status: 'ok' | 'failed';
  attachmentName: string;
  newName?: string;
  header?: OCRHeader;
  wallTimeSec?: number;
  numPages?: number;
  errorMessage?: string;
  mdAttachmentId?: number;
  mdPreview?: string;
}): string {
  // Odoo chatter rende HTML solo se il body NON è wrappato in <p> dall'esterno.
  // La memoria LAPA dice: "Chatter Odoo: solo testo semplice, MAI HTML".
  // Quindi usiamo plain text con line break \n.
  if (opts.status === 'failed') {
    return [
      `🔴 OCR FALLITO per ${opts.attachmentName}`,
      `Errore: ${opts.errorMessage || 'sconosciuto'}`,
      `Verrà ritentato al prossimo giro del cron.`,
    ].join('\n');
  }

  const h = opts.header || ({} as OCRHeader);
  const lines: string[] = [];
  lines.push(`🤖 OCR completato in ${opts.wallTimeSec ?? 0}s su ${opts.numPages ?? 1} pagine`);
  lines.push('');
  if (h.doc_type) lines.push(`Tipo: ${h.doc_type}`);
  if (h.vendor) lines.push(`Fornitore: ${h.vendor}`);
  if (h.customer) lines.push(`Cliente: ${h.customer}`);
  if (h.doc_number) lines.push(`Numero: ${h.doc_number}`);
  if (h.doc_date) lines.push(`Data: ${h.doc_date}`);
  if (h.currency || h.total != null) {
    const t = h.total != null ? h.total.toFixed(2) : '?';
    lines.push(`Totale: ${h.currency || ''} ${t}`.trim());
  }
  if (h.iban) lines.push(`IBAN: ${h.iban}`);
  if (opts.newName) lines.push(`File: ${opts.newName}`);
  if (opts.mdAttachmentId) lines.push(`MD allegato id: ${opts.mdAttachmentId}`);
  if (opts.mdPreview) {
    lines.push('');
    lines.push('--- Anteprima MD ---');
    lines.push(opts.mdPreview.slice(0, 600));
  }
  // Riga JSON machine-readable per skill /arrivi
  if (h && (h.doc_type || h.vendor || h.doc_number)) {
    const payload: Record<string, unknown> = {};
    if (h.doc_type) payload.doc_type = h.doc_type;
    if (h.vendor) payload.vendor = h.vendor;
    if (h.customer) payload.customer = h.customer;
    if (h.doc_number) payload.doc_number = h.doc_number;
    if (h.doc_date) payload.doc_date = h.doc_date;
    if (h.currency) payload.currency = h.currency;
    if (h.total != null) payload.total = h.total;
    if (h.iban) payload.iban = h.iban;
    if (opts.newName) payload.filename = opts.newName;
    if (opts.mdAttachmentId) payload.md_attachment_id = opts.mdAttachmentId;
    lines.push('');
    lines.push(`OCR_JSON: ${JSON.stringify(payload)}`);
  }
  return lines.join('\n');
}
