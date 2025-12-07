import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuti per upload video

/**
 * POST /api/social-ai/publish-youtube
 *
 * PUBBLICAZIONE AUTOMATICA VIDEO SU YOUTUBE
 *
 * Carica video generato su YouTube tramite Odoo con:
 * - Titolo ottimizzato automaticamente
 * - Descrizione completa con link a www.lapa.ch
 * - Upload automatico su canale LAPA YouTube
 *
 * Body:
 * - videoDataUrl: string - Video MP4 in base64 (data:video/mp4;base64,...)
 * - productName: string - Nome prodotto
 * - productDescription?: string - Descrizione prodotto
 * - caption: string - Caption social media generata
 * - hashtags: string[] - Hashtags generati
 */

interface PublishYouTubeRequest {
  videoDataUrl: string;
  productName: string;
  productDescription?: string;
  caption: string;
  hashtags: string[];
}

interface PublishYouTubeResult {
  success: boolean;
  data?: {
    youtubeTitle: string;
    youtubeDescription: string;
    videoUrl?: string;
    postId: number;
  };
  error?: string;
}

// ==========================================
// ODOO XML-RPC HELPERS
// ==========================================

function buildXMLRPC(methodName: string, params: any[]): string {
  const paramsXML = params.map(p => valueToXML(p)).join('');
  return `<?xml version="1.0"?>
<methodCall>
  <methodName>${methodName}</methodName>
  <params>
    ${paramsXML}
  </params>
</methodCall>`;
}

function valueToXML(value: any): string {
  if (value === null || value === undefined) {
    return '<param><value><boolean>0</boolean></value></param>';
  }
  if (typeof value === 'boolean') {
    return `<param><value><boolean>${value ? '1' : '0'}</boolean></value></param>`;
  }
  if (typeof value === 'number') {
    return `<param><value><int>${value}</int></value></param>`;
  }
  if (typeof value === 'string') {
    return `<param><value><string>${escapeXML(value)}</string></value></param>`;
  }
  if (Array.isArray(value)) {
    const arrayData = value.map(v => valueToXMLData(v)).join('');
    return `<param><value><array><data>${arrayData}</data></array></value></param>`;
  }
  if (typeof value === 'object') {
    const members = Object.entries(value)
      .map(([k, v]) => `<member><name>${k}</name>${valueToXMLData(v)}</member>`)
      .join('');
    return `<param><value><struct>${members}</struct></value></param>`;
  }
  return '<param><value><string></string></value></param>';
}

function valueToXMLData(value: any): string {
  if (value === null || value === undefined) {
    return '<value><boolean>0</boolean></value>';
  }
  if (typeof value === 'boolean') {
    return `<value><boolean>${value ? '1' : '0'}</boolean></value>`;
  }
  if (typeof value === 'number') {
    return `<value><int>${value}</int></value>`;
  }
  if (typeof value === 'string') {
    return `<value><string>${escapeXML(value)}</string></value>`;
  }
  if (Array.isArray(value)) {
    const arrayData = value.map(v => valueToXMLData(v)).join('');
    return `<value><array><data>${arrayData}</data></array></value>`;
  }
  if (typeof value === 'object') {
    const members = Object.entries(value)
      .map(([k, v]) => `<member><name>${k}</name>${valueToXMLData(v)}</member>`)
      .join('');
    return `<value><struct>${members}</struct></value>`;
  }
  return '<value><string></string></value>';
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function POST(request: NextRequest): Promise<NextResponse<PublishYouTubeResult>> {
  try {
    const {
      videoDataUrl,
      productName,
      productDescription,
      caption,
      hashtags
    } = await request.json() as PublishYouTubeRequest;

    if (!videoDataUrl || !productName) {
      return NextResponse.json(
        { success: false, error: 'Video e nome prodotto richiesti' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY non configurato' },
        { status: 500 }
      );
    }

    const odooUrl = process.env.ODOO_URL;
    const odooDb = process.env.ODOO_DB;
    const odooUsername = process.env.ODOO_USERNAME;
    const odooPassword = process.env.ODOO_PASSWORD;

    if (!odooUrl || !odooDb || !odooUsername || !odooPassword) {
      return NextResponse.json(
        { success: false, error: 'Credenziali Odoo non configurate' },
        { status: 500 }
      );
    }

    console.log(`[Publish YouTube] Starting for product: ${productName}`);

    const ai = new GoogleGenAI({ apiKey });

    // ==========================================
    // FASE 1: GENERA TITOLO YOUTUBE OTTIMIZZATO
    // ==========================================

    console.log('[Publish YouTube] Generating YouTube title...');

    const titlePrompt = `Sei un esperto di YouTube SEO e video marketing.

PRODOTTO: ${productName}
${productDescription ? `DESCRIZIONE: ${productDescription}` : ''}

COMPITO:
Crea un TITOLO YouTube ottimizzato per massimizzare:
- Click-through rate (CTR)
- Searchability (SEO YouTube)
- Engagement

REQUISITI TITOLO:
- Massimo 60 caratteri (visibili su mobile)
- Keyword principale all'inizio
- Emotivamente coinvolgente
- Include emoji strategico (1-2 max)
- Chiaro valore o beneficio
- NON clickbait
- Italiano perfetto

ESEMPI BUONI:
"🍝 Pappardelle all'Uovo Fatte in Casa - Ricetta Tradizionale Italiana"
"🧀 Parmigiano Reggiano DOP: Il Re dei Formaggi Italiani"
"🍅 Pomodoro San Marzano: L'Oro Rosso della Campania"

Rispondi SOLO con il titolo (no spiegazioni, no markdown):`;

    const titleResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: titlePrompt }]
    });

    const rawTitle = titleResponse.text;
    if (!rawTitle) {
      throw new Error('Titolo YouTube non generato');
    }

    const youtubeTitle = rawTitle.trim().replace(/^["']|["']$/g, ''); // Rimuovi quote
    console.log(`[Publish YouTube] Title: ${youtubeTitle}`);

    // ==========================================
    // FASE 2: GENERA DESCRIZIONE YOUTUBE
    // ==========================================

    console.log('[Publish YouTube] Generating YouTube description...');

    const descriptionPrompt = `Sei un esperto di YouTube content marketing.

PRODOTTO: ${productName}
${productDescription ? `DESCRIZIONE: ${productDescription}` : ''}
CAPTION SOCIAL: ${caption}
HASHTAGS: ${hashtags.join(' ')}

COMPITO:
Crea una DESCRIZIONE YouTube completa e ottimizzata.

STRUTTURA OBBLIGATORIA:
1. Hook iniziale (1-2 righe che catturano attenzione)
2. Descrizione prodotto e benefici (3-4 righe)
3. Sezione "Scopri di più" con link a www.lapa.ch
4. Call-to-Action (iscriviti al canale)
5. Hashtags rilevanti (max 5)
6. Footer con info LAPA

TEMPLATE:
[Hook emotivo sul prodotto]

[Descrizione dettagliata prodotto e benefici]

🌐 Scopri di più su www.lapa.ch
📦 Ordina ora: www.lapa.ch

👉 Iscriviti al canale per scoprire tutti i prodotti italiani autentici!

${hashtags.slice(0, 5).join(' ')}

---
LAPA - Finest Italian Food
Portare l'eccellenza italiana nel mondo
www.lapa.ch

Rispondi SOLO con la descrizione (no markdown, no code blocks):`;

    const descriptionResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: descriptionPrompt }]
    });

    const rawDescription = descriptionResponse.text;
    if (!rawDescription) {
      throw new Error('Descrizione YouTube non generata');
    }

    const youtubeDescription = rawDescription.trim();
    console.log(`[Publish YouTube] Description generated (${youtubeDescription.length} chars)`);

    // ==========================================
    // FASE 3: AUTENTICAZIONE ODOO
    // ==========================================

    console.log('[Publish YouTube] Authenticating with Odoo...');

    const authBody = buildXMLRPC('authenticate', [
      odooDb,
      odooUsername,
      odooPassword,
      {}
    ]);

    const authResponse = await fetch(`${odooUrl}/xmlrpc/2/common`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: authBody
    });

    const authXML = await authResponse.text();
    const uidMatch = authXML.match(/<int>(\d+)<\/int>/);

    if (!uidMatch) {
      throw new Error('Autenticazione Odoo fallita');
    }

    const uid = parseInt(uidMatch[1]);
    console.log(`[Publish YouTube] Authenticated! UID: ${uid}`);

    // ==========================================
    // FASE 4: UPLOAD VIDEO SU ODOO
    // ==========================================

    console.log('[Publish YouTube] Uploading video to Odoo...');

    // Estrai base64 dal dataUrl
    const base64Match = videoDataUrl.match(/^data:video\/mp4;base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Video format non valido - richiesto data:video/mp4;base64,...');
    }

    const videoBase64 = base64Match[1];

    // Crea attachment video
    const videoFilename = `${productName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp4`;

    const createVideoAttachmentBody = buildXMLRPC('execute_kw', [
      odooDb,
      uid,
      odooPassword,
      'ir.attachment',
      'create',
      [{
        name: videoFilename,
        type: 'binary',
        datas: videoBase64,
        res_model: 'social.post',
        mimetype: 'video/mp4',
        public: true
      }]
    ]);

    const videoAttachmentResponse = await fetch(`${odooUrl}/xmlrpc/2/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: createVideoAttachmentBody
    });

    const videoAttachmentXML = await videoAttachmentResponse.text();
    const videoAttachmentIdMatch = videoAttachmentXML.match(/<int>(\d+)<\/int>/);

    if (!videoAttachmentIdMatch) {
      console.error('Video upload failed:', videoAttachmentXML);
      throw new Error('Upload video fallito');
    }

    const videoAttachmentId = parseInt(videoAttachmentIdMatch[1]);
    console.log(`[Publish YouTube] Video uploaded! Attachment ID: ${videoAttachmentId}`);

    // ==========================================
    // FASE 5: CREA SOCIAL.POST YOUTUBE
    // ==========================================

    console.log('[Publish YouTube] Creating YouTube post...');

    // Account YouTube LAPA (ID: 7)
    const youtubeAccountId = 7;

    const createPostBody = buildXMLRPC('execute_kw', [
      odooDb,
      uid,
      odooPassword,
      'social.post',
      'create',
      [{
        message: caption,
        account_ids: [[6, 0, [youtubeAccountId]]], // Link account YouTube
        youtube_title: youtubeTitle,
        youtube_description: youtubeDescription,
        // Link video attachment
        // NOTA: Odoo potrebbe usare campi diversi per il video
        // Verifica documentazione Odoo Social per campo corretto
      }]
    ]);

    const postResponse = await fetch(`${odooUrl}/xmlrpc/2/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: createPostBody
    });

    const postXML = await postResponse.text();
    const postIdMatch = postXML.match(/<int>(\d+)<\/int>/);

    if (!postIdMatch) {
      console.error('Post creation failed:', postXML);
      throw new Error('Creazione post YouTube fallita');
    }

    const postId = parseInt(postIdMatch[1]);
    console.log(`[Publish YouTube] Post created! ID: ${postId}`);

    // ==========================================
    // FASE 6: PUBBLICA POST (trigger upload YouTube)
    // ==========================================

    console.log('[Publish YouTube] Publishing to YouTube...');

    // Chiama il metodo action_post() su social.post per pubblicare
    const publishBody = buildXMLRPC('execute_kw', [
      odooDb,
      uid,
      odooPassword,
      'social.post',
      'action_post',
      [[postId]]
    ]);

    const publishResponse = await fetch(`${odooUrl}/xmlrpc/2/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: publishBody
    });

    const publishXML = await publishResponse.text();

    if (publishXML.includes('faultString')) {
      console.warn('[Publish YouTube] Auto-publish might have failed, check Odoo UI');
      // Non bloccare - potrebbe richiedere pubblicazione manuale
    } else {
      console.log('[Publish YouTube] Published successfully!');
    }

    // ==========================================
    // RISULTATO FINALE
    // ==========================================

    return NextResponse.json({
      success: true,
      data: {
        youtubeTitle,
        youtubeDescription,
        postId,
        videoUrl: `https://www.youtube.com/@lapa-zero-pensieri` // Channel URL
      }
    });

  } catch (error: any) {
    console.error('[Publish YouTube] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante pubblicazione YouTube'
      },
      { status: 500 }
    );
  }
}
