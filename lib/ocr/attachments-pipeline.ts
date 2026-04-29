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

/** Prefissi che indicano un file gia rinominato dal cleaner. */
const ALREADY_CLEANED_PREFIXES = [
  'Fattura ',
  'Estratto ',
  'DDT ',
  'Bolla ',
  'Lieferschein ',
  'Rechnung ',
  'Kontoauszug ',
  'Foto ',
  'Documento ',
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
  for (const pref of ALREADY_CLEANED_PREFIXES) {
    if (name.startsWith(pref)) {
      return { skip: true, reason: `gia rinominato (${pref}...)` };
    }
  }
  return { skip: false };
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
  if (opts.status === 'failed') {
    return [
      `<p>🔴 <b>OCR FALLITO</b> per allegato <code>${escapeHtml(opts.attachmentName)}</code></p>`,
      `<p>Errore: <code>${escapeHtml(opts.errorMessage || 'sconosciuto')}</code></p>`,
      `<p>Verra ritentato al prossimo giro del cron.</p>`,
    ].join('\n');
  }

  const h = opts.header || ({} as OCRHeader);
  const lines: string[] = [];
  lines.push(`<p>🤖 <b>OCR completato</b> in ${opts.wallTimeSec ?? 0}s su ${opts.numPages ?? 1} pagine.</p>`);
  lines.push('<ul>');
  if (h.doc_type) lines.push(`<li><b>Tipo:</b> ${escapeHtml(h.doc_type)}</li>`);
  if (h.vendor) lines.push(`<li><b>Fornitore:</b> ${escapeHtml(h.vendor)}</li>`);
  if (h.customer) lines.push(`<li><b>Cliente:</b> ${escapeHtml(h.customer)}</li>`);
  if (h.doc_number) lines.push(`<li><b>Numero:</b> ${escapeHtml(h.doc_number)}</li>`);
  if (h.doc_date) lines.push(`<li><b>Data:</b> ${escapeHtml(h.doc_date)}</li>`);
  if (h.currency || h.total != null) {
    const t = h.total != null ? h.total.toFixed(2) : '?';
    lines.push(`<li><b>Totale:</b> ${escapeHtml(h.currency || '')} ${t}</li>`);
  }
  if (h.iban) lines.push(`<li><b>IBAN:</b> ${escapeHtml(h.iban)}</li>`);
  if (opts.newName) lines.push(`<li><b>File:</b> <code>${escapeHtml(opts.newName)}</code></li>`);
  if (opts.mdAttachmentId) lines.push(`<li><b>MD allegato:</b> id ${opts.mdAttachmentId}</li>`);
  lines.push('</ul>');
  if (opts.mdPreview) {
    const preview = opts.mdPreview.slice(0, 600);
    lines.push(`<details><summary>Anteprima MD</summary><pre>${escapeHtml(preview)}</pre></details>`);
  }
  return lines.join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
