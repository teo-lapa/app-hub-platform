/**
 * Chatter Parser Utility
 * Parses Odoo chatter messages for the Controllo Picking dashboard
 */

export interface ParsedPrelievo {
  type: 'prelievo';
  zona: string;
  operatore: string;
  data: Date;
  tempoTotale: string;
  prodottiPrelevati: number;
  quantitaTotale: number;
  ubicazioniVisitate: number;
}

export interface ControlloErrore {
  prodotto: string;
  tipo: string;  // 'Mancante', 'Errore Quantità', etc.
  nota: string;
}

export interface ParsedControllo {
  type: 'controllo';
  zona: string;
  operatore: string;
  data: Date;
  prodottiOk: number;
  prodottiErrore: number;
  errori: ControlloErrore[];  // Detailed errors extracted from the message
}

export interface ParsedVideo {
  type: 'video';
  durata: string;
  data: Date;
  operatore: string;
  dimensioneMB: number;
  url: string;
}

export interface ParsedProblema {
  type: 'problema';
  tipoProblema: string;
  prodotto: string;
  zona: string;
  nota: string;
}

export type ParsedMessage = ParsedPrelievo | ParsedControllo | ParsedVideo | ParsedProblema;

/**
 * Strips HTML tags from a string
 */
function stripHtml(html: string): string {
  if (!html) return '';

  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Extracts URL from HTML anchor tag
 */
function extractUrl(html: string): string {
  const hrefMatch = html.match(/href=["']([^"']+)["']/);
  return hrefMatch ? hrefMatch[1] : '';
}

/**
 * Parses date in format DD/MM/YYYY, HH:MM:SS or DD/MM/YYYY, HH:MM
 */
function parseItalianDate(dateStr: string): Date | null {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  const [, day, month, year, hours, minutes, seconds = '0'] = match;
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hours),
    parseInt(minutes),
    parseInt(seconds)
  );
}

/**
 * Parses a Report Prelievo message
 */
function parsePrelievo(text: string, html: string): ParsedPrelievo | null {
  // Check if this is a prelievo message
  if (!text.includes('REPORT PRELIEVO')) return null;

  // Extract zona
  const zonaMatch = text.match(/REPORT PRELIEVO\s*-\s*[^\n]*?([A-Z][^👤\n]+)/);
  const zona = zonaMatch ? zonaMatch[1].trim() : '';

  // Extract operatore
  const operatoreMatch = text.match(/Operatore:\s*([^\n📅]+)/);
  const operatore = operatoreMatch ? operatoreMatch[1].trim() : '';

  // Extract data
  const dataMatch = text.match(/Data:\s*([^\n⏱️]+)/);
  const dataStr = dataMatch ? dataMatch[1].trim() : '';
  const data = parseItalianDate(dataStr) || new Date();

  // Extract tempo totale
  const tempoMatch = text.match(/Tempo totale:\s*([^\n📊]+)/);
  const tempoTotale = tempoMatch ? tempoMatch[1].trim() : '';

  // Extract prodotti prelevati
  const prodottiMatch = text.match(/Prodotti prelevati:\s*(\d+)/);
  const prodottiPrelevati = prodottiMatch ? parseInt(prodottiMatch[1]) : 0;

  // Extract quantita totale
  const quantitaMatch = text.match(/Quantità totale:\s*(\d+)/);
  const quantitaTotale = quantitaMatch ? parseInt(quantitaMatch[1]) : 0;

  // Extract ubicazioni visitate
  const ubicazioniMatch = text.match(/Ubicazioni visitate:\s*(\d+)/);
  const ubicazioniVisitate = ubicazioniMatch ? parseInt(ubicazioniMatch[1]) : 0;

  return {
    type: 'prelievo',
    zona,
    operatore,
    data,
    tempoTotale,
    prodottiPrelevati,
    quantitaTotale,
    ubicazioniVisitate,
  };
}

/**
 * Parses a Controllo Completato message
 */
function parseControllo(text: string, html: string): ParsedControllo | null {
  // Check if this is a controllo message
  if (!text.includes('CONTROLLO COMPLETATO')) return null;

  // Extract zona
  const zonaMatch = text.match(/CONTROLLO COMPLETATO\s*-\s*([^\s]+)/);
  const zona = zonaMatch ? zonaMatch[1].trim() : '';

  // Extract operatore
  const operatoreMatch = text.match(/Controllato da:\s*([A-Za-zÀ-ÿ\s]+?)(?:\s+Data:|$)/i);
  const operatore = operatoreMatch ? operatoreMatch[1].trim() : '';

  // Extract data
  const dataMatch = text.match(/Data:\s*(\d{1,2}\/\d{1,2}\/\d{4}[,\s]+\d{1,2}:\d{2}(?::\d{2})?)/i);
  const dataStr = dataMatch ? dataMatch[1].trim() : '';
  const data = parseItalianDate(dataStr) || new Date();

  // Extract prodotti OK
  const okMatch = text.match(/OK:\s*(\d+)/);
  const prodottiOk = okMatch ? parseInt(okMatch[1]) : 0;

  // Extract prodotti errore (look for both "ERRORI:" and "Errori:")
  const erroriMatch = text.match(/ERRORI:\s*(\d+)/i);
  const prodottiErrore = erroriMatch ? parseInt(erroriMatch[1]) : 0;

  // Extract individual error details
  // Format: • PRODUCT_NAME - ❌ Mancante: Note
  // or: • PRODUCT_NAME - ⚠️ Errore Quantità: Note
  const errori: ControlloErrore[] = [];

  // Find the DETTAGLIO ERRORI section
  const dettaglioIndex = text.indexOf('DETTAGLIO ERRORI');
  if (dettaglioIndex !== -1) {
    const erroriSection = text.substring(dettaglioIndex);

    // Match each error line: • PRODUCT - TYPE: NOTE
    const errorRegex = /•\s*([^-]+)\s*-\s*(?:❌|⚠️|🔧|📅|📍)?\s*([^:]+):\s*([^•]+)/g;
    let match;

    while ((match = errorRegex.exec(erroriSection)) !== null) {
      errori.push({
        prodotto: match[1].trim(),
        tipo: match[2].trim(),
        nota: match[3].trim(),
      });
    }
  }

  return {
    type: 'controllo',
    zona,
    operatore,
    data,
    prodottiOk,
    prodottiErrore,
    errori,
  };
}

/**
 * Parses a Video Controllo message
 */
function parseVideo(text: string, html: string): ParsedVideo | null {
  // Check if this is a video message - be more flexible with emoji variations
  if (!text.includes('VIDEO CONTROLLO') && !html.includes('VIDEO CONTROLLO')) return null;

  // Extract durata - handle both spaces and list item formats
  let durata = '';
  const durataMatch = text.match(/Durata[:\s]+([0-9:]+)/i);
  if (durataMatch) {
    durata = durataMatch[1].trim();
  }

  // Extract data - handle various formats
  let dataStr = '';
  const dataMatch = text.match(/Data[:\s]+(\d{1,2}\/\d{1,2}\/\d{4}[,\s]+\d{1,2}:\d{2})/i);
  if (dataMatch) {
    dataStr = dataMatch[1].trim();
  }
  const data = parseItalianDate(dataStr) || new Date();

  // Extract operatore
  let operatore = '';
  const operatoreMatch = text.match(/Operatore[:\s]+([A-Za-zÀ-ÿ\s]+?)(?:\s+Dimensione|$)/i);
  if (operatoreMatch) {
    operatore = operatoreMatch[1].trim();
  }

  // Extract dimensione
  let dimensioneMB = 0;
  const dimensioneMatch = text.match(/Dimensione[:\s]+([0-9.]+)\s*MB/i);
  if (dimensioneMatch) {
    dimensioneMB = parseFloat(dimensioneMatch[1]);
  }

  // Extract URL from HTML - look for webm/mp4 links
  let url = '';
  const urlMatch = html.match(/href=["']([^"']+\.(?:webm|mp4)[^"']*)["']/i);
  if (urlMatch) {
    url = urlMatch[1];
  } else {
    // Fallback to any href
    url = extractUrl(html);
  }

  return {
    type: 'video',
    durata,
    data,
    operatore,
    dimensioneMB,
    url,
  };
}

/**
 * Parses a Prodotto Mancante or other problem message
 */
function parseProblema(text: string, html: string): ParsedProblema | null {
  // Check if this is a problema message
  if (!text.includes('PRODOTTO MANCANTE') && !text.includes('PROBLEMA')) return null;

  // Extract tipo problema
  const tipoMatch = text.match(/⚠️\s*([A-Z][A-Z\s]+?)(?:\s+Prodotto:|$)/);
  const tipoProblema = tipoMatch ? tipoMatch[1].trim() : 'PROBLEMA';

  // Extract prodotto
  const prodottoMatch = text.match(/Prodotto:\s*([^\n]+?)(?:\s+Zona:|$)/);
  const prodotto = prodottoMatch ? prodottoMatch[1].trim() : '';

  // Extract zona
  const zonaMatch = text.match(/Zona:\s*([^\n]+?)(?:\s+Nota:|$)/);
  const zona = zonaMatch ? zonaMatch[1].trim() : '';

  // Extract nota
  const notaMatch = text.match(/Nota:\s*([^\n]+)/);
  const nota = notaMatch ? notaMatch[1].trim() : '';

  return {
    type: 'problema',
    tipoProblema,
    prodotto,
    zona,
    nota,
  };
}

/**
 * Parses a single chatter message and returns structured data
 */
export function parseChatterMessage(htmlBody: string): ParsedMessage | null {
  if (!htmlBody) return null;

  const text = stripHtml(htmlBody);

  // Try parsing as different message types
  const prelievo = parsePrelievo(text, htmlBody);
  if (prelievo) return prelievo;

  const controllo = parseControllo(text, htmlBody);
  if (controllo) return controllo;

  const video = parseVideo(text, htmlBody);
  if (video) return video;

  const problema = parseProblema(text, htmlBody);
  if (problema) return problema;

  return null;
}

/**
 * Parses all chatter messages and groups them by type
 */
export function parseAllChatterMessages(
  messages: Array<{ body: string; date: string; author_id: [number, string] }>
): {
  prelievi: ParsedPrelievo[];
  controlli: ParsedControllo[];
  video: ParsedVideo[];
  problemi: ParsedProblema[];
} {
  const prelievi: ParsedPrelievo[] = [];
  const controlli: ParsedControllo[] = [];
  const video: ParsedVideo[] = [];
  const problemi: ParsedProblema[] = [];

  for (const message of messages) {
    const parsed = parseChatterMessage(message.body);

    if (!parsed) continue;

    switch (parsed.type) {
      case 'prelievo':
        prelievi.push(parsed);
        break;
      case 'controllo':
        controlli.push(parsed);
        break;
      case 'video':
        video.push(parsed);
        break;
      case 'problema':
        problemi.push(parsed);
        break;
    }
  }

  return { prelievi, controlli, video, problemi };
}
